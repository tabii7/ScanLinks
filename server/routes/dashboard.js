const express = require('express');
const Client = require('../models/Client');
const Keyword = require('../models/Keyword');
const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');
const Report = require('../models/Report');
const { adminAuth, clientAuth } = require('../middleware/auth');

const router = express.Router();

// Admin dashboard data
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const [
      totalClients,
      activeClients,
      totalKeywords,
      activeKeywords,
      totalScans,
      recentScans,
      totalReports,
      recentReports
    ] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ status: 'active' }),
      Keyword.countDocuments(),
      Keyword.countDocuments({ status: 'active' }),
      Scan.countDocuments(),
      Scan.find({ status: 'completed' })
        .populate('clientId', 'name')
        .sort({ completedAt: -1 })
        .limit(5),
      Report.countDocuments(),
      Report.find()
        .populate('clientId', 'name')
        .sort({ generatedAt: -1 })
        .limit(5)
    ]);

    // Get scan statistics for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentScanStats = await Scan.aggregate([
      {
        $match: {
          completedAt: { $gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt'
            }
          },
          count: { $sum: 1 },
          totalResults: { $sum: '$resultsCount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get client activity data
    const clientActivity = await Scan.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$clientId',
          scanCount: { $sum: 1 },
          totalResults: { $sum: '$resultsCount' }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      {
        $unwind: '$client'
      },
      {
        $project: {
          name: '$client.name',
          scans: '$scanCount',
          results: '$totalResults'
        }
      },
      {
        $sort: { scans: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get sentiment analysis data
    const sentimentData = await ScanResult.aggregate([
      {
        $group: {
          _id: '$sentiment',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get weekly sentiment trends
    const weeklySentimentTrends = await ScanResult.aggregate([
      {
        $lookup: {
          from: 'scans',
          localField: 'scanId',
          foreignField: '_id',
          as: 'scan'
        }
      },
      {
        $unwind: '$scan'
      },
      {
        $match: {
          'scan.completedAt': { $gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            week: { $week: '$scan.completedAt' },
            sentiment: '$sentiment'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.week',
          sentiments: {
            $push: {
              sentiment: '$_id.sentiment',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      overview: {
        totalClients,
        activeClients,
        totalKeywords,
        activeKeywords,
        totalScans,
        totalReports,
      },
      recentActivity: {
        scans: recentScans,
        reports: recentReports,
      },
      charts: {
        scanTrends: recentScanStats,
        clientActivity: clientActivity,
        sentimentDistribution: sentimentData,
        weeklySentimentTrends: weeklySentimentTrends
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Client dashboard data
router.get('/client', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    
    const [
      client,
      totalKeywords,
      activeKeywords,
      totalScans,
      recentScans,
      totalReports,
      recentReports,
      campaignStats
    ] = await Promise.all([
      Client.findById(clientId),
      Keyword.countDocuments({ clientId }).catch(() => 0),
      Keyword.countDocuments({ clientId, status: 'active' }).catch(() => 0),
      Scan.countDocuments({ clientId }).catch(() => 0),
      Scan.find({ clientId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .catch(() => []),
      Report.countDocuments({ clientId }).catch(() => 0),
      Report.find({ clientId })
        .sort({ generatedAt: -1 })
        .limit(5)
        .catch(() => []),
      getCampaignStats(clientId).catch(() => ({}))
    ]);

    // Calculate campaign progress
    const campaignProgress = calculateCampaignProgress(client);

    // Get scan statistics for better dashboard data
    const scanStats = await Scan.aggregate([
      { $match: { clientId: clientId } },
      { $group: {
        _id: null,
        totalScans: { $sum: 1 },
        completedScans: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        runningScans: { $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] } },
        failedScans: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        totalResults: { $sum: '$resultsCount' },
        avgResults: { $avg: '$resultsCount' }
      }}
    ]).catch(() => [{}]);

    const stats = scanStats[0] || {};

    // Get sentiment trend data for charts
    const sentimentTrends = await getSentimentTrends(clientId);
    const sentimentDistribution = await getSentimentDistribution(clientId);
    
    console.log('📊 Sentiment trends for client:', clientId);
    console.log('📈 Negative trend:', sentimentTrends.negativeTrend);
    console.log('📈 Positive trend:', sentimentTrends.positiveTrend);
    console.log('🥧 Sentiment distribution:', sentimentDistribution);

    res.json({
      client: {
        name: client.name,
        logo: client.logo,
        campaignProgress,
      },
      overview: {
        totalKeywords: totalKeywords || 0,
        activeKeywords: activeKeywords || 0,
        totalScans: totalScans || 0,
        totalReports: totalReports || 0,
        completedScans: stats.completedScans || 0,
        runningScans: stats.runningScans || 0,
        failedScans: stats.failedScans || 0,
        totalResults: stats.totalResults || 0,
        avgResults: Math.round(stats.avgResults || 0),
        negativeTrend: sentimentTrends.negativeTrend || [],
        positiveTrend: sentimentTrends.positiveTrend || [],
        sentimentDistribution: sentimentDistribution || []
      },
      recentActivity: {
        scans: recentScans || [],
        reports: recentReports || [],
      },
      campaignStats: campaignStats || {},
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get campaign statistics for a specific client
router.get('/client/:clientId/campaign', adminAuth, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const campaignStats = await getCampaignStats(clientId);
    res.json(campaignStats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get regional data for client dashboard
router.get('/client/regional/:region', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const region = req.params.region;

    const [
      recentScans,
      recentReports,
      regionalStats
    ] = await Promise.all([
      Scan.find({ clientId, region, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(10),
      Report.find({ clientId, region })
        .sort({ generatedAt: -1 })
        .limit(10),
      getRegionalStats(clientId, region)
    ]);

    res.json({
      recentScans,
      recentReports,
      stats: regionalStats,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get rank tracking data for client
router.get('/rank-tracking', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { keyword, region, timeRange } = req.query;

    // Get keywords for this client
    const keywords = await Keyword.find({ clientId, status: 'active' });
    
    // Get recent scans for rank comparison
    const recentScans = await Scan.find({ 
      clientId, 
      status: 'completed',
      ...(region && region !== 'all' ? { region } : {})
    })
    .sort({ completedAt: -1 })
    .limit(10);

    // Get rank history
    const rankHistory = [];
    for (const scan of recentScans) {
      const results = await ScanResult.find({ 
        scanId: scan._id,
        ...(keyword && keyword !== 'all' ? { keyword } : {})
      }).sort({ rank: 1 });

      for (const result of results) {
        // Find previous scan result for comparison
        const previousScan = await Scan.findOne({
          clientId,
          region: scan.region,
          status: 'completed',
          completedAt: { $lt: scan.completedAt }
        }).sort({ completedAt: -1 });

        let movement = 'new';
        let previousRank = null;

        if (previousScan) {
          const previousResult = await ScanResult.findOne({
            scanId: previousScan._id,
            url: result.url,
            keyword: result.keyword
          });

          if (previousResult) {
            previousRank = previousResult.rank;
            if (result.rank < previousResult.rank) {
              movement = 'improved';
            } else if (result.rank > previousResult.rank) {
              movement = 'dropped';
            } else {
              movement = 'unchanged';
            }
          }
        }

        rankHistory.push({
          keyword: result.keyword,
          currentRank: result.rank,
          previousRank,
          movement,
          region: scan.region,
          lastUpdated: scan.completedAt,
          url: result.url,
          title: result.title
        });
      }
    }

    // Calculate summary statistics
    const summary = {
      totalKeywords: keywords.length,
      improved: rankHistory.filter(r => r.movement === 'improved').length,
      dropped: rankHistory.filter(r => r.movement === 'dropped').length,
      new: rankHistory.filter(r => r.movement === 'new').length,
      avgPosition: rankHistory.length > 0 
        ? Math.round(rankHistory.reduce((sum, r) => sum + r.currentRank, 0) / rankHistory.length)
        : 0
    };

    res.json({
      keywords: keywords.map(k => ({ keyword: k.keyword, id: k._id })),
      rankHistory,
      summary
    });
  } catch (error) {
    console.error('Rank tracking error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ranking changes for reports
router.get('/ranking-changes/:scanId', adminAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    const ScanResult = require('../models/ScanResult');
    const Scan = require('../models/Scan');
    
    // Get current scan
    const currentScan = await Scan.findById(scanId);
    if (!currentScan) {
      return res.status(404).json({ message: 'Scan not found' });
    }
    
    // Get current scan results
    const currentResults = await ScanResult.find({ scanId });
    
    // Get previous scan for comparison
    const previousScan = await Scan.findOne({
      clientId: currentScan.clientId,
      region: currentScan.region,
      status: 'completed',
      completedAt: { $lt: currentScan.completedAt }
    }).sort({ completedAt: -1 });
    
    let rankingChanges = {
      new: 0,
      improved: 0,
      dropped: 0,
      unchanged: 0,
      disappeared: 0
    };
    
    if (previousScan) {
      // Get previous scan results
      const previousResults = await ScanResult.find({ scanId: previousScan._id });
      const previousResultsMap = new Map();
      
      // Create map of previous results for quick lookup
      previousResults.forEach(prev => {
        const key = `${prev.url}_${prev.keyword}`;
        previousResultsMap.set(key, prev);
      });
      
      // Analyze current results
      for (const currentResult of currentResults) {
        const key = `${currentResult.url}_${currentResult.keyword}`;
        const previousResult = previousResultsMap.get(key);
        
        if (previousResult) {
          // URL exists in previous scan - check ranking change
          if (currentResult.rank < previousResult.rank) {
            rankingChanges.improved++;
          } else if (currentResult.rank > previousResult.rank) {
            rankingChanges.dropped++;
          } else {
            rankingChanges.unchanged++;
          }
        } else {
          // New URL
          rankingChanges.new++;
        }
      }
      
      // Check for disappeared URLs
      const currentUrls = new Set(currentResults.map(r => `${r.url}_${r.keyword}`));
      const disappearedCount = previousResults.filter(prev => 
        !currentUrls.has(`${prev.url}_${prev.keyword}`)
      ).length;
      rankingChanges.disappeared = disappearedCount;
      
    } else {
      // First scan - all results are new
      rankingChanges.new = currentResults.length;
    }
    
    res.json({
      scanId,
      clientId: currentScan.clientId,
      region: currentScan.region,
      weekNumber: currentScan.weekNumber,
      rankingChanges,
      totalResults: currentResults.length,
      scanDate: currentScan.completedAt
    });
    
  } catch (error) {
    console.error('Ranking changes error:', error);
    res.status(500).json({ message: 'Failed to get ranking changes', error: error.message });
  }
});

// Helper function to get campaign statistics
async function getCampaignStats(clientId) {
  try {
    // Get the latest scan results
    const latestScan = await Scan.findOne({ clientId, status: 'completed' })
      .sort({ completedAt: -1 });

    if (!latestScan) {
      return {
        linksRemoved: 0,
        deIndexed: 0,
        suppressed: 0,
        newPositiveLinks: 0,
        totalPositiveLinks: 0,
        totalNegativeLinks: 0,
        sentimentScore: 0,
      };
    }

    const results = await ScanResult.find({ scanId: latestScan._id });

    const stats = {
      linksRemoved: results.filter(r => r.movement === 'disappeared' && r.sentiment === 'negative').length,
      deIndexed: results.filter(r => r.movement === 'disappeared').length,
      suppressed: results.filter(r => r.isSuppressed).length,
      newPositiveLinks: results.filter(r => r.movement === 'new' && r.sentiment === 'positive').length,
      totalPositiveLinks: results.filter(r => r.sentiment === 'positive').length,
      totalNegativeLinks: results.filter(r => r.sentiment === 'negative').length,
      sentimentScore: calculateSentimentScore(results),
    };

    return stats;
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    return {
      linksRemoved: 0,
      deIndexed: 0,
      suppressed: 0,
      newPositiveLinks: 0,
      totalPositiveLinks: 0,
      totalNegativeLinks: 0,
      sentimentScore: 0,
    };
  }
}

// Helper function to get regional statistics
async function getRegionalStats(clientId, region) {
  try {
    const latestScan = await Scan.findOne({ 
      clientId, 
      region, 
      status: 'completed' 
    }).sort({ completedAt: -1 });

    if (!latestScan) {
      return {
        totalLinks: 0,
        positiveLinks: 0,
        negativeLinks: 0,
        newLinks: 0,
        improvedLinks: 0,
        suppressedLinks: 0,
      };
    }

    const results = await ScanResult.find({ scanId: latestScan._id });

    return {
      totalLinks: results.length,
      positiveLinks: results.filter(r => r.sentiment === 'positive').length,
      negativeLinks: results.filter(r => r.sentiment === 'negative').length,
      newLinks: results.filter(r => r.movement === 'new').length,
      improvedLinks: results.filter(r => r.movement === 'improved').length,
      suppressedLinks: results.filter(r => r.isSuppressed).length,
    };
  } catch (error) {
    console.error('Error getting regional stats:', error);
    return {
      totalLinks: 0,
      positiveLinks: 0,
      negativeLinks: 0,
      newLinks: 0,
      improvedLinks: 0,
      suppressedLinks: 0,
    };
  }
}

// Helper function to calculate campaign progress
function calculateCampaignProgress(client) {
  // Since subscription was removed, return default progress
  return {
    percentage: 0,
    monthsElapsed: 0,
    totalMonths: 0,
    remainingMonths: 0,
  };
}

// Helper function to calculate sentiment score
function calculateSentimentScore(results) {
  if (results.length === 0) return 0;
  
  const positiveCount = results.filter(r => r.sentiment === 'positive').length;
  const negativeCount = results.filter(r => r.sentiment === 'negative').length;
  
  if (positiveCount + negativeCount === 0) return 0;
  
  return Math.round(((positiveCount - negativeCount) / (positiveCount + negativeCount)) * 100);
}

// Helper function to get sentiment trends for charts
async function getSentimentTrends(clientId) {
  try {
    console.log('🔍 Getting sentiment trends for client:', clientId);
    
    // Get the last 7 completed scans
    const recentScans = await Scan.find({ 
      clientId, 
      status: 'completed' 
    })
    .sort({ completedAt: -1 })
    .limit(7);

    console.log('📊 Found recent scans:', recentScans.length);

    const negativeTrend = [];
    const positiveTrend = [];

    for (const scan of recentScans.reverse()) {
      // Get scan results for this scan
      const results = await ScanResult.find({ scanId: scan._id });
      
      const negativeCount = results.filter(r => r.sentiment === 'negative').length;
      const positiveCount = results.filter(r => r.sentiment === 'positive').length;
      
      console.log(`📈 Scan ${scan._id}: ${negativeCount} negative, ${positiveCount} positive`);
      
      negativeTrend.push({
        scanDate: scan.completedAt,
        negativeLinks: negativeCount
      });
      
      positiveTrend.push({
        scanDate: scan.completedAt,
        positiveLinks: positiveCount
      });
    }

    console.log('📊 Final trends:', { negativeTrend, positiveTrend });
    return { negativeTrend, positiveTrend };
  } catch (error) {
    console.error('Error getting sentiment trends:', error);
    return { negativeTrend: [], positiveTrend: [] };
  }
}

// Helper function to get current sentiment distribution
async function getSentimentDistribution(clientId) {
  try {
    console.log('🥧 Getting sentiment distribution for client:', clientId);
    
    // Get the most recent completed scan
    const latestScan = await Scan.findOne({ 
      clientId, 
      status: 'completed' 
    }).sort({ completedAt: -1 });

    console.log('🔍 Latest scan found:', latestScan ? latestScan._id : 'None');

    if (!latestScan) {
      console.log('❌ No completed scans found, returning empty distribution');
      return [
        { name: 'Positive', value: 0, color: '#34d399' },
        { name: 'Negative', value: 0, color: '#f87171' },
        { name: 'Neutral', value: 0, color: '#9ca3af' }
      ];
    }

    // Get results for the latest scan
    const results = await ScanResult.find({ scanId: latestScan._id });
    console.log('📊 Found results:', results.length);
    
    const positiveCount = results.filter(r => r.sentiment === 'positive').length;
    const negativeCount = results.filter(r => r.sentiment === 'negative').length;
    const neutralCount = results.filter(r => r.sentiment === 'neutral').length;

    console.log(`🥧 Sentiment counts: ${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral`);

    const distribution = [
      { name: 'Positive', value: positiveCount, color: '#34d399' },
      { name: 'Negative', value: negativeCount, color: '#f87171' },
      { name: 'Neutral', value: neutralCount, color: '#9ca3af' }
    ];

    console.log('🥧 Final distribution:', distribution);
    return distribution;
  } catch (error) {
    console.error('Error getting sentiment distribution:', error);
    return [
      { name: 'Positive', value: 0, color: '#34d399' },
      { name: 'Negative', value: 0, color: '#f87171' },
      { name: 'Neutral', value: 0, color: '#9ca3af' }
    ];
  }
}

module.exports = router;


