const googleSearchService = require('./googleSearchService');
const sentimentAnalysisService = require('./sentimentAnalysisService');
const rankComparisonService = require('./rankComparisonService');

class ORMScanService {
  constructor() {
    this.scanStatus = {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed'
    };
  }

  async performFullScan(clientId, keywords, region = 'US', options = {}) {
    // Global guard: optionally block non-manual executions
    if (process.env.DISABLE_AUTO_SCANS === 'true' && options && options.scanType && options.scanType !== 'manual') {
      console.log(`⛔ Auto scans disabled. performFullScan skipped for client ${clientId} (${region})`);
      return { scanId: options.scanId || this.generateScanId(), totalResults: 0, results: [], status: 'skipped' };
    }
    const scanId = options.scanId || this.generateScanId();
    const scanStartTime = new Date();
    
    try {
      console.log(`Starting ORM scan for client ${clientId} in region ${region}`);
      
      // Step 1: Search keywords using Google Custom Search API
      // Use default of 10 results if not specified
      const exactResultsCount = options.resultsCount !== undefined && options.resultsCount !== null ? options.resultsCount : 10;
      
      let searchResponse;
      let searchResults = [];
      let searchQuery = '';
      let exactGoogleQuery = '';
      let exactDateRestrict = undefined;
      
      try {
        console.log(`🔍 Calling Google Search API with:`);
        console.log(`   - Keywords: ${keywords.join(', ')}`);
        console.log(`   - Region: ${region}`);
        console.log(`   - Results count: ${exactResultsCount}`);
        console.log(`   - Time frame: ${options.timeFrame || 'past_week'}`);
        console.log(`   - Content type: ${options.contentType || 'all'}`);
        
        searchResponse = await googleSearchService.searchKeywords(keywords, region, exactResultsCount, options, options.clientName || '');
        searchResults = searchResponse.results || [];
        searchQuery = searchResponse.searchQuery || '';
        exactGoogleQuery = searchResponse.exactGoogleQuery || searchQuery;
        exactDateRestrict = searchResponse.exactDateRestrict || undefined;
        
        // CRITICAL: Log what we're storing for parent scans
        console.log(`📝 PARENT SCAN - Storing exact parameters for future child scans:`);
        console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
        console.log(`   │ USER SELECTION (from form):                                │`);
        console.log(`   │   - timeFrame: "${options.timeFrame || 'past_week'}" (user selected)`);
        console.log(`   │   - contentType: "${options.contentType || 'all'}" (user selected)`);
        console.log(`   │   - resultsCount: ${exactResultsCount} (user selected)`);
        console.log(`   └─────────────────────────────────────────────────────────────┘`);
        console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
        console.log(`   │ GOOGLE API PARAMETERS (what was actually sent):            │`);
        console.log(`   │   - exactGoogleQuery: "${exactGoogleQuery}" (exact query sent to Google)`);
        console.log(`   │   - exactDateRestrict: "${exactDateRestrict || 'NONE'}" (exact dateRestrict sent to Google)`);
        console.log(`   │   - searchQuery: "${searchQuery}" (formatted query)`);
        console.log(`   └─────────────────────────────────────────────────────────────┘`);
        console.log(`   📋 Explanation:`);
        console.log(`      - timeFrame "${options.timeFrame || 'past_week'}" → converted to dateRestrict "${exactDateRestrict || 'NONE'}"`);
        if (options.timeFrame === 'all_time' || !options.timeFrame) {
          console.log(`      - "All" or "all_time" means NO dateRestrict parameter (searches all time)`);
        } else {
          const timeFrameMap = {
            'past_week': 'w1',
            'past_month': 'm1',
            'past_3_months': 'm3',
            'past_year': 'y1'
          };
          console.log(`      - "${options.timeFrame}" → "${timeFrameMap[options.timeFrame] || 'NONE'}" (Google API format)`);
        }
        
        console.log(`✅ Google Search returned ${searchResults.length} results`);
        
        if (searchResults.length === 0) {
          console.error(`❌ No search results returned from Google API`);
          console.error(`   - This could be due to:`);
          console.error(`     1. API not configured (check GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID)`);
          console.error(`     2. API quota exceeded`);
          console.error(`     3. Invalid search query`);
          console.error(`     4. No results found for the search terms`);
          throw new Error('No search results returned from Google API. Please check your API configuration.');
        }
      } catch (searchError) {
        console.error(`❌ Google Search API error:`, searchError.message);
        console.error(`   - Error code: ${searchError.code || 'UNKNOWN'}`);
        
        // Re-throw with more user-friendly message
        if (searchError.code === 'API_NOT_CONFIGURED') {
          throw new Error('Google Custom Search API is not configured. Please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.');
        } else if (searchError.message.includes('quota') || searchError.message.includes('429')) {
          throw new Error('Google Search API quota exceeded. Please try again later.');
        } else {
          throw new Error(`Google Search failed: ${searchError.message}`);
        }
      }
      
      // Step 2: Analyze sentiment using OpenAI with timeout protection
      // CRITICAL: OpenAI MUST be called - no fallback to dummy data
      console.log('🤖 Step 2: Calling OpenAI for sentiment analysis...');
      console.log(`   - Search results to analyze: ${searchResults.length}`);
      console.log(`   - Client: ${options.clientData?.name || 'Unknown'}`);
      
      const sentimentResults = await this.analyzeSentimentWithTimeout(searchResults, options.clientData);
      
      // Verify results have sentiment from OpenAI
      const analyzedCount = sentimentResults.filter(r => r._sentimentAnalyzed === true).length;
      const notAnalyzedCount = sentimentResults.filter(r => r._sentimentAnalyzed === false).length;
      
      console.log(`📊 Sentiment analysis summary:`);
      console.log(`   ✅ Analyzed by OpenAI: ${analyzedCount}`);
      console.log(`   ❌ NOT analyzed (will show "Sentiments Not Created"): ${notAnalyzedCount}`);
      
      // Ensure we have results even if sentiment analysis failed
      if (sentimentResults.length === 0) {
        sentimentResults = searchResults.map(link => ({
          ...link,
          sentiment: 'neutral', // Use neutral as default
          confidence: 0.5, // Use 0.5 as default
          reasoning: 'No sentiment analysis results',
          keywords: [],
          category: 'other',
          relevance: 'medium',
          analyzedAt: new Date().toISOString(),
          _sentimentAnalyzed: false // Flag to indicate sentiment was not analyzed
        }));
      }
      
      // Step 3: Get previous scan for comparison
      let previousScan = null;
      if (options.parentId) {
        // Child scan - get parent for comparison
        const Scan = require('../models/Scan');
        const mongoose = require('mongoose');
        const parentId = typeof options.parentId === 'string' ? new mongoose.Types.ObjectId(options.parentId) : options.parentId;
        previousScan = await Scan.findById(parentId);
      } else {
        // Parent scan - get most recent completed scan
        previousScan = await this.getPreviousScan(clientId, region);
      }
      
      // Step 4: Compare ranks
      try {
        const currentScan = {
          id: scanId,
          clientId: clientId,
          region: region,
          keywords: this.groupResultsByKeyword(sentimentResults),
          scanDate: scanStartTime,
          status: this.scanStatus.COMPLETED
        };
        
        // Convert previousScan to proper format if it's a Mongoose document
        let previousScanForComparison = null;
        if (previousScan) {
          // If previousScan is a Mongoose document, convert to plain object
          const previousScanData = previousScan.toObject ? previousScan.toObject() : previousScan;
          
          // Get previous scan results for comparison
          const ScanResult = require('../models/ScanResult');
          const previousResults = await ScanResult.find({ scanId: previousScan._id }).sort({ position: 1 });
          
          if (previousResults && previousResults.length > 0) {
            previousScanForComparison = {
              id: previousScan._id,
              clientId: previousScan.clientId,
              region: previousScan.region,
              keywords: this.groupResultsByKeyword(previousResults),
              scanDate: previousScan.startedAt || previousScan.completedAt,
              status: 'completed'
            };
          }
        }
        
        const rankComparison = previousScanForComparison ? await rankComparisonService.compareRanks(currentScan, previousScanForComparison) : null;
      } catch (rankError) {
        console.error('Rank comparison error:', rankError.message);
        var rankComparison = null;
      }
      
      // Step 5: Generate report summary
      const reportSummary = await sentimentAnalysisService.generateReportSummary(sentimentResults, options.clientData);
      
      // Step 6: Save scan results
      // CRITICAL: Store exactGoogleQuery and exactDateRestrict for child scan inheritance
      const scanResults = {
        scanId: scanId,
        clientId: clientId,
        clientName: options.clientName || 'Unknown Client',
        region: region,
        keywords: keywords,
        searchQuery: searchQuery, // Store the actual search query used
        exactGoogleQuery: exactGoogleQuery, // CRITICAL: Store exact query for child scans
        exactDateRestrict: exactDateRestrict, // CRITICAL: Store exact dateRestrict for child scans
        scanDate: scanStartTime,
        completedAt: new Date(),
        status: this.scanStatus.COMPLETED,
        totalResults: sentimentResults.length,
        sentimentBreakdown: this.calculateSentimentBreakdown(sentimentResults),
        rankComparison: rankComparison,
        reportSummary: reportSummary,
        results: sentimentResults,
        metadata: {
          searchEngine: 'Google Custom Search',
          aiModel: 'GPT-4',
          processingTime: new Date() - scanStartTime,
          options: options
        }
      };
      
      // Save to database
      console.log(`💾 Saving scan results to database... (${sentimentResults.length} results)`);
      await this.saveScanResults(scanResults);
      
      // Verify results were actually saved
      const ScanResult = require('../models/ScanResult');
      const mongoose = require('mongoose');
      const scanIdForQuery = typeof scanId === 'string' ? new mongoose.Types.ObjectId(scanId) : scanId;
      const savedCount = await ScanResult.countDocuments({ scanId: scanIdForQuery });
      
      console.log(`✅ Scan completed: ${sentimentResults.length} results processed, ${savedCount} saved to database in ${new Date() - scanStartTime}ms`);
      
      if (savedCount === 0) {
        console.error(`❌ CRITICAL: No results saved to database! Expected ${sentimentResults.length} results.`);
      }
      
      return scanResults;
    } catch (error) {
      console.error(`ORM scan failed for client ${clientId}:`, error);
      
      const failedScan = {
        scanId: scanId,
        clientId: clientId,
        region: region,
        keywords: keywords,
        scanDate: scanStartTime,
        completedAt: new Date(),
        status: this.scanStatus.FAILED,
        error: error.message,
        metadata: {
          processingTime: new Date() - scanStartTime
        }
      };
      
      await this.saveScanResults(failedScan);
      throw error;
    }
  }

  groupResultsByKeyword(results) {
    const grouped = {};
    
    // Handle both array of results and single result
    const resultsArray = Array.isArray(results) ? results : [results];
    
    for (const result of resultsArray) {
      if (!result) continue; // Skip null/undefined results
      
      const keyword = result.keyword || 'unknown';
      if (!grouped[keyword]) {
        grouped[keyword] = {
          keyword: keyword,
          position: 1,
          links: []
        };
      }
      
      // Ensure links array exists
      if (!Array.isArray(grouped[keyword].links)) {
        grouped[keyword].links = [];
      }
      
      grouped[keyword].links.push({
        link: result.link || result.url || '',
        title: result.title || '',
        position: result.position || result.rank || 1,
        sentiment: result.sentiment || null,
        domain: result.domain || result.site || ''
      });
    }
    
    return Object.values(grouped);
  }

  calculateSentimentBreakdown(results) {
    const breakdown = {
      positive: 0,
      negative: 0,
      neutral: 0,
      total: results.length
    };
    
    for (const result of results) {
      breakdown[result.sentiment]++;
    }
    
    breakdown.positivePercentage = breakdown.total > 0 ? (breakdown.positive / breakdown.total) * 100 : 0;
    breakdown.negativePercentage = breakdown.total > 0 ? (breakdown.negative / breakdown.total) * 100 : 0;
    breakdown.neutralPercentage = breakdown.total > 0 ? (breakdown.neutral / breakdown.total) * 100 : 0;
    
    return breakdown;
  }

  async getPreviousScan(clientId, region) {
    try {
      const Scan = require('../models/Scan');
      // Get the most recent completed scan for this client+region
      const mostRecentScan = await Scan.findOne({
        clientId: clientId,
        region: region,
        status: 'completed'
      }).sort({ completedAt: -1 });
      
      if (!mostRecentScan) {
        return null; // No previous scan found
      }
      
      return mostRecentScan;
    } catch (error) {
      console.error('Error getting previous scan:', error);
      return null;
    }
  }

  async saveScanResults(scanResults) {
    try {
      
      // Import the Scan model
      const Scan = require('../models/Scan');
      
      // Check if scan already exists (for weekly cron scans)
      const existingScan = await Scan.findById(scanResults.scanId);
      
      if (existingScan) {
        // Update existing scan
        existingScan.status = scanResults.status === 'completed' ? 'completed' : 'failed';
        existingScan.completedAt = scanResults.completedAt;
        existingScan.resultsCount = scanResults.totalResults || 0;
        existingScan.processedKeywords = scanResults.keywords ? scanResults.keywords.length : 0;
        existingScan.errors = scanResults.error ? [{ error: scanResults.error, timestamp: new Date() }] : [];
        
        // CRITICAL: Auto-enable scheduling and set next scan date (7 days from completion or start)
        // Schedule if scan has a completion date OR a start date (for both parent and child scans)
        const scanDate = scanResults.completedAt || scanResults.scanDate || existingScan.startedAt;
        if (scanDate) {
          existingScan.autoScanEnabled = true;
          existingScan.nextAutoScanDate = new Date(new Date(scanDate).getTime() + 7 * 24 * 60 * 60 * 1000);
          console.log(`📅 Auto-scheduling enabled: Next scan scheduled for ${existingScan.nextAutoScanDate.toISOString()} (7 days from ${new Date(scanDate).toISOString()})`);
        }
        
        // CRITICAL: Preserve required fields from existing scan (for child scans)
        // weekNumber is required - must preserve it if not in options
        const options = scanResults.metadata?.options || {};
        if (options.weekNumber !== undefined && options.weekNumber !== null) {
          existingScan.weekNumber = options.weekNumber;
        } else if (!existingScan.weekNumber) {
          // If weekNumber is missing, default to 1 (required field)
          existingScan.weekNumber = 1;
        }
        
        // Preserve other fields from options if provided
        if (options.scanType) {
          existingScan.scanType = options.scanType;
        }
        if (options.parentId) {
          const mongoose = require('mongoose');
          existingScan.parentId = typeof options.parentId === 'string' ? new mongoose.Types.ObjectId(options.parentId) : options.parentId;
        }
        if (options.timeFrame) {
          existingScan.timeFrame = options.timeFrame;
        }
        if (options.contentType) {
          existingScan.contentType = options.contentType;
        }
        if (options.searchQuery || scanResults.searchQuery) {
          existingScan.searchQuery = options.searchQuery || scanResults.searchQuery;
        }
        
        // CRITICAL: Store exactGoogleQuery and exactDateRestrict for child scan inheritance
        if (scanResults.exactGoogleQuery) {
          existingScan.exactGoogleQuery = scanResults.exactGoogleQuery;
          console.log(`💾 Storing exactGoogleQuery in database: "${scanResults.exactGoogleQuery}"`);
        }
        if (scanResults.exactDateRestrict) {
          existingScan.exactDateRestrict = scanResults.exactDateRestrict;
          console.log(`💾 Storing exactDateRestrict in database: "${scanResults.exactDateRestrict}"`);
        }
        
        // Update metadata with enhanced data
        existingScan.metadata = {
          ...existingScan.metadata,
          userAgent: 'ORM-Scan-System',
          ipAddress: '127.0.0.1',
          version: '2.0',
          enhancedData: {
            sentimentBreakdown: scanResults.sentimentBreakdown,
            rankComparison: scanResults.rankComparison,
            reportSummary: scanResults.reportSummary,
            results: scanResults.results,
            scanOptions: scanResults.metadata?.options
          }
        };
        
        await existingScan.save();
        
        // CRITICAL: Log what was updated in database
        console.log(`💾 PARENT SCAN - Updated in database:`);
        console.log(`   - Scan ID: ${existingScan._id}`);
        console.log(`   - exactGoogleQuery: "${existingScan.exactGoogleQuery || 'NOT STORED'}"`);
        console.log(`   - exactDateRestrict: "${existingScan.exactDateRestrict || 'NOT STORED'}"`);
        console.log(`   - searchQuery: "${existingScan.searchQuery || 'NOT STORED'}"`);
        console.log(`   - timeFrame: "${existingScan.timeFrame || 'NOT STORED'}"`);
        console.log(`   - contentType: "${existingScan.contentType || 'NOT STORED'}"`);
        console.log(`   - resultsCount: ${existingScan.resultsCount || 0}`);
      } else {
        // Create new scan document using existing schema
        const options = scanResults.metadata?.options || {};
        const mongoose = require('mongoose');
        
        // Calculate next auto scan date (7 days from completion or start date)
        // Schedule for ALL scans (parent or child) that have a date
        const scanDate = scanResults.completedAt || scanResults.scanDate;
        const nextAutoScanDate = scanDate
          ? new Date(new Date(scanDate).getTime() + 7 * 24 * 60 * 60 * 1000)
          : null;

        const scan = new Scan({
          _id: scanResults.scanId,
          clientId: scanResults.clientId,
          clientName: scanResults.clientName || 'Unknown Client',
          weekNumber: options.weekNumber || 1, // Use from options (child scans), or default to 1
          region: scanResults.region,
          status: scanResults.status === 'completed' ? 'completed' : 'failed',
          clientStatus: 'not_sent',
          scanType: options.scanType || 'manual', // Use from options (child scans use 'auto')
          parentId: options.parentId ? (typeof options.parentId === 'string' ? new mongoose.Types.ObjectId(options.parentId) : options.parentId) : null, // Use from options (child scans have parentId)
          searchQuery: options.searchQuery || scanResults.searchQuery || scanResults.keywords?.join(' ') || '', // Store the search query
          exactGoogleQuery: scanResults.exactGoogleQuery || null, // CRITICAL: Store exact query for child scans
          exactDateRestrict: scanResults.exactDateRestrict || null, // CRITICAL: Store exact dateRestrict for child scans
          timeFrame: options.timeFrame || 'past_week', // Preserve timeFrame from options
          contentType: options.contentType || 'all', // Preserve contentType from options
          startedAt: scanResults.scanDate,
          completedAt: scanResults.completedAt,
          totalKeywords: scanResults.keywords ? scanResults.keywords.length : 0,
          processedKeywords: scanResults.keywords ? scanResults.keywords.length : 0,
          resultsCount: scanResults.totalResults || 0,
          errors: scanResults.error ? [{ error: scanResults.error, timestamp: new Date() }] : [],
          // CRITICAL: Auto-enable scheduling for ALL scans with a date (7 days from completion/start)
          autoScanEnabled: scanDate ? true : false,
          nextAutoScanDate: nextAutoScanDate,
          metadata: {
            userAgent: 'ORM-Scan-System',
            ipAddress: '127.0.0.1',
            version: '2.0',
            // Store enhanced data in metadata
            enhancedData: {
              sentimentBreakdown: scanResults.sentimentBreakdown,
              rankComparison: scanResults.rankComparison,
              reportSummary: scanResults.reportSummary,
              results: scanResults.results,
              scanOptions: scanResults.metadata?.options
            }
          }
        });
        
        try {
          await scan.save();
          
          // CRITICAL: Log what was stored in database for parent scans
          console.log(`💾 PARENT SCAN - Saved to database:`);
          console.log(`   - Scan ID: ${scan._id}`);
          console.log(`   - exactGoogleQuery: "${scan.exactGoogleQuery || 'NOT STORED'}"`);
          console.log(`   - exactDateRestrict: "${scan.exactDateRestrict || 'NOT STORED'}"`);
          console.log(`   - searchQuery: "${scan.searchQuery || 'NOT STORED'}"`);
          console.log(`   - timeFrame: "${scan.timeFrame || 'NOT STORED'}"`);
          console.log(`   - contentType: "${scan.contentType || 'NOT STORED'}"`);
          console.log(`   - resultsCount: ${scan.resultsCount || 0}`);
        } catch (saveError) {
          console.error('Error saving scan to database:', saveError);
          throw saveError;
        }
      }
      
      // Save individual results to ScanResult model
      if (scanResults.results && scanResults.results.length > 0) {
        try {
          const scanId = typeof scanResults.scanId === 'string' ? scanResults.scanId : scanResults.scanId.toString();
          await this.saveIndividualResults(scanId, scanResults.results, scanResults.clientId, scanResults.region);
        } catch (individualError) {
          console.error('Error saving individual results:', individualError.message);
        }
      }
      
      return scanResults;
    } catch (error) {
      console.error('❌ Error saving scan results:', error);
      throw error;
    }
  }

  async saveIndividualResults(scanId, results, clientId, region) {
    try {
      // Import the ScanResult model and ObjectId
      const ScanResult = require('../models/ScanResult');
      const Keyword = require('../models/Keyword');
      const { ObjectId } = require('mongodb');
      
      // Convert scanId to ObjectId if it's a string
      const scanObjectId = typeof scanId === 'string' ? new ObjectId(scanId) : scanId;
      
      // Clear existing results for this scan
      await ScanResult.deleteMany({ scanId: scanObjectId });
      
      // Save new results with all required fields
      const resultDocs = await Promise.all(results.map(async (result, index) => {
        // Find or create keyword
        let keywordId;
        if (result.keyword) {
          let keyword = await Keyword.findOne({ 
            clientId: clientId, 
            keyword: result.keyword 
          });
          if (!keyword) {
            keyword = new Keyword({
              clientId: clientId,
              keyword: result.keyword,
              targetRegions: [region],
              status: 'active',
              priority: 'medium'
            });
            await keyword.save();
          }
          keywordId = keyword._id;
        } else {
          keywordId = new ObjectId();
        }

        // CRITICAL: Validate and sanitize sentiment values
        // If sentiment is null/undefined, use 'neutral' as default (required by schema)
        let sentiment = result.sentiment;
        if (sentiment === null || sentiment === undefined) {
          // Use 'neutral' as default if not available (required by schema)
          sentiment = 'neutral';
        } else if (typeof sentiment === 'string') {
          sentiment = sentiment.toLowerCase().trim();
          if (sentiment !== 'positive' && sentiment !== 'negative' && sentiment !== 'neutral') {
            sentiment = 'neutral'; // Invalid value - use neutral as fallback
          }
        } else {
          sentiment = 'neutral'; // Invalid type - use neutral as fallback
        }

        // CRITICAL: Validate sentimentScore values - use 0.5 as default if not available
        let sentimentScore = result.confidence || result.sentimentScore;
        if (sentimentScore === null || sentimentScore === undefined) {
          // Use 0.5 as default if not available (required by schema)
          sentimentScore = 0.5;
        } else {
          const numScore = Number(sentimentScore);
          if (isNaN(numScore) || !isFinite(numScore)) {
            sentimentScore = 0.5; // Invalid value - use 0.5 as fallback
          } else {
            sentimentScore = Math.max(0, Math.min(1, numScore)); // Clamp between 0 and 1
          }
        }
        
        // Check if sentiment was actually analyzed (from _sentimentAnalyzed flag)
        const sentimentAnalyzed = result._sentimentAnalyzed === true;

        return {
          scanId: scanObjectId,
          clientId: clientId,
          keywordId: keywordId,
          keyword: result.keyword || 'unknown',
          url: result.link || result.url || '',
          title: result.title || '',
          description: result.snippet || '',
          position: result.position || index + 1,
          rank: result.position || index + 1,
          sentiment: sentiment, // Use validated sentiment (defaults to 'neutral' if not available)
          sentimentScore: sentimentScore, // Use validated sentimentScore (defaults to 0.5 if not available)
          site: result.domain || '',
          region: region || 'US',
          dateFetched: new Date(),
          notes: result.reasoning || (sentimentAnalyzed ? '' : 'Sentiment analysis unavailable - OpenAI API not working'),
          category: result.category || 'other', // Default to 'other' if not available
          keywords: result.keywords || [],
          relevance: result.relevance || 'medium', // Default to 'medium' if not available
          analyzedAt: result.analyzedAt || new Date(),
          createdAt: new Date(),
          // Store metadata to track if sentiment was actually analyzed
          metadata: {
            ...(result.metadata || {}),
            sentimentAnalyzed: sentimentAnalyzed || result._sentimentAnalyzed === true,
            originalSentiment: result.sentiment // Store original value for display
          }
        };
      }));
      
      if (resultDocs.length === 0) {
        console.error('No result documents to insert');
        return;
      }
      
      await ScanResult.insertMany(resultDocs);
      
      // Verify results were saved
      const verifyCount = await ScanResult.countDocuments({ scanId: scanObjectId });
      if (verifyCount !== resultDocs.length) {
        console.error(`Results mismatch: saved ${resultDocs.length} but found ${verifyCount} in database`);
      }
      
    } catch (error) {
      console.error('Error saving individual results:', error.message);
    }
  }

  generateScanId() {
    const { ObjectId } = require('mongodb');
    return new ObjectId().toString();
  }

  async analyzeSentimentWithTimeout(searchResults, clientData) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Sentiment analysis timeout');
        clearTimeout(timeout);
        resolve(searchResults.map(link => ({
          ...link,
          sentiment: 'neutral', // Use neutral as default (required by schema)
          confidence: 0.5, // Use 0.5 as default (required by schema)
          reasoning: 'Sentiment analysis timeout - OpenAI did not respond',
          keywords: [],
          category: 'other',
          relevance: 'medium',
          analyzedAt: new Date().toISOString(),
          _sentimentAnalyzed: false // Flag to indicate sentiment was not analyzed
        })));
      }, 300000); // 5 minute timeout

      try {
        console.log('🤖 Calling OpenAI for sentiment analysis...');
        const results = await sentimentAnalysisService.analyzeSentiment(searchResults, clientData);
        clearTimeout(timeout);
        
        console.log(`✅ OpenAI returned ${results.length} analyzed result(s)`);
        
        // Validate results before returning - use defaults if not valid
        const validatedResults = results.map((result, index) => {
          const sentiment = (result.sentiment === 'positive' || result.sentiment === 'negative' || result.sentiment === 'neutral') 
            ? result.sentiment 
            : 'neutral'; // Default to neutral only if invalid value
          const confidence = (typeof result.confidence === 'number' && !isNaN(result.confidence)) 
            ? Math.max(0, Math.min(1, result.confidence)) 
            : 0.5; // Default to 0.5 only if invalid value
          
          console.log(`   Result ${index + 1}: ${sentiment} (confidence: ${confidence}) - ${result.title?.substring(0, 50) || 'N/A'}`);
          
          return {
            ...result,
            sentiment: sentiment,
            confidence: confidence,
            _sentimentAnalyzed: true // Flag that sentiment was actually analyzed by OpenAI
          };
        });
        
        console.log(`✅ All ${validatedResults.length} results analyzed by OpenAI`);
        resolve(validatedResults);
      } catch (error) {
        clearTimeout(timeout);
        console.error('❌ Sentiment analysis failed:', error.message);
        console.error('   Error code:', error.code || 'UNKNOWN');
        console.error('   ⚠️ Returning results WITHOUT sentiment analysis (will show "Sentiments Not Created")');
        
        // Return results with default sentiment values and flag indicating OpenAI failed
        // Frontend will show "Sentiments Not Created" for these
        resolve(searchResults.map(link => ({
          ...link,
          sentiment: 'neutral', // Use neutral as default (required by schema)
          confidence: 0.5, // Use 0.5 as default (required by schema)
          reasoning: `Sentiment analysis unavailable - ${error.message}`,
          keywords: [],
          category: 'other',
          relevance: 'medium',
          analyzedAt: new Date().toISOString(),
          _sentimentAnalyzed: false // CRITICAL: Flag to indicate sentiment was NOT analyzed by OpenAI
        })));
      }
    });
  }

  async getScanHistory(clientId, region, limit = 10) {
    // Query the database
    return [];
  }

  async getScanById(scanId) {
    // Query the database
    return null;
  }

  async deleteScan(scanId) {
    // Delete from database
    console.log('Deleting scan:', scanId);
    return true;
  }

  async getClientDashboard(clientId) {
    // Query the database
    return {
      clientId: clientId,
      totalScans: 0,
      lastScanDate: null,
      averageRanking: 0,
      sentimentTrend: 'neutral',
      topKeywords: [],
      recentActivity: []
    };
  }

  async getAdminDashboard() {
    // Query the database
    return {
      totalClients: 0,
      totalScans: 0,
      activeScans: 0,
      completedScans: 0,
      failedScans: 0,
      averageProcessingTime: 0,
      recentActivity: []
    };
  }

  async scheduleWeeklyScans() {
    // Use a job scheduler
    console.log('Scheduling weekly scans...');
    return true;
  }

  async triggerManualScan(clientId, keywords, region, options = {}) {
    try {
      console.log(`Triggering manual scan for client ${clientId}`);
      
      const scanResults = await this.performFullScan(clientId, keywords, region, options);
      
      return {
        success: true,
        scanId: scanResults.scanId,
        message: 'Scan triggered successfully',
        estimatedCompletionTime: '5-10 minutes'
      };
    } catch (error) {
      console.error('Manual scan trigger failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to trigger scan'
      };
    }
  }

  async getScanStatus(scanId) {
    // Query the database
    return {
      scanId: scanId,
      status: this.scanStatus.COMPLETED,
      progress: 100,
      message: 'Scan completed successfully'
    };
  }

  async exportScanResults(scanId, format = 'json') {
    // Generate export files
    const scanResults = await this.getScanById(scanId);
    
    if (!scanResults) {
      throw new Error('Scan not found');
    }
    
    if (format === 'json') {
      return JSON.stringify(scanResults, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(scanResults);
    } else {
      throw new Error('Unsupported export format');
    }
  }

  convertToCSV(scanResults) {
    const headers = ['Keyword', 'Title', 'URL', 'Position', 'Sentiment', 'Confidence', 'Domain'];
    const rows = [];
    
    for (const keyword of scanResults.keywords) {
      for (const link of keyword.links) {
        rows.push([
          keyword.keyword,
          link.title,
          link.link,
          link.position,
          link.sentiment,
          link.confidence,
          link.domain
        ]);
      }
    }
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = new ORMScanService();



