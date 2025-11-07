const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');
const Keyword = require('../models/Keyword');
const Client = require('../models/Client');
const Report = require('../models/Report');
const googleSearchService = require('./googleSearchService');
const reportService = require('./reportService');

function normalizeUrl(raw) {
  try {
    if (!raw) return '';
    const ensure = raw.startsWith('http') ? raw : `https://${raw}`;
    const u = new URL(ensure);
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    const params = new URLSearchParams(u.search);
    const stripKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','igshid'];
    stripKeys.forEach(k => params.delete(k));
    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    const search = params.toString();
    return `${host}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return (raw || '').toLowerCase();
  }
}

class ScanService {
  async runScan(clientId, region, scanType = 'manual', options = {}) {
    try {
      // Get client and keywords
      const client = await Client.findById(clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      let keywords;
      if (options.parentId && options.searchQuery) {
        // Child scan - use parent's exact search query
        console.log('🔄 Child scan detected - using parent search query:', options.searchQuery);
        keywords = [{ keyword: options.searchQuery }];
      } else {
        // Parent scan - fetch from database
        keywords = await Keyword.find({ 
          clientId, 
          status: 'active',
          targetRegions: region 
        });

        if (keywords.length === 0) {
          if (process.env.NODE_ENV !== 'development') {
            throw new Error('No active keywords found for this client and region. Please add keywords first.');
          }
          // Create default keywords for demo purposes (DEV ONLY)
          console.log('⚠️ No keywords found, creating default keywords for demo (DEV ONLY)');
          const defaultKeywords = [
            { keyword: client.name, status: 'active', targetRegions: [region], clientId },
            { keyword: `${client.name} reviews`, status: 'active', targetRegions: [region], clientId },
            { keyword: `${client.name} company`, status: 'active', targetRegions: [region], clientId }
          ];
          for (const kw of defaultKeywords) {
            const keyword = new Keyword(kw);
            await keyword.save();
          }
          keywords = await Keyword.find({ 
            clientId, 
            status: 'active',
            targetRegions: region 
          });
        }
      }

      // Determine sequential week number per parent baseline
      const searchQuery = options.searchQuery || keywords.map(k => k.keyword).join(' ');
      let weekNumber = 1;
      let parentId = null;

      if (options.parentId) {
        // This is a child scan - use provided parentId and weekNumber
        parentId = options.parentId;
        weekNumber = options.weekNumber || await this.getNextWeekNumber(options.parentId);
        console.log(`📊 Child scan - Parent: ${parentId}, Week: ${weekNumber}`);
      } else {
        // This is a parent scan - check if baseline exists
        const existingParent = await Scan.findOne({ 
          clientId, 
          region, 
          parentId: null 
        }).sort({ startedAt: 1 });
        
        if (existingParent) {
          // Baseline exists - make this scan a child of it
          parentId = existingParent._id;
          weekNumber = await this.getNextWeekNumber(existingParent._id);
          console.log(`📊 Creating child of existing baseline - Parent: ${parentId}, Week: ${weekNumber}`);
        } else {
          // This is the first scan - becomes baseline
          weekNumber = 1;
          parentId = null;
          console.log(`📊 Creating new baseline scan - Week: 1`);
        }
      }
      
      const scan = new Scan({
        clientId,
        clientName: client.name,
        weekNumber,
        region,
        scanType,
        status: 'running',
        totalKeywords: keywords.length,
        searchQuery: searchQuery,
        parentId: parentId,
        timeFrame: options.timeFrame || 'past_week',
        contentType: options.contentType || 'all',
        autoScanEnabled: options.autoScanEnabled || false
      });
      await scan.save();

      console.log(`Starting scan for client ${clientId} in region ${region}`);

      // Prepare search options with exact parameters
      const searchOptions = {
        timeFrame: options.timeFrame || scan.timeFrame || 'past_week',
        contentType: options.contentType || scan.contentType || 'all',
        resultsCount: options.resultsCount || 10
      };

      console.log('🔍 Search options:', searchOptions);

      // Search keywords
      const searchResponse = await googleSearchService.searchKeywords(
        keywords, 
        region,
        searchOptions.resultsCount,
        searchOptions,
        client.name
      );
      const searchResults = searchResponse.results || [];

      // Analyze sentiment for all results
      const allResultsRaw = [];
      for (const result of searchResults) {
        const link = result.link || result.url || 'https://example.com';
        const norm = normalizeUrl(link);
        allResultsRaw.push({
          scanId: scan._id,
          clientId,
          keywordId: result.keywordId || null,
          keyword: result.keyword || 'unknown',
          title: result.title || 'No Title',
          url: link,
          originalUrl: link, // Store original URL
          normalizedUrl: norm,
          description: result.snippet || '',
          rank: result.position || 1,
          sentiment: 'neutral',
          sentimentScore: 0.5,
          site: result.domain || 'example.com',
          region: region,
          dateFetched: new Date(),
          ...result,
        });
      }
      
      // Deduplicate by normalizedUrl + keywordId
      const seenKey = new Set();
      const allResults = [];
      for (const r of allResultsRaw) {
        const key = `${r.normalizedUrl}-${r.keywordId || ''}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        allResults.push(r);
      }

      // Compare with previous scan to determine movements
      const resultsWithMovement = await this.compareWithPreviousScan(allResults, clientId, region, parentId);

      // Save results
      const scanResults = await ScanResult.insertMany(resultsWithMovement);
      
      // Update scan status
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.processedKeywords = keywords.length;
      scan.resultsCount = scanResults.length;
      await scan.save();

      console.log(`✅ Scan completed for client ${clientId} in region ${region}. Results: ${scanResults.length}`);
      
      return {
        scanId: scan._id,
        resultsCount: scanResults.length,
        status: 'completed',
      };
    } catch (error) {
      console.error('❌ Scan failed:', error);
      throw error;
    }
  }

  async runChildScan(parentScanId, options = {}) {
    try {
      console.log('🔄 Starting child scan for parent:', parentScanId);
      
      // Get parent scan
      const mongoose = require('mongoose');
      const parentId = typeof parentScanId === 'string' ? new mongoose.Types.ObjectId(parentScanId) : parentScanId;
      const parentScan = await Scan.findById(parentId);
      
      if (!parentScan) {
        throw new Error('Parent scan not found');
      }
      
      console.log('📋 Parent scan details:', {
        id: parentScan._id,
        clientId: parentScan.clientId,
        region: parentScan.region,
        searchQuery: parentScan.searchQuery,
        timeFrame: parentScan.timeFrame,
        contentType: parentScan.contentType,
        weekNumber: parentScan.weekNumber
      });
      
      // Get next week number
      const nextWeekNumber = await this.getNextWeekNumber(parentScan._id);
      
      // Copy ALL parameters from parent
      const childOptions = {
        scanType: options.scanType || 'auto',
        parentId: parentScan._id,
        weekNumber: nextWeekNumber,
        searchQuery: parentScan.searchQuery, // Use parent's EXACT search query
        timeFrame: parentScan.timeFrame || 'past_week',
        contentType: parentScan.contentType || 'all',
        resultsCount: options.resultsCount || 10, // Allow override or use default
        autoScanEnabled: false,
        ...options // Allow additional overrides
      };
      
      console.log('🔧 Child scan options:', childOptions);
      
      // Run scan with parent's exact parameters
      const result = await this.runScan(
        parentScan.clientId,
        parentScan.region,
        childOptions.scanType,
        childOptions
      );
      
      console.log('✅ Child scan completed:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Child scan failed:', error);
      throw error;
    }
  }

  async getNextWeekNumber(parentScanId) {
    try {
      const mongoose = require('mongoose');
      const parentId = typeof parentScanId === 'string' ? new mongoose.Types.ObjectId(parentScanId) : parentScanId;
      
      // Find highest week number among parent and ALL its children
      const scans = await Scan.find({
        $or: [
          { _id: parentId },           // Include the parent scan
          { parentId: parentId }      // Include all child scans
        ]
      }).sort({ weekNumber: -1 }).limit(1);
      
      const highestWeek = scans[0]?.weekNumber || 0;
      const nextWeek = highestWeek + 1;
      
      // Log all scans for debugging
      const allScans = await Scan.find({
        $or: [
          { _id: parentId },
          { parentId: parentId }
        ]
      }).sort({ weekNumber: 1 });
      
      console.log(`📊 Week number calculation for parent ${parentId}:`);
      console.log(`   - All scans found: ${allScans.length}`);
      allScans.forEach(scan => {
        console.log(`     • Scan ${scan._id}: Week ${scan.weekNumber} (${scan.parentId ? 'child' : 'parent'})`);
      });
      console.log(`   - Highest week number: ${highestWeek}`);
      console.log(`   - Next week number: ${nextWeek}`);
      
      return nextWeek;
    } catch (error) {
      console.error('Error getting next week number:', error);
      return 1;
    }
  }

  async compareWithPreviousScan(currentResults, clientId, region, parentId = null) {
    try {
      // Get previous scan results - if parentId is provided, compare with parent
      let previousScan;
      
      if (parentId) {
        // This is a child scan - compare with parent (baseline)
        previousScan = await Scan.findById(parentId);
        console.log('📊 Comparing child scan with parent baseline');
      } else {
        // This is a parent scan - compare with most recent completed scan
        previousScan = await Scan.findOne({
          clientId,
          region,
          status: 'completed',
        }).sort({ completedAt: -1 });
        console.log('📊 Comparing with previous completed scan');
      }

      if (!previousScan) {
        // First scan - mark as baseline
        console.log('📊 First scan - marking all as baseline');
        return currentResults.map(result => ({
          ...result,
          movement: 'baseline',
        }));
      }

      const previousResults = await ScanResult.find({
        scanId: previousScan._id,
        clientId,
        region,
      });

      console.log(`📊 Comparing ${currentResults.length} current results with ${previousResults.length} previous results`);

      const resultsWithMovement = [];

      for (const currentResult of currentResults) {
        const prevMatch = previousResults.find(prev => {
          const prevNorm = normalizeUrl(prev.originalUrl || prev.link || prev.url);
          const curNorm = currentResult.normalizedUrl || normalizeUrl(currentResult.url);
          return prevNorm === curNorm && String(prev.keywordId || '') === String(currentResult.keywordId || '');
        });

        if (!prevMatch) {
          // New result
          resultsWithMovement.push({
            ...currentResult,
            movement: 'new',
          });
        } else {
          // Existing result - check for changes
          let movement = 'unchanged';
          
          if (currentResult.rank < prevMatch.rank) {
            movement = 'improved';
          } else if (currentResult.rank > prevMatch.rank) {
            movement = 'dropped';
          }

          resultsWithMovement.push({
            ...currentResult,
            movement,
            previousRank: prevMatch.rank,
            previousSentiment: prevMatch.sentiment,
          });
        }
      }

      // Check for disappeared results
      for (const previousResult of previousResults) {
        const prevNorm = normalizeUrl(previousResult.originalUrl || previousResult.link || previousResult.url);
        const stillExists = currentResults.find(current => {
          const curNorm = current.normalizedUrl || normalizeUrl(current.url);
          return curNorm === prevNorm && String(current.keywordId || '') === String(previousResult.keywordId || '');
        });

        if (!stillExists) {
          // This result disappeared
          resultsWithMovement.push({
            scanId: currentResults[0]?.scanId,
            clientId,
            keywordId: previousResult.keywordId,
            keyword: previousResult.keyword,
            url: previousResult.url,
            originalUrl: previousResult.originalUrl || previousResult.url,
            title: previousResult.title,
            description: previousResult.description,
            rank: previousResult.rank,
            sentiment: previousResult.sentiment,
            movement: 'disappeared',
            previousRank: previousResult.rank,
            previousSentiment: previousResult.sentiment,
            site: previousResult.site,
            region: previousResult.region,
            dateFetched: new Date(),
          });
        }
      }

      console.log(`📊 Movement summary:`, {
        new: resultsWithMovement.filter(r => r.movement === 'new').length,
        improved: resultsWithMovement.filter(r => r.movement === 'improved').length,
        dropped: resultsWithMovement.filter(r => r.movement === 'dropped').length,
        unchanged: resultsWithMovement.filter(r => r.movement === 'unchanged').length,
        disappeared: resultsWithMovement.filter(r => r.movement === 'disappeared').length,
      });

      return resultsWithMovement;
    } catch (error) {
      console.error('Error comparing with previous scan:', error);
      return currentResults.map(result => ({
        ...result,
        movement: 'new',
      }));
    }
  }

  async getCurrentWeekNumber() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  }

  async runWeeklyScan() {
    try {
      console.log('⏰ Starting weekly automated scan...');
      
      const activeClients = await Client.find({ 
        status: 'active',
        'settings.autoScan': true 
      });

      for (const client of activeClients) {
        try {
          const keywords = await Keyword.find({ 
            clientId: client._id, 
            status: 'active' 
          });

          if (keywords.length === 0) continue;

          // Get unique regions for this client
          const regions = [...new Set(keywords.flatMap(k => k.targetRegions))];

          for (const region of regions) {
            try {
              await this.runScan(client._id, region, 'automated');
              console.log(`✅ Weekly scan completed for client ${client.name} in region ${region}`);
            } catch (error) {
              console.error(`❌ Weekly scan failed for client ${client.name} in region ${region}:`, error.message);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing client ${client.name}:`, error.message);
        }
      }

      console.log('✅ Weekly automated scan completed');
    } catch (error) {
      console.error('❌ Weekly scan failed:', error);
    }
  }

  async getScanHistory(clientId, region, limit = 10) {
    try {
      const scans = await Scan.find({
        clientId,
        region,
        status: 'completed',
      })
      .sort({ completedAt: -1 })
      .limit(limit)
      .populate('clientId', 'name');

      return scans;
    } catch (error) {
      console.error('Error fetching scan history:', error);
      throw error;
    }
  }

  async getScanResults(scanId, filters = {}) {
    try {
      // Get real scan results from database
      let query = {};
      
      try {
        const mongoose = require('mongoose');
        const objectId = new mongoose.Types.ObjectId(scanId);
        query = { scanId: objectId };
      } catch (error) {
        query = { scanId: scanId };
      }
      
      const results = await ScanResult.find(query).sort({ position: 1 });
      
      if (results.length === 0) {
        return [];
      }
      
      // Check for duplicates by normalized URL and keywordId
      const uniqueResults = [];
      const seen = new Set();
      for (const result of results) {
        const norm = normalizeUrl(result.originalUrl || result.link || result.url);
        const key = `${norm}-${result.keywordId || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueResults.push(result);
      }
      
      // Ensure originalUrl is populated for all results
      const processedResults = uniqueResults.map(result => {
        const originalUrl = result.metadata?.originalUrl || result.originalUrl || result.link || result.url;
        const normalizedUrl = normalizeUrl(originalUrl);
        
        return {
          ...result.toObject(),
          originalUrl: originalUrl,
          originalLink: originalUrl,
          link: originalUrl || result.link || result.url,
          normalizedUrl: normalizedUrl
        };
      });

      // Apply filters
      let filteredResults = processedResults;
      
      if (filters.sentiment) {
        filteredResults = filteredResults.filter(r => r.sentiment === filters.sentiment);
      }
      
      if (filters.movement) {
        filteredResults = filteredResults.filter(r => r.movement === filters.movement);
      }
      
      if (filters.keyword) {
        filteredResults = filteredResults.filter(r => 
          r.keyword.toLowerCase().includes(filters.keyword.$regex.toLowerCase())
        );
      }

      return filteredResults;
    } catch (error) {
      console.error('Error fetching scan results:', error);
      throw error;
    }
  }

  async getAllScans(filters = {}, limit = 20) {
    try {
      const scans = await Scan.find(filters)
        .populate('clientId', 'name email contact settings')
        .sort({ createdAt: -1 })
        .limit(limit);

      return scans.map(scan => ({
        ...scan.toObject(),
        clientName: scan.clientId?.name || scan.clientName || 'Unknown Client',
        clientEmail: scan.clientId?.email || scan.clientId?.contact?.email || 'No email'
      }));
    } catch (error) {
      console.error('Error fetching all scans:', error);
      throw error;
    }
  }
}

module.exports = new ScanService();