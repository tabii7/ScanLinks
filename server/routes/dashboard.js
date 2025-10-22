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
          count: { $sum: 1 }
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
        avgResults: Math.round(stats.avgResults || 0)
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

module.exports = router;


