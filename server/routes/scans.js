const express = require('express');
const scanService = require('../services/scanService');
const rankingService = require('../services/rankingService');
const autoScanService = require('../services/autoScanService');
const { adminAuth, clientAuth } = require('../middleware/auth');
const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');

const router = express.Router();

// Get all scans (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { region, limit, status } = req.query;
    const limitNum = parseInt(limit) || 20;
    
    const filters = {};
    if (region) filters.region = region;
    if (status) filters.status = status;
    
    const scans = await scanService.getAllScans(filters, limitNum);
    console.log('📊 Backend returning scans:', scans.length, 'scans');
    console.log('📊 First scan sample:', scans[0] || 'No scans found');
    res.json(scans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get client's scans (client only)
router.get('/client', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { region, limit, status } = req.query;
    const limitNum = parseInt(limit) || 50;
    
    console.log('🔍 Fetching scans for client:', clientId);
    
    const filters = { 
      clientId,
      clientStatus: { $in: ['sent', 'viewed'] } // Only show scans that have been sent to client
    };
    if (region) filters.region = region;
    if (status) filters.status = status;
    
    const scans = await Scan.find(filters)
      .populate('clientId', 'name email contact settings')
      .sort({ completedAt: -1, startedAt: -1 })
      .limit(limitNum);
    
    console.log('📊 Found scans for client:', scans.length);
    
    // Mark scans as "viewed" if they were previously "sent"
    const scansToUpdate = scans.filter(scan => scan.clientStatus === 'sent');
    if (scansToUpdate.length > 0) {
      const scanIds = scansToUpdate.map(scan => scan._id);
      await Scan.updateMany(
        { _id: { $in: scanIds } },
        { 
          $set: { 
            clientStatus: 'viewed',
            viewedByClientAt: new Date()
          }
        }
      );
      console.log('✅ Marked', scansToUpdate.length, 'scans as viewed by client');
    }
    
    // Get results for each scan to include sentiment stats
    const scansWithResults = await Promise.all(
      scans.map(async (scan) => {
        try {
          const results = await ScanResult.find({ scanId: scan._id });
          return {
            ...scan.toObject(),
            results: results
          };
        } catch (error) {
          console.error('Error fetching results for scan:', scan._id, error);
          return {
            ...scan.toObject(),
            results: []
          };
        }
      })
    );
    
    res.json(scansWithResults);
  } catch (error) {
    console.error('Error fetching client scans:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new scan record
router.post('/', adminAuth, async (req, res) => {
  try {
    const { clientId, clientName, keywords, region, scanType, resultsCount } = req.body;

    console.log('🔍 Creating scan with data:', {
      clientId,
      clientName,
      keywords: keywords?.length,
      region,
      scanType
    });

    if (!clientId || !keywords || !region) {
      return res.status(400).json({ 
        success: false,
        message: 'Client ID, keywords, and region are required' 
      });
    }

    // Create actual scan record in database
    const mongoose = require('mongoose');
    const currentWeek = 1; // Start with week 1 for new scans
    
    const scan = new Scan({
      clientId: new mongoose.Types.ObjectId(clientId),
      clientName: clientName,
      weekNumber: currentWeek,
      region: region,
      scanType: scanType || 'manual',
      status: 'running',
      resultsCount: 0,
      startedAt: new Date(),
      totalKeywords: keywords.length,
      processedKeywords: 0
    });
    
    await scan.save();
    
    console.log('✅ Created scan with clientId:', scan.clientId);
    console.log('✅ Created scan with clientName:', scan.clientName);
    
    res.json({ 
      success: true,
      message: 'Scan created successfully',
      scan: {
        _id: scan._id,
        id: scan._id,
        clientId: scan.clientId,
        clientName: scan.clientName,
        region: scan.region,
        scanType: scan.scanType,
        status: scan.status,
        createdAt: scan.startedAt.toISOString(),
        completedAt: null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to create scan', 
      error: error.message 
    });
  }
});

// Trigger manual scan (admin)
router.post('/trigger', adminAuth, async (req, res) => {
  try {
    const { clientId, region } = req.body;

    if (!clientId || !region) {
      return res.status(400).json({ message: 'Client ID and region are required' });
    }

    const result = await scanService.runScan(clientId, region, 'manual');
    res.json({ message: 'Scan triggered successfully', result });
  } catch (error) {
    res.status(500).json({ message: 'Scan failed', error: error.message });
  }
});

// Get scan history for a client (admin)
router.get('/client/:clientId', adminAuth, async (req, res) => {
  try {
    const { region, limit } = req.query;
    const filters = { region };
    const limitNum = parseInt(limit) || 10;

    const scans = await scanService.getScanHistory(req.params.clientId, region, limitNum);
    res.json(scans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get scan history for current client
router.get('/my-scans', clientAuth, async (req, res) => {
  try {
    const { region, limit } = req.query;
    const limitNum = parseInt(limit) || 10;

    const scans = await scanService.getScanHistory(req.user.clientId, region, limitNum);
    res.json(scans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single scan
router.get('/:scanId', adminAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    
    // Try to find the scan in the database
    try {
      // Check if scanId is a valid ObjectId
      const mongoose = require('mongoose');
      let scan = null;
      
      try {
        new mongoose.Types.ObjectId(scanId);
        // Valid ObjectId, try to find by ID
        scan = await Scan.findById(scanId).populate('clientId', 'name email industry businessType targetAudience region website description');
      } catch (e) {
        // Not a valid ObjectId, try to find by string ID or other fields
        console.log('❌ Invalid ObjectId format, trying alternative search:', scanId);
        scan = await Scan.findOne({ 
          $or: [
            { _id: scanId },
            { id: scanId },
            { scanId: scanId }
          ]
        }).populate('clientId', 'name email industry businessType targetAudience region website description');
      }
      
      if (scan) {
        console.log('✅ Found scan in database:', {
          scanId: scan._id,
          clientId: scan.clientId,
          clientName: scan.clientName,
          populatedClient: scan.clientId?.name
        });
        res.json(scan);
        return;
      }
    } catch (dbError) {
      console.log('Scan not found in database, using fallback data');
    }
    
    // Fallback to demo data if not found in database
    console.log('⚠️ Using fallback data for scan:', scanId);
    const scanResponse = {
      _id: scanId,
      id: scanId,
      clientId: {
        _id: 'demo-client',
        name: 'Unknown Client',
        email: 'unknown@example.com'
      },
      clientName: 'Unknown Client',
      region: 'US',
      scanType: 'manual',
      status: 'completed',
      resultsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    
    res.json(scanResponse);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get scan results
router.get('/:scanId/results', adminAuth, async (req, res) => {
  try {
    const { sentiment, movement, keyword } = req.query;
    const filters = {};

    if (sentiment) filters.sentiment = sentiment;
    if (movement) filters.movement = movement;
    if (keyword) filters.keyword = { $regex: keyword, $options: 'i' };

    const results = await scanService.getScanResults(req.params.scanId, filters);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get ranking trends for a scan
router.get('/:scanId/ranking-trends', adminAuth, async (req, res) => {
  const { scanId } = req.params;
  
  try {
    console.log('📊 Fetching ranking trends for scan:', scanId);
    
    const trends = await rankingService.getRankingTrends(scanId);
    
    res.json({
      success: true,
      trends: trends
    });
  } catch (error) {
    console.error('❌ Error fetching ranking trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ranking trends',
      error: error.message
    });
  }
});

// Enable weekly auto-scan for a scan
router.post('/:scanId/enable-auto-scan', adminAuth, async (req, res) => {
  const { scanId } = req.params;
  const { keywords, region } = req.body;
  
  try {
    console.log('📅 Enabling auto-scan for scan:', scanId);
    
    const scan = await Scan.findById(scanId);
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    const result = await autoScanService.scheduleWeeklyScan(
      scanId, 
      scan.clientId, 
      keywords || ['scan'], 
      region || scan.region
    );
    
    res.json({
      success: true,
      message: 'Weekly auto-scan enabled successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error enabling auto-scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable auto-scan',
      error: error.message
    });
  }
});

// Disable auto-scan for a scan
router.post('/:scanId/disable-auto-scan', adminAuth, async (req, res) => {
  const { scanId } = req.params;
  
  try {
    console.log('🛑 Disabling auto-scan for scan:', scanId);
    
    const result = await autoScanService.disableAutoScan(scanId);
    
    res.json({
      success: true,
      message: 'Auto-scan disabled successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error disabling auto-scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable auto-scan',
      error: error.message
    });
  }
});

// Get auto-scan status for a scan
router.get('/:scanId/auto-scan-status', adminAuth, async (req, res) => {
  const { scanId } = req.params;
  
  try {
    console.log('📊 Getting auto-scan status for scan:', scanId);
    
    const result = await autoScanService.getAutoScanStatus(scanId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting auto-scan status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get auto-scan status',
      error: error.message
    });
  }
});

// Execute pending auto-scans (admin endpoint)
router.post('/execute-auto-scans', adminAuth, async (req, res) => {
  try {
    console.log('🔄 Executing pending auto-scans...');
    
    const result = await autoScanService.checkAndExecuteAutoScans();
    
    res.json({
      success: true,
      message: 'Auto-scans executed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error executing auto-scans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute auto-scans',
      error: error.message
    });
  }
});

// Save scan results
router.post('/:scanId/results', adminAuth, async (req, res) => {
  try {
    const { results, clientData, summary } = req.body;
    const { scanId } = req.params;

    console.log('💾 Saving scan results:', {
      scanId,
      resultsCount: results?.length,
      clientName: clientData?.name,
      clientId: clientData?.clientId
    });

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ 
        success: false,
        message: 'Results array is required' 
      });
    }

    // Handle null or missing clientData
    if (!clientData) {
      console.log('⚠️ No clientData provided, using fallback');
      clientData = {
        name: 'Unknown Client',
        clientId: null,
        industry: 'Unknown',
        businessType: 'Unknown',
        targetAudience: 'Unknown',
        region: 'US',
        website: 'https://example.com',
        description: 'Unknown client'
      };
    }

    // Update the scan with results and client data
    const mongoose = require('mongoose');
    let scan;
    
    try {
      // Try to find and update existing scan
      scan = await Scan.findByIdAndUpdate(
        scanId,
        {
          $set: {
            status: 'completed',
            resultsCount: results.length,
            completedAt: new Date(),
            clientData: clientData
          }
        },
        { new: true }
      );
      
      if (!scan) {
        // Create new scan if not found
        const currentWeek = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        
        scan = new Scan({
          _id: new mongoose.Types.ObjectId(),
          clientId: clientData.clientId ? new mongoose.Types.ObjectId(clientData.clientId) : new mongoose.Types.ObjectId(),
          weekNumber: currentWeek,
          region: clientData.region || 'US',
          scanType: 'manual',
          status: 'completed',
          resultsCount: results.length,
          startedAt: new Date(),
          completedAt: new Date(),
          totalKeywords: 1,
          processedKeywords: 1
        });
        await scan.save();
      }
    } catch (error) {
      console.log('❌ Error updating scan, creating new one:', error.message);
      // Create new scan as fallback
      const currentWeek = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      
      scan = new Scan({
        clientId: clientData.clientId ? new mongoose.Types.ObjectId(clientData.clientId) : new mongoose.Types.ObjectId(),
        weekNumber: currentWeek,
        region: clientData.region || 'US',
        scanType: 'manual',
        status: 'completed',
        resultsCount: results.length,
        startedAt: new Date(),
        completedAt: new Date(),
        totalKeywords: 1,
        processedKeywords: 1
      });
      await scan.save();
    }

    // Check if scan was created successfully
    if (!scan) {
      console.error('❌ Scan creation failed, cannot save results');
      return res.status(500).json({ 
        message: 'Failed to create scan record', 
        error: 'Scan is null' 
      });
    }
    
    console.log('✅ Scan created successfully:', {
      scanId: scan._id,
      clientId: scan.clientId,
      clientName: scan.clientName
    });
    
    // Save individual results
    const savedResults = [];
    const demoKeywordId = new mongoose.Types.ObjectId();
    
    for (const result of results) {
      const scanResult = new ScanResult({
        scanId: scan._id,
        clientId: scan.clientId,
        keywordId: demoKeywordId,
        keyword: 'scan',
        title: result.title || 'No Title',
        url: result.url || result.link || 'https://example.com',
        description: result.description || result.snippet || '',
        sentiment: result.sentiment || 'neutral',
        confidence: result.confidence || 0.5,
        position: result.position || 1,
        movement: result.movement || 'new',
        rank: result.rank || result.position || 1,
        site: result.site || new URL(result.url || result.link || 'https://example.com').hostname,
        region: clientData.region || 'US',
        analyzedAt: new Date()
      });
      await scanResult.save();
      savedResults.push(scanResult);
    }

    console.log('✅ Saved scan results successfully:', {
      scanId: scan._id,
      resultsCount: savedResults.length,
      clientName: clientData.name
    });

    res.json({ 
      success: true,
      message: 'Scan results saved successfully',
      resultsCount: savedResults.length,
      scanId: scan._id,
      clientName: clientData.name
    });
  } catch (error) {
    console.error('❌ Error saving scan results:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to save scan results', 
      error: error.message 
    });
  }
});

// Get single scan for current client
router.get('/my-scan/:scanId', clientAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    const clientId = req.user.clientId;
    
    console.log('🔍 Client fetching scan details:', { scanId, clientId });
    
    // Find the scan and verify it belongs to the client
    const scan = await Scan.findOne({ 
      _id: scanId, 
      clientId: clientId,
      clientStatus: { $in: ['sent', 'viewed'] } // Only show scans that have been sent to client
    }).populate('clientId', 'name email contact settings');
    
    if (!scan) {
      return res.status(404).json({ 
        message: 'Scan not found or access denied',
        scanId: scanId,
        clientId: clientId
      });
    }
    
    console.log('✅ Found scan for client:', {
      scanId: scan._id,
      clientName: scan.clientName,
      clientStatus: scan.clientStatus
    });
    
    // Update status to 'viewed' if it was 'sent'
    if (scan.clientStatus === 'sent') {
      await Scan.findByIdAndUpdate(scanId, {
        $set: { 
          clientStatus: 'viewed',
          viewedByClientAt: new Date()
        }
      });
      console.log('✅ Marked scan as viewed by client');
    }
    
    res.json(scan);
  } catch (error) {
    console.error('❌ Error fetching client scan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get scan results for current client
router.get('/:scanId/my-results', clientAuth, async (req, res) => {
  try {
    console.log('🔍 Client requesting scan results:', req.params.scanId);
    
    const { sentiment, movement, keyword } = req.query;
    const filters = { clientId: req.user.clientId };

    if (sentiment) filters.sentiment = sentiment;
    if (movement) filters.movement = movement;
    if (keyword) filters.keyword = { $regex: keyword, $options: 'i' };

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 8000);
    });

    const resultsPromise = scanService.getScanResults(req.params.scanId, filters);
    
    const results = await Promise.race([resultsPromise, timeoutPromise]);
    
    console.log('✅ Returning results to client:', results.length);
    res.json(results);
  } catch (error) {
    console.error('❌ Error in my-results endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get scan statistics
router.get('/:scanId/stats', adminAuth, async (req, res) => {
  try {
    const results = await scanService.getScanResults(req.params.scanId);
    
    const stats = {
      total: results.length,
      bySentiment: {
        positive: results.filter(r => r.sentiment === 'positive').length,
        negative: results.filter(r => r.sentiment === 'negative').length,
        neutral: results.filter(r => r.sentiment === 'neutral').length,
        unrelated: results.filter(r => r.sentiment === 'unrelated').length,
      },
      byMovement: {
        new: results.filter(r => r.movement === 'new').length,
        improved: results.filter(r => r.movement === 'improved').length,
        dropped: results.filter(r => r.movement === 'dropped').length,
        disappeared: results.filter(r => r.movement === 'disappeared').length,
        unchanged: results.filter(r => r.movement === 'unchanged').length,
      },
      byRank: {
        top3: results.filter(r => r.rank <= 3).length,
        top5: results.filter(r => r.rank <= 5).length,
        top10: results.filter(r => r.rank <= 10).length,
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get scan statistics for current client
router.get('/:scanId/my-stats', clientAuth, async (req, res) => {
  try {
    const results = await scanService.getScanResults(req.params.scanId, { clientId: req.user.clientId });
    
    const stats = {
      total: results.length,
      bySentiment: {
        positive: results.filter(r => r.sentiment === 'positive').length,
        negative: results.filter(r => r.sentiment === 'negative').length,
        neutral: results.filter(r => r.sentiment === 'neutral').length,
        unrelated: results.filter(r => r.sentiment === 'unrelated').length,
      },
      byMovement: {
        new: results.filter(r => r.movement === 'new').length,
        improved: results.filter(r => r.movement === 'improved').length,
        dropped: results.filter(r => r.movement === 'dropped').length,
        disappeared: results.filter(r => r.movement === 'disappeared').length,
        unchanged: results.filter(r => r.movement === 'unchanged').length,
      },
      byRank: {
        top3: results.filter(r => r.rank <= 3).length,
        top5: results.filter(r => r.rank <= 5).length,
        top10: results.filter(r => r.rank <= 10).length,
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update scan result notes
router.patch('/results/:resultId/notes', adminAuth, async (req, res) => {
  try {
    const { notes } = req.body;
    const ScanResult = require('../models/ScanResult');
    
    const result = await ScanResult.findByIdAndUpdate(
      req.params.resultId,
      { notes },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Scan result not found' });
    }

    res.json({ message: 'Notes updated successfully', result });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark result as suppressed
router.patch('/results/:resultId/suppress', adminAuth, async (req, res) => {
  try {
    const ScanResult = require('../models/ScanResult');
    
    const result = await ScanResult.findByIdAndUpdate(
      req.params.resultId,
      { 
        isSuppressed: true,
        suppressionDate: new Date()
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Scan result not found' });
    }

    res.json({ message: 'Result marked as suppressed', result });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save results to database
router.post('/save-results', async (req, res) => {
  try {
    const { scanId, query, results, clientData } = req.body;
    
    console.log('💾 Saving results to database:', {
      scanId,
      query,
      resultsCount: results.length,
      clientName: clientData?.name,
      clientId: clientData?.clientId,
      fullClientData: clientData
    });
    
    // Handle null or missing clientData
    if (!clientData) {
      console.log('⚠️ No clientData provided, using fallback');
      clientData = {
        name: 'Unknown Client',
        clientId: null,
        industry: 'Unknown',
        businessType: 'Unknown',
        targetAudience: 'Unknown',
        region: 'US',
        website: 'https://example.com',
        description: 'Unknown client'
      };
    }
    
    // Create or update scan record
    let scan = null;
    try {
      // Check if scanId is a valid ObjectId
      const mongoose = require('mongoose');
      let isValidObjectId = false;
      try {
        new mongoose.Types.ObjectId(scanId);
        isValidObjectId = true;
      } catch (e) {
        console.log('❌ Invalid ObjectId format:', scanId);
      }
      
         if (isValidObjectId) {
           // Try to find existing scan by ID (if it's a valid ObjectId)
           scan = await Scan.findByIdAndUpdate(
             scanId,
      {
        $set: {
          query: query,
          status: 'completed',
          resultsCount: results.length,
          completedAt: new Date(),
          clientData: clientData
        }
      },
             { new: true }
           );
         } else {
           // If scanId is not a valid ObjectId, create a new scan
           console.log('🔄 Creating new scan for string ID:', scanId);
           
           // Create new scan with proper client data
           const currentWeek = 1; // Start with week 1 for new scans
           
           // Use clientId from clientData if available, otherwise create a demo client
           let clientId;
           let clientName = 'Unknown Client';
           
           if (clientData && clientData.clientId) {
             try {
               clientId = new mongoose.Types.ObjectId(clientData.clientId);
               console.log('✅ Using provided clientId:', clientId);
               
               // Fetch real client details from database
               const Client = require('../models/Client');
               const realClient = await Client.findById(clientId);
               if (realClient) {
                 clientName = realClient.name || realClient.contact?.name || 'Unknown Client';
                 console.log('✅ Found real client:', clientName);
               } else {
                 console.log('❌ Client not found in database, using fallback name');
               }
             } catch (e) {
               console.log('❌ Invalid clientId, creating new one:', e.message);
               clientId = new mongoose.Types.ObjectId();
             }
           } else {
             console.log('❌ No clientData.clientId provided, creating new one');
             clientId = new mongoose.Types.ObjectId();
           }
           
           console.log('🔧 About to create scan with:', {
             clientId: clientId,
             clientName: clientName,
             weekNumber: currentWeek,
             region: clientData?.region || 'US'
           });
           
           scan = new Scan({
             clientId: clientId,
             clientName: clientName,
             weekNumber: currentWeek,
             region: clientData?.region || 'US',
             scanType: 'manual',
             status: 'completed',
             resultsCount: results.length,
             startedAt: new Date(),
             completedAt: new Date(),
             totalKeywords: 1,
             processedKeywords: 1
           });
           
           console.log('🔧 Scan object created, about to save...');
           await scan.save();
           console.log('✅ Created new scan with clientId:', scan.clientId);
           console.log('✅ Scan object after creation:', {
             _id: scan._id,
             clientId: scan.clientId,
             clientName: scan.clientName
           });
           console.log('✅ Scan variable after save:', scan ? 'NOT NULL' : 'NULL');
         }
    } catch (error) {
      // If scanId is not a valid ObjectId, try to find by string ID or create new scan
      console.log('❌ ScanId not found, searching for existing scan or creating new one');
      
      // Try to find existing scan by string ID first
      scan = await Scan.findOne({ _id: scanId });
      
      if (!scan) {
        // Create new scan with proper client data
        const mongoose = require('mongoose');
        const currentWeek = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        
        // Use clientId from clientData if available, otherwise create a demo client
        let clientId;
        let clientName = 'Unknown Client';
        
        if (clientData && clientData.clientId) {
          try {
            clientId = new mongoose.Types.ObjectId(clientData.clientId);
            console.log('✅ Using provided clientId:', clientId);
            
            // Fetch real client details from database
            const Client = require('../models/Client');
            const realClient = await Client.findById(clientId);
            if (realClient) {
              clientName = realClient.name || realClient.contact?.name || 'Unknown Client';
              console.log('✅ Found real client:', clientName);
            } else {
              console.log('❌ Client not found in database, using fallback name');
            }
          } catch (e) {
            console.log('❌ Invalid clientId, creating new one:', e.message);
            clientId = new mongoose.Types.ObjectId();
          }
        } else {
          console.log('❌ No clientData.clientId provided, creating new one');
          clientId = new mongoose.Types.ObjectId();
        }
        
        console.log('🔧 About to create scan with:', {
          clientId: clientId,
          clientName: clientName,
          weekNumber: currentWeek,
          region: clientData?.region || 'US'
        });
        
        scan = new Scan({
          clientId: clientId,
          clientName: clientName,
          weekNumber: currentWeek,
          region: clientData?.region || 'US',
          scanType: 'manual',
          status: 'completed',
          resultsCount: results.length,
          startedAt: new Date(),
          completedAt: new Date(),
          totalKeywords: 1,
          processedKeywords: 1
        });
        
        console.log('🔧 Scan object created, about to save...');
        await scan.save();
        console.log('✅ Created new scan with clientId:', scan.clientId);
        console.log('✅ Scan object after creation:', {
          _id: scan._id,
          clientId: scan.clientId,
          clientName: scan.clientName
        });
        console.log('✅ Scan variable after save:', scan ? 'NOT NULL' : 'NULL');
      } else {
        // Update existing scan with client data if provided
        scan.status = 'completed';
        scan.resultsCount = results.length;
        scan.completedAt = new Date();
        
        // Update client data if provided
        if (clientData && clientData.clientId) {
          try {
            const mongoose = require('mongoose');
            scan.clientId = new mongoose.Types.ObjectId(clientData.clientId);
            
            // Fetch real client details from database
            const Client = require('../models/Client');
            const realClient = await Client.findById(scan.clientId);
            if (realClient) {
              scan.clientName = realClient.name || realClient.contact?.name || 'Unknown Client';
              console.log('✅ Updated scan with real client name:', scan.clientName);
            }
            
            console.log('✅ Updated scan with new clientId:', scan.clientId);
          } catch (e) {
            console.log('❌ Invalid clientId in update:', e.message);
          }
        }
        
        await scan.save();
        console.log('✅ Updated existing scan:', scan._id);
      }
    }
    
    // Check if scan was created successfully
    console.log('🔍 Checking scan variable before null check in save-results:', scan ? 'NOT NULL' : 'NULL');
    if (!scan) {
      console.error('❌ Scan creation failed, cannot save results');
      console.error('❌ Scan variable is null at this point in save-results');
      return res.status(500).json({ 
        message: 'Failed to create scan record', 
        error: 'Scan is null' 
      });
    }
    
    console.log('✅ Scan created successfully in save-results:', {
      scanId: scan._id,
      clientId: scan.clientId,
      clientName: scan.clientName
    });
    
    // Save individual results
    const savedResults = [];
    const mongoose = require('mongoose');
    const demoKeywordId = new mongoose.Types.ObjectId();
    
    for (const result of results) {
      const scanResult = new ScanResult({
        scanId: scan._id,
        clientId: scan.clientId,
        keywordId: demoKeywordId,
        keyword: query,
        title: result.title || 'No Title',
        url: result.link || result.url || 'https://example.com',
        description: result.snippet || '',
        rank: result.position || 1,
        sentiment: result.sentiment || 'neutral',
        sentimentScore: result.confidence || 0.5,
        movement: result.movement || 'new',
        site: result.domain || (result.link ? new URL(result.link).hostname : 'example.com'),
        region: 'US',
        dateFetched: new Date(),
        notes: result.reasoning || '',
        originalUrl: result.metadata?.originalUrl || result.link || result.url,
        snippet: result.snippet,
        position: result.position || 0,
        domain: result.domain,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'Analysis not available',
        keywords: result.keywords || [],
        category: result.category || 'other',
        relevance: result.relevance || 'medium',
        analyzedAt: result.analyzedAt || new Date(),
        isWorking: result.isWorking !== false,
        isInternal: result.isInternal || false,
        suppressed: false
      });
      
      const savedResult = await scanResult.save();
      savedResults.push(savedResult);
    }
    
    console.log('✅ Successfully saved results:', {
      scanId: scan._id,
      resultsCount: savedResults.length
    });
    
    res.json({
      message: 'Results saved successfully',
      scanId: scan._id,
      resultsCount: savedResults.length,
      results: savedResults
    });
    
  } catch (error) {
    console.error('❌ Error saving results:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Delete scan
router.delete('/:scanId', adminAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    
    console.log('🗑️ Deleting scan:', scanId);
    
    // Delete scan results first
    const deletedResults = await ScanResult.deleteMany({ scanId: scanId });
    console.log(`🗑️ Deleted ${deletedResults.deletedCount} scan results`);
    
    // Delete the scan
    const deletedScan = await Scan.findByIdAndDelete(scanId);
    
    if (!deletedScan) {
      return res.status(404).json({ 
        success: false,
        message: 'Scan not found' 
      });
    }
    
    console.log('✅ Scan deleted successfully:', scanId);
    
    res.json({
      success: true,
      message: 'Scan deleted successfully',
      deletedScanId: scanId,
      deletedResultsCount: deletedResults.deletedCount
    });
    
  } catch (error) {
    console.error('❌ Error deleting scan:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Send scan results to client portal
router.post('/send-to-client', adminAuth, async (req, res) => {
  try {
    const { scanId, query, results, clientData } = req.body;
    
    console.log('📤 Sending scan to client portal:', {
      scanId,
      clientId: clientData?.clientId,
      clientName: clientData?.name,
      resultsCount: results?.length
    });
    
    // Update the scan status to "sent"
    const mongoose = require('mongoose');
    let updatedScan = null;
    
    try {
      // Try to find and update the scan by ObjectId
      if (mongoose.Types.ObjectId.isValid(scanId)) {
        updatedScan = await Scan.findByIdAndUpdate(
          scanId,
          { 
            $set: { 
              clientStatus: 'sent',
              sentToClientAt: new Date()
            }
          },
          { new: true }
        );
      } else {
        // If not a valid ObjectId, try to find by string ID
        updatedScan = await Scan.findOneAndUpdate(
          { _id: scanId },
          { 
            $set: { 
              clientStatus: 'sent',
              sentToClientAt: new Date()
            }
          },
          { new: true }
        );
      }
      
      if (updatedScan) {
        console.log('✅ Updated scan status to sent:', {
          scanId: updatedScan._id,
          clientStatus: updatedScan.clientStatus,
          clientName: updatedScan.clientName
        });
      } else {
        console.log('⚠️ Scan not found for status update:', scanId);
      }
    } catch (updateError) {
      console.error('❌ Error updating scan status:', updateError);
      // Continue with response even if status update fails
    }
    
    res.json({
      success: true,
      message: 'Scan results sent to client portal successfully',
      scanId: scanId,
      clientId: clientData?.clientId,
      clientName: clientData?.name,
      resultsCount: results?.length,
      clientStatus: updatedScan?.clientStatus || 'sent'
    });
    
  } catch (error) {
    console.error('❌ Error sending scan to client:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;



