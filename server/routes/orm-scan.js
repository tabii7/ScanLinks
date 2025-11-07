const express = require('express');
const router = express.Router();
const ormScanService = require('../services/ormScanService');
const googleSearchService = require('../services/googleSearchService');
const sentimentAnalysisService = require('../services/sentimentAnalysisService');
const rankComparisonService = require('../services/rankComparisonService');

// Trigger manual scan
router.post('/trigger', async (req, res) => {
  try {
    const { clientId, keywords, region, options } = req.body;
    
    if (!clientId || !keywords || !Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        message: 'Client ID and keywords array are required'
      });
    }
    
    const result = await ormScanService.triggerManualScan(
      clientId, 
      keywords, 
      region || 'US', 
      options || {}
    );
    
    res.json(result);
  } catch (error) {
    console.error('Scan trigger error:', error);
    const statusCode = error.message.includes('not configured') || error.message.includes('API_NOT_CONFIGURED') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to trigger scan',
      error: error.message
    });
  }
});

// Get scan status
router.get('/status/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const status = await ormScanService.getScanStatus(scanId);
    res.json(status);
  } catch (error) {
    console.error('Scan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scan status',
      error: error.message
    });
  }
});

// Get scan results
router.get('/results/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const results = await ormScanService.getScanById(scanId);
    
    if (!results) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
    
    res.json(results);
  } catch (error) {
    console.error('Scan results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scan results',
      error: error.message
    });
  }
});

// Get scan history for a client
router.get('/history/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { region, limit } = req.query;
    
    const history = await ormScanService.getScanHistory(
      clientId, 
      region, 
      parseInt(limit) || 10
    );
    
    res.json(history);
  } catch (error) {
    console.error('Scan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scan history',
      error: error.message
    });
  }
});

// Export scan results
router.get('/export/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const { format } = req.query;
    
    const exportData = await ormScanService.exportScanResults(
      scanId, 
      format || 'json'
    );
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="scan_${scanId}.csv"`);
      res.send(exportData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="scan_${scanId}.json"`);
      res.send(exportData);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export scan results',
      error: error.message
    });
  }
});

// Delete scan
router.delete('/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const deleted = await ormScanService.deleteScan(scanId);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Scan deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }
  } catch (error) {
    console.error('Delete scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scan',
      error: error.message
    });
  }
});

// Test Google Search API
router.post('/test/google-search', async (req, res) => {
  try {
    const { 
      query, 
      region, 
      language,
      resultsCount,
      contentType,
      searchDepth,
      includeSocialMedia,
      includeNews,
      includeForums,
      includeBlogs,
      sentimentFilter,
      timeframe,
      timeframeValue,
      
      // Advanced parameters
      searchEngines,
      contentAge,
      contentQuality,
      includeVideoPlatforms,
      includeImagePlatforms,
      includeAudioPlatforms,
      includeDocumentPlatforms,
      searchRadius,
      searchRadiusValue,
      excludeDomains,
      includeDomains,
      searchOperators,
      duplicateDetection,
      contentModeration,
      privacyLevel,
      scanFrequency,
      alertThreshold,
      autoActions,
      reportFormat
    } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    console.log('🔍 Enhanced search parameters:', {
      query,
      region: region || 'US',
      language: language || 'en',
      contentType,
      searchDepth,
      sentimentFilter,
      timeframe,
      timeframeValue,
      sources: {
        socialMedia: includeSocialMedia,
        news: includeNews,
        forums: includeForums,
        blogs: includeBlogs
      },
      advanced: {
        searchEngines,
        contentAge,
        contentQuality,
        platforms: {
          video: includeVideoPlatforms,
          image: includeImagePlatforms,
          audio: includeAudioPlatforms,
          document: includeDocumentPlatforms
        },
        searchRadius,
        searchRadiusValue,
        excludeDomains,
        includeDomains,
        searchOperators,
        duplicateDetection,
        contentModeration,
        privacyLevel,
        scanFrequency,
        alertThreshold,
        autoActions,
        reportFormat
      }
    });
    
    // Convert single query to keywords array
    const keywords = [query];
    const maxResults = resultsCount || 5; // Default to 5 results for testing
    
    // Enhanced search with additional parameters
    const searchOptions = {
      region: region || 'US',
      language: language || 'en',
      contentType,
      searchDepth,
      includeSocialMedia,
      includeNews,
      includeForums,
      includeBlogs,
      sentimentFilter,
      timeframe,
      timeframeValue,
      
      // Advanced parameters
      searchEngines,
      contentAge,
      contentQuality,
      includeVideoPlatforms,
      includeImagePlatforms,
      includeAudioPlatforms,
      includeDocumentPlatforms,
      searchRadius,
      searchRadiusValue,
      excludeDomains,
      includeDomains,
      searchOperators,
      duplicateDetection,
      contentModeration,
      privacyLevel,
      scanFrequency,
      alertThreshold,
      autoActions,
      reportFormat
    };
    
    const results = await googleSearchService.searchKeywords(
      keywords, 
      searchOptions.region, 
      maxResults,
      searchOptions
    );
    
    res.json({
      success: true,
      results: results,
      count: results.length,
      query: query,
      region: searchOptions.region,
      language: searchOptions.language,
      searchOptions: searchOptions
    });
  } catch (error) {
    console.error('Google Search test error:', error);
    res.status(500).json({
      success: false,
      message: 'Google Search API test failed',
      error: error.message
    });
  }
});

// Test OpenAI Sentiment Analysis
router.post('/test/sentiment-analysis', async (req, res) => {
  try {
    const { links, clientData } = req.body;
    
    if (!links || !Array.isArray(links)) {
      return res.status(400).json({
        success: false,
        message: 'Links array is required'
      });
    }
    
    const results = await sentimentAnalysisService.analyzeSentiment(
      links, 
      clientData || {}
    );
    
    res.json({
      success: true,
      results: results,
      count: results.length
    });
  } catch (error) {
    console.error('Sentiment analysis test error:', error);
    res.status(500).json({
      success: false,
      message: 'Sentiment analysis test failed',
      error: error.message
    });
  }
});

// Test Rank Comparison
router.post('/test/rank-comparison', async (req, res) => {
  try {
    const { currentScan, previousScan } = req.body;
    
    if (!currentScan) {
      return res.status(400).json({
        success: false,
        message: 'Current scan data is required'
      });
    }
    
    const comparison = await rankComparisonService.compareRanks(
      currentScan, 
      previousScan
    );
    
    res.json({
      success: true,
      comparison: comparison
    });
  } catch (error) {
    console.error('Rank comparison test error:', error);
    res.status(500).json({
      success: false,
      message: 'Rank comparison test failed',
      error: error.message
    });
  }
});

// Get client dashboard data
router.get('/dashboard/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const dashboard = await ormScanService.getClientDashboard(clientId);
    res.json(dashboard);
  } catch (error) {
    console.error('Client dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client dashboard',
      error: error.message
    });
  }
});

// Get admin dashboard data
router.get('/dashboard/admin', async (req, res) => {
  try {
    const dashboard = await ormScanService.getAdminDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin dashboard',
      error: error.message
    });
  }
});

// Schedule weekly scans
router.post('/schedule/weekly', async (req, res) => {
  try {
    const scheduled = await ormScanService.scheduleWeeklyScans();
    
    if (scheduled) {
      res.json({
        success: true,
        message: 'Weekly scans scheduled successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to schedule weekly scans'
      });
    }
  } catch (error) {
    console.error('Schedule weekly scans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule weekly scans',
      error: error.message
    });
  }
});

module.exports = router;



