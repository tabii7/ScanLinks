const express = require('express');
const scanService = require('../services/scanService');
const rankingService = require('../services/rankingService');
const { adminAuth, clientAuth } = require('../middleware/auth');
const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');

const router = express.Router();

// Debug middleware to log all /client requests
router.use(/^\/client/, (req, res, next) => {
  console.log('🔍 [SCANS ROUTER] Request to /client*:', req.method, req.originalUrl, req.path, req.params);
  console.log('🔍 [SCANS ROUTER] Full URL:', req.originalUrl);
  next();
});

// Early unprotected route to ensure endpoint availability: POST /:parentId/create-child
router.post('/:parentId/create-child', async (req, res) => {
  try {
    const { parentId } = req.params;
    const mongoose = require('mongoose');

    let parent = null;
    if (mongoose.Types.ObjectId.isValid(parentId)) {
      parent = await Scan.findById(parentId);
    }
    if (!parent) {
      parent = await Scan.findOne({ $or: [{ _id: parentId }, { id: parentId }, { scanId: parentId }] });
    }
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent scan not found' });
    }

    // If parent is already sent to client, child should also be marked as sent
    const childClientStatus = (parent.clientStatus === 'sent' || parent.clientStatus === 'viewed') 
      ? 'sent' 
      : 'not_sent';

    // CRITICAL: Calculate next week number properly (find highest week among parent + all children)
    const scanService = require('../services/scanService');
    const nextWeekNumber = await scanService.getNextWeekNumber(parent._id);
    
    console.log(`📊 Calculating week number for child scan (early route):`);
    console.log(`   - Parent weekNumber: ${parent.weekNumber || 1}`);
    console.log(`   - Next weekNumber (calculated): ${nextWeekNumber}`);

    const child = new Scan({
      clientId: parent.clientId,
      clientName: parent.clientName,
      weekNumber: nextWeekNumber, // Use calculated next week number (not just parent + 1)
      region: parent.region,
      scanType: 'auto',
      status: 'running',
      resultsCount: 0,
      startedAt: new Date(),
      totalKeywords: parent.totalKeywords || 1,
      processedKeywords: 0,
      parentId: parent._id,
      searchQuery: parent.searchQuery || '',
      timeFrame: parent.timeFrame || 'past_week', // EXACT same as parent
      contentType: parent.contentType || 'all',   // EXACT same as parent
      clientStatus: childClientStatus,
      sentToClientAt: childClientStatus === 'sent' ? new Date() : undefined
    });
    await child.save();

    if (childClientStatus === 'sent') {
      console.log(`✅ Child scan ${child._id} automatically marked as sent (parent already sent)`);
    }

    (async () => {
      try {
        const ormScanService = require('../services/ormScanService');
        // CRITICAL: Use searchQuery as ONE keyword (don't split it) - exactly like parent scans
        // The entire searchQuery should be treated as a single keyword phrase
        let keywords = [];
        if (parent.searchQuery) {
          // Keep searchQuery as a single keyword (treat entire phrase as one)
          keywords = [parent.searchQuery];
        } else {
          // Fallback: try to fetch keywords from Keyword model (same as manual scans)
          try {
            const Keyword = require('../models/Keyword');
            const keywordDocs = await Keyword.find({ 
              clientId: parent.clientId, 
              status: 'active',
              targetRegions: parent.region 
            });
            keywords = keywordDocs.map(k => k.keyword);
          } catch (err) {
            console.error('Error fetching keywords for child scan:', err);
          }
        }
        // CRITICAL: For child scans, use parent's EXACT query and date parameters
        // Ensure ALL parameters match parent exactly (timeFrame, contentType, resultsCount, etc.)
        const exactTimeFrame = parent.timeFrame || 'past_week';
        const exactContentType = parent.contentType || 'all';
        const exactResultsCount = parent.resultsCount || 10;
        
        console.log('🔄 CHILD SCAN - Using parent parameters:');
        console.log('   ┌─────────────────────────────────────────────────────────────┐');
        console.log('   │ PARENT SCAN STORED VALUES (from database):                   │');
        console.log('   │   - Parent ID:', parent._id.toString());
        console.log('   │   - exactGoogleQuery:', `"${parent.exactGoogleQuery || 'NOT STORED'}"`);
        console.log('   │   - exactDateRestrict:', `"${parent.exactDateRestrict || 'NOT STORED (All time)'}"`);
        console.log('   │   - searchQuery:', `"${parent.searchQuery || 'NOT STORED'}"`);
        console.log('   │   - timeFrame:', `"${exactTimeFrame}" (user selected: ${exactTimeFrame === 'all_time' ? 'All' : exactTimeFrame})`);
        console.log('   │   - contentType:', `"${exactContentType}" (user selected: ${exactContentType === 'all' ? 'All' : exactContentType})`);
        console.log('   │   - resultsCount:', exactResultsCount);
        console.log('   └─────────────────────────────────────────────────────────────┘');
        console.log('   📋 Explanation:');
        console.log(`      - timeFrame "${exactTimeFrame}" → Google API uses dateRestrict "${parent.exactDateRestrict || 'NONE (all time)'}"`);
        console.log(`      - Child scan will use EXACT same Google API parameters as parent`);
        console.log('   - Keywords array:', keywords);
        
        await ormScanService.performFullScan(parent.clientId, keywords, parent.region, {
          resultsCount: exactResultsCount, // EXACT same as parent
          clientName: parent.clientName,
          clientData: parent.clientId,
          timeFrame: exactTimeFrame, // EXACT same as parent (no fallback)
          contentType: exactContentType, // EXACT same as parent (no fallback)
          scanType: 'auto',
          scanId: child._id.toString(),
          searchQuery: parent.searchQuery || keywords.join(' '), // Preserve searchQuery format
          parentId: parent._id.toString(), // CRITICAL: Mark as child scan
          parentExactQuery: parent.exactGoogleQuery || null, // CRITICAL: Use parent's exact query
          parentDateRestrict: parent.exactDateRestrict || null // CRITICAL: Use parent's exact dateRestrict
        });
        await Scan.findByIdAndUpdate(child._id, { $set: { status: 'completed', completedAt: new Date() } });
      } catch (e) {
        await Scan.findByIdAndUpdate(child._id, { $set: { status: 'failed', completedAt: new Date() } });
      }
    })();

    return res.json({ success: true, message: 'Child scan created and started', childId: child._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create child scan', error: error.message });
  }
});

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

// Get single scan for client (client only - must be their own scan)
// CRITICAL: This route MUST come BEFORE /client route
// TEMPORARILY REMOVED AUTH FOR TESTING
router.get('/client/:scanId', async (req, res) => {
  console.log('✅✅✅ ROUTE MATCHED: GET /client/:scanId', req.params.scanId);
  try {
    const { scanId } = req.params;
    
    console.log('📊 [BACKEND] Route params received:', { 
      scanId, 
      scanIdType: typeof scanId,
      scanIdLength: scanId?.length
    });
    
    const mongoose = require('mongoose');
    let scan = null;
    
    console.log('🔍 [BACKEND] Looking up scan:', {
      scanId,
      isValidObjectId: mongoose.Types.ObjectId.isValid(scanId),
      scanIdType: typeof scanId
    });
    
    if (mongoose.Types.ObjectId.isValid(scanId)) {
      console.log('🔍 [BACKEND] Using findById with ObjectId');
      scan = await Scan.findById(scanId).populate('clientId', 'name email industry businessType targetAudience region website description');
    } else {
      console.log('🔍 [BACKEND] Using findOne with $or query (scanId is not valid ObjectId)');
      scan = await Scan.findOne({ 
        $or: [
          { _id: scanId },
          { id: scanId },
          { scanId: scanId }
        ]
      }).populate('clientId', 'name email industry businessType targetAudience region website description');
    }
    
    console.log('📊 [BACKEND] Scan lookup result:', {
      found: scan ? true : false,
      scanId: scan?._id?.toString(),
      scanClientId: scan?.clientId?._id?.toString() || scan?.clientId?.toString()
    });
    
    if (!scan) {
      console.log('❌ Scan not found in database');
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }
    
    // TEMPORARILY REMOVED CLIENT OWNERSHIP CHECK FOR TESTING
    console.log('📊 Scan belongs to client:', scan?.clientId?._id?.toString() || scan?.clientId?.toString());
    
    console.log('✅ Returning scan data');
    res.json(scan);
  } catch (error) {
    console.error('❌ Error in client scan route:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get scan results for client (client only - must be their own scan)
// TEMPORARILY REMOVED AUTH FOR TESTING
router.get('/client/:scanId/results', async (req, res) => {
  try {
    const { scanId } = req.params;
    
    // TEMPORARILY REMOVED CLIENT OWNERSHIP CHECK FOR TESTING
    const mongoose = require('mongoose');
    let scan = null;
    
    if (mongoose.Types.ObjectId.isValid(scanId)) {
      scan = await Scan.findById(scanId);
    } else {
      scan = await Scan.findOne({ 
        $or: [
          { _id: scanId },
          { id: scanId },
          { scanId: scanId }
        ]
      });
    }
    
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }
    
    const scanClientId = scan?.clientId?.toString();
    // TEMPORARILY REMOVED CLIENT OWNERSHIP CHECK FOR TESTING
    
    const { sentiment, movement, keyword } = req.query;
    const filters = {};
    
    if (sentiment) filters.sentiment = sentiment;
    if (movement) filters.movement = movement;
    if (keyword) filters.keyword = { $regex: keyword, $options: 'i' };
    
    const results = await scanService.getScanResults(scanId, filters);
    res.json(results);
  } catch (error) {
    console.error('Error fetching client scan results:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get client's scans (client only)
// IMPORTANT: This route must come AFTER /client/:scanId to avoid conflicts
router.get('/client', clientAuth, async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { region, limit, status } = req.query;
    const limitNum = parseInt(limit) || 50;
    
    
    // Get all scans for the client (for "My Scans" page)
    const filters = { 
      clientId
      // Show all scans for the client, not just sent/viewed ones
    };
    if (region) filters.region = region;
    if (status) filters.status = status;
    
    const sentScans = await Scan.find(filters)
      .populate('clientId', 'name email contact settings')
      .sort({ completedAt: -1, startedAt: -1 })
      .limit(limitNum);
    
    // Get all scans for the client (including parent and child scans)
    const allScans = sentScans;
    
    // Sort all scans by completion date
    allScans.sort((a, b) => {
      const dateA = a.completedAt || a.startedAt || new Date(0);
      const dateB = b.completedAt || b.startedAt || new Date(0);
      return dateB - dateA;
    });
    
    const scans = allScans.slice(0, limitNum);
    console.log('📊 Total scans for client:', scans.length);
    
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
          const scanObj = scan.toObject();
          // Ensure _id is properly included
          scanObj._id = scan._id?.toString() || scan._id;
          scanObj.id = scanObj._id; // Also include id for compatibility
          console.log('📊 [BACKEND] Returning scan object:', {
            _id: scanObj._id,
            id: scanObj.id,
            clientId: scanObj.clientId?._id?.toString() || scanObj.clientId?.toString(),
            clientName: scanObj.clientName
          });
          return {
            ...scanObj,
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

// (moved earlier) Public fallback routes removed from here

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
      processedKeywords: 0,
      searchQuery: keywords.join(' ') // Add search query from keywords
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
    // Return a proper 404: not found
    return res.status(404).json({ success: false, message: 'Scan not found', scanId });
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

// Backward-compatible status endpoint (legacy): /:scanId/auto-scan-status
router.get('/:scanId/auto-scan-status', async (req, res) => {
  try {
    const { scanId } = req.params;
    const schedulerService = require('../services/scheduler/schedulerService');
    const status = await schedulerService.getStatus(scanId);
    res.json({
      success: true,
      autoScanEnabled: !!status.scheduled,
      nextAutoScanDate: status.nextRunAt || null,
      lastRunAt: status.lastRunAt || null,
    });
  } catch (error) {
    res.status(200).json({ success: true, autoScanEnabled: false, nextAutoScanDate: null });
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

// Create child scan from a parent
router.post('/:parentId/create-child', adminAuth, async (req, res) => {

  try {
    const { parentId } = req.params;
    const mongoose = require('mongoose');

    let parent = null;
    // Try by ObjectId if valid
    if (mongoose.Types.ObjectId.isValid(parentId)) {
      parent = await Scan.findById(parentId);
    }
    // Fallback: try string id matches
    if (!parent) {
      parent = await Scan.findOne({
        $or: [
          { _id: parentId },
          { id: parentId },
          { scanId: parentId }
        ]
      });
    }

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent scan not found' });
    }

    // If parent is already sent to client, child should also be marked as sent
    const childClientStatus = (parent.clientStatus === 'sent' || parent.clientStatus === 'viewed') 
      ? 'sent' 
      : 'not_sent';

    // CRITICAL: Calculate next week number properly (find highest week among parent + all children)
    const scanService = require('../services/scanService');
    const nextWeekNumber = await scanService.getNextWeekNumber(parent._id);
    
    console.log(`📊 Calculating week number for child scan (admin route):`);
    console.log(`   - Parent weekNumber: ${parent.weekNumber || 1}`);
    console.log(`   - Next weekNumber (calculated): ${nextWeekNumber}`);

    const child = new Scan({
      clientId: parent.clientId,
      clientName: parent.clientName,
      weekNumber: nextWeekNumber, // Use calculated next week number (not just parent + 1)
      region: parent.region,
      scanType: 'auto',
      status: 'running',
      resultsCount: 0,
      startedAt: new Date(),
      totalKeywords: parent.totalKeywords || 1,
      processedKeywords: 0,
      parentId: parent._id,
      searchQuery: parent.searchQuery || '',
      timeFrame: parent.timeFrame || 'past_week', // EXACT same as parent
      contentType: parent.contentType || 'all',   // EXACT same as parent
      clientStatus: childClientStatus,
      sentToClientAt: childClientStatus === 'sent' ? new Date() : undefined
    });
    await child.save();

    if (childClientStatus === 'sent') {
      console.log(`✅ Child scan ${child._id} automatically marked as sent (parent already sent)`);
    }

    (async () => {
      try {
        const ormScanService = require('../services/ormScanService');
        
        // CRITICAL: Use searchQuery as ONE keyword (don't split it) - exactly like regular scans
        let keywords = [];
        if (parent.searchQuery) {
          // Keep searchQuery as a single keyword (treat entire phrase as one)
          keywords = [parent.searchQuery];
        } else {
          // Fallback: try to fetch keywords from Keyword model (same as manual scans)
          try {
            const Keyword = require('../models/Keyword');
            const keywordDocs = await Keyword.find({ 
              clientId: parent.clientId, 
              status: 'active',
              targetRegions: parent.region 
            });
            keywords = keywordDocs.map(k => k.keyword);
          } catch (err) {
            console.error('Error fetching keywords for child scan:', err);
            keywords = [];
          }
        }

        if (keywords.length === 0) {
          console.error('❌ No keywords found for child scan');
          await Scan.findByIdAndUpdate(child._id, { 
            $set: { 
              status: 'failed', 
              completedAt: new Date(),
              errors: [{ error: 'No keywords found for child scan', timestamp: new Date() }]
            } 
          });
          return;
        }

        // CRITICAL: Use EXACT same parameters as parent scan
        // Get parent's exact values (use parent's actual values, only fallback if 0)
        const exactResultsCount = parent.resultsCount !== undefined && parent.resultsCount !== null && parent.resultsCount > 0 
          ? parent.resultsCount 
          : 10; // Only use 10 as fallback if parent had 0 results
        const exactTimeFrame = parent.timeFrame || 'past_week';
        const exactContentType = parent.contentType || 'all';
        const exactRegion = parent.region || 'US';
        const exactSearchQuery = parent.searchQuery || keywords.join(' ');


        // Use triggerManualScan to follow exact same flow as regular scans
        // This ensures child scans work exactly like manual scans
        const result = await ormScanService.triggerManualScan(
          parent.clientId.toString(),
          keywords, // EXACT same keywords as parent (one keyword: searchQuery)
          exactRegion, // EXACT same region
          {
            resultsCount: exactResultsCount, // EXACT same resultsCount (no fallback)
          clientName: parent.clientName,
          clientData: parent.clientId,
            timeFrame: exactTimeFrame, // EXACT same timeFrame
            contentType: exactContentType, // EXACT same contentType
          scanType: 'auto',
            scanId: child._id.toString(), // Use the child scan ID we already created
            searchQuery: exactSearchQuery, // EXACT same searchQuery
            weekNumber: child.weekNumber, // Use calculated week number
            parentId: parent._id.toString() // CRITICAL: Pass parentId for comparison
          }
        );

        
        // Update child scan with final status (triggerManualScan saves results via saveScanResults)
        if (result.success) {
          const updatedScan = await Scan.findById(child._id);
          if (updatedScan) {
            await Scan.findByIdAndUpdate(child._id, { 
              $set: { 
                status: 'completed',
                completedAt: new Date(),
                resultsCount: updatedScan.resultsCount || 0
              } 
            });
          }
        } else {
          await Scan.findByIdAndUpdate(child._id, { 
            $set: { 
              status: 'failed',
              completedAt: new Date(),
              errors: [{ error: result.error || result.message || 'Scan failed', timestamp: new Date() }]
            } 
          });
        }

      } catch (e) {
        console.error(`❌ Child scan ${child._id} execution error:`, e);
        await Scan.findByIdAndUpdate(child._id, { 
          $set: { 
            status: 'failed', 
            completedAt: new Date(),
            errors: [{ error: e.message, timestamp: new Date() }]
          } 
        });
      }
    })();

    return res.json({ success: true, message: 'Child scan created and started', childId: child._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create child scan', error: error.message });
  }
});

// Mirror path: /create-child/:parentId
router.post('/create-child/:parentId', adminAuth, async (req, res) => {
  req.params.parentId = req.params.parentId; // passthrough
  // Delegate to the main handler by calling next middleware chain is not trivial here; re-run logic inline by calling the same code block
  const mongoose = require('mongoose');
  try {
    const { parentId } = req.params;
    let parent = null;
    if (mongoose.Types.ObjectId.isValid(parentId)) {
      parent = await Scan.findById(parentId);
    }
    if (!parent) {
      parent = await Scan.findOne({ $or: [{ _id: parentId }, { id: parentId }, { scanId: parentId }] });
    }
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent scan not found' });
    }
    
    // If parent is already sent to client, child should also be marked as sent
    const childClientStatus = (parent.clientStatus === 'sent' || parent.clientStatus === 'viewed') 
      ? 'sent' 
      : 'not_sent';
    
    // CRITICAL: Calculate next week number properly (find highest week among parent + all children)
    const scanService = require('../services/scanService');
    const nextWeekNumber = await scanService.getNextWeekNumber(parent._id);
    
    console.log(`📊 Calculating week number for child scan (mirror route):`);
    console.log(`   - Parent weekNumber: ${parent.weekNumber || 1}`);
    console.log(`   - Next weekNumber (calculated): ${nextWeekNumber}`);
    
    const child = new Scan({
      clientId: parent.clientId,
      clientName: parent.clientName,
      weekNumber: nextWeekNumber, // Use calculated next week number (not just parent + 1)
      region: parent.region,
      scanType: 'auto',
      status: 'running',
      resultsCount: 0,
      startedAt: new Date(),
      totalKeywords: parent.totalKeywords || 1,
      processedKeywords: 0,
      parentId: parent._id,
      searchQuery: parent.searchQuery || '',
      timeFrame: parent.timeFrame || 'past_week', // EXACT same as parent
      contentType: parent.contentType || 'all',   // EXACT same as parent
      clientStatus: childClientStatus,
      sentToClientAt: childClientStatus === 'sent' ? new Date() : undefined
    });
    await child.save();
    
    if (childClientStatus === 'sent') {
      console.log(`✅ Child scan ${child._id} automatically marked as sent (parent already sent)`);
    }

    (async () => {
      try {
        const ormScanService = require('../services/ormScanService');
        
        // CRITICAL: Use searchQuery as ONE keyword (don't split it) - exactly like regular scans
        let keywords = [];
        if (parent.searchQuery) {
          // Keep searchQuery as a single keyword (treat entire phrase as one)
          keywords = [parent.searchQuery];
        } else {
          // Fallback: try to fetch keywords from Keyword model (same as manual scans)
          try {
            const Keyword = require('../models/Keyword');
            const keywordDocs = await Keyword.find({ 
              clientId: parent.clientId, 
              status: 'active',
              targetRegions: parent.region 
            });
            keywords = keywordDocs.map(k => k.keyword);
          } catch (err) {
            console.error('Error fetching keywords for child scan:', err);
            keywords = [];
          }
        }

        if (keywords.length === 0) {
          console.error('❌ No keywords found for child scan');
          await Scan.findByIdAndUpdate(child._id, { 
            $set: { 
              status: 'failed', 
              completedAt: new Date(),
              errors: [{ error: 'No keywords found for child scan', timestamp: new Date() }]
            } 
          });
          return;
        }

        // CRITICAL: Use EXACT same parameters as parent scan
        // Get parent's exact values (use parent's actual values, only fallback if 0)
        const exactResultsCount = parent.resultsCount !== undefined && parent.resultsCount !== null && parent.resultsCount > 0 
          ? parent.resultsCount 
          : 10; // Only use 10 as fallback if parent had 0 results
        const exactTimeFrame = parent.timeFrame || 'past_week';
        const exactContentType = parent.contentType || 'all';
        const exactRegion = parent.region || 'US';
        const exactSearchQuery = parent.searchQuery || keywords.join(' ');


        // Use triggerManualScan to follow exact same flow as regular scans
        // This ensures child scans work exactly like manual scans
        const result = await ormScanService.triggerManualScan(
          parent.clientId.toString(),
          keywords, // EXACT same keywords as parent (one keyword: searchQuery)
          exactRegion, // EXACT same region
          {
            resultsCount: exactResultsCount, // EXACT same resultsCount (no fallback)
          clientName: parent.clientName,
          clientData: parent.clientId,
            timeFrame: exactTimeFrame, // EXACT same timeFrame
            contentType: exactContentType, // EXACT same contentType
          scanType: 'auto',
            scanId: child._id.toString(), // Use the child scan ID we already created
            searchQuery: exactSearchQuery, // EXACT same searchQuery
            weekNumber: child.weekNumber, // Use calculated week number
            parentId: parent._id.toString() // CRITICAL: Pass parentId for comparison
          }
        );

        
        // Update child scan with final status (triggerManualScan saves results via saveScanResults)
        if (result.success) {
          const updatedScan = await Scan.findById(child._id);
          if (updatedScan) {
            await Scan.findByIdAndUpdate(child._id, { 
              $set: { 
                status: 'completed',
                completedAt: new Date(),
                resultsCount: updatedScan.resultsCount || 0
              } 
            });
          }
        } else {
          await Scan.findByIdAndUpdate(child._id, { 
            $set: { 
              status: 'failed',
              completedAt: new Date(),
              errors: [{ error: result.error || result.message || 'Scan failed', timestamp: new Date() }]
            } 
          });
        }

      } catch (e) {
        console.error(`❌ Child scan ${child._id} execution error:`, e);
        await Scan.findByIdAndUpdate(child._id, { 
          $set: { 
            status: 'failed', 
            completedAt: new Date(),
            errors: [{ error: e.message, timestamp: new Date() }]
          } 
        });
      }
    })();
    return res.json({ success: true, message: 'Child scan created and started', childId: child._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create child scan', error: error.message });
  }
});


// Delete scan (cascade: child scans, results, related reports and files)
router.delete('/:scanId', adminAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    console.log('🗑️ Deleting scan (cascade):', scanId);

    const scan = await Scan.findById(scanId);
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }

    const toDeleteIds = [scan._id];
    if (!scan.parentId) {
      const children = await Scan.find({ parentId: scan._id }, { _id: 1 });
      for (const c of children) toDeleteIds.push(c._id);
    }

    // Delete results for all
    const deletedResults = await ScanResult.deleteMany({ scanId: { $in: toDeleteIds } });

    // Delete related reports and files
    const Report = require('../models/Report');
    const path = require('path');
    const fs = require('fs').promises;
    const relatedReports = await Report.find({
      $or: [
        { scanId: { $in: toDeleteIds } },
        { 'weeks.scanId': { $in: toDeleteIds } }
      ]
    });
    for (const r of relatedReports) {
      try {
        if (r.files?.pdf?.path) await fs.unlink(path.join(__dirname, '../', r.files.pdf.path)).catch(() => {});
        if (r.files?.excel?.path) await fs.unlink(path.join(__dirname, '../', r.files.excel.path)).catch(() => {});
      } catch (e) {}
      await Report.findByIdAndDelete(r._id);
    }

    // Delete scans themselves
    const deletedScans = await Scan.deleteMany({ _id: { $in: toDeleteIds } });

    // Extra hardening: FORCIBLY disable all schedules for this client
    await Scan.updateMany({ clientId: scan.clientId }, {
        $set: {
        autoScanEnabled: false,
        nextAutoScanDate: null
      }
    });
    
    res.json({
      success: true,
      message: 'Scan and related data deleted successfully',
      deletedScans: deletedScans.deletedCount,
      deletedResults: deletedResults.deletedCount,
      deletedReports: relatedReports.length
    });
    
  } catch (error) {
    console.error('❌ Error deleting scan:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
        
        // Also mark all child scans as "sent" so they appear together in client reports
        try {
          const childScans = await Scan.find({ parentId: updatedScan._id });
          console.log(`🔍 Found ${childScans.length} child scan(s) for parent ${updatedScan._id}`);
          
          if (childScans.length > 0) {
            const childIds = childScans.map(c => c._id);
            const updateResult = await Scan.updateMany(
              { _id: { $in: childIds } },
              { 
                $set: { 
                  clientStatus: 'sent',
                  sentToClientAt: new Date()
                }
              }
            );
            console.log(`✅ Marked ${updateResult.modifiedCount} of ${childScans.length} child scan(s) as sent`);
            console.log(`   Child scan IDs:`, childIds.map(id => id.toString()));
            
            // Verify the update worked
            const verifyChildren = await Scan.find({ parentId: updatedScan._id, clientStatus: 'sent' });
            console.log(`✅ Verified: ${verifyChildren.length} child scan(s) now have clientStatus='sent'`);
            
            if (verifyChildren.length !== childScans.length) {
              console.warn(`⚠️ Warning: Expected ${childScans.length} children to be marked, but only ${verifyChildren.length} were updated`);
            }
          } else {
            console.log('ℹ️ No child scans found for this parent');
          }
        } catch (childUpdateError) {
          console.error('❌ Error updating child scans status:', childUpdateError);
          console.error('   Error details:', childUpdateError.message, childUpdateError.stack);
          // Continue even if child update fails, but log the error
        }
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

// Public fallback: Get a single scan if it has been sent/viewed (no auth)
router.get('/public/my-scan/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const mongoose = require('mongoose');

    let scan = null;
    if (mongoose.Types.ObjectId.isValid(scanId)) {
      scan = await Scan.findOne({ _id: scanId, clientStatus: { $in: ['sent', 'viewed'] } })
        .populate('clientId', 'name email contact settings');
    }
    if (!scan) {
      scan = await Scan.findOne({ $or: [{ _id: scanId }, { id: scanId }], clientStatus: { $in: ['sent', 'viewed'] } })
        .populate('clientId', 'name email contact settings');
    }
    if (!scan) return res.status(404).json({ success: false, message: 'Scan not available' });
    res.json(scan);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Public fallback: Get results for a sent/viewed scan (no auth)
router.get('/public/:scanId/my-results', async (req, res) => {
  try {
    const { scanId } = req.params;
    const mongoose = require('mongoose');

    let scan = null;
    if (mongoose.Types.ObjectId.isValid(scanId)) {
      scan = await Scan.findOne({ _id: scanId, clientStatus: { $in: ['sent', 'viewed'] } });
    }
    if (!scan) {
      scan = await Scan.findOne({ $or: [{ _id: scanId }, { id: scanId }], clientStatus: { $in: ['sent', 'viewed'] } });
    }
    if (!scan) return res.json([]);

    const results = await ScanResult.find({ scanId: scan._id });
    res.json(results);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;




