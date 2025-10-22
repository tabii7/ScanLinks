const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');
const Keyword = require('../models/Keyword');
const Client = require('../models/Client');
const Report = require('../models/Report');
const googleSearchService = require('./googleSearchService');
const sentimentService = require('./sentimentService');
const reportService = require('./reportService');

class ScanService {
  async runScan(clientId, region, scanType = 'manual') {
    try {
      // Get client and keywords
      const client = await Client.findById(clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      let keywords = await Keyword.find({ 
        clientId, 
        status: 'active',
        targetRegions: region 
      });

      if (keywords.length === 0) {
        // Create default keywords for demo purposes
        console.log('No keywords found, creating default keywords for demo');
        const defaultKeywords = [
          { keyword: client.name, status: 'active', targetRegions: [region], clientId },
          { keyword: `${client.name} reviews`, status: 'active', targetRegions: [region], clientId },
          { keyword: `${client.name} company`, status: 'active', targetRegions: [region], clientId }
        ];
        
        for (const kw of defaultKeywords) {
          const keyword = new Keyword(kw);
          await keyword.save();
        }
        
        // Fetch the newly created keywords
        keywords = await Keyword.find({ 
          clientId, 
          status: 'active',
          targetRegions: region 
        });
      }

      // Create scan record
      const weekNumber = await this.getCurrentWeekNumber();
      const scan = new Scan({
        clientId,
        weekNumber,
        region,
        scanType,
        status: 'running',
        totalKeywords: keywords.length,
      });
      await scan.save();

      console.log(`Starting scan for client ${clientId} in region ${region}`);

      // Search keywords
      const searchResults = await googleSearchService.searchKeywords(keywords, region);
      
      // Analyze sentiment for all results
      const allResults = [];
      
      // Process each result from the flat array
      for (const result of searchResults) {
        // Add scan and client information to each result
        allResults.push({
          scanId: scan._id,
          clientId,
          keywordId: result.keywordId || null,
          keyword: result.keyword || 'unknown',
          ...result,
        });
      }

      // Compare with previous scan to determine movements
      const resultsWithMovement = await this.compareWithPreviousScan(allResults, clientId, region);

      // Save results
      const scanResults = await ScanResult.insertMany(resultsWithMovement);
      
      // Update scan status
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.processedKeywords = keywords.length;
      scan.resultsCount = scanResults.length;
      await scan.save();

      // Generate report
      await reportService.generateReport(scan._id, clientId, region, weekNumber);

      console.log(`Scan completed for client ${clientId} in region ${region}. Results: ${scanResults.length}`);
      
      return {
        scanId: scan._id,
        resultsCount: scanResults.length,
        status: 'completed',
      };
    } catch (error) {
      console.error('Scan failed:', error);
      throw error;
    }
  }

  async compareWithPreviousScan(currentResults, clientId, region) {
    try {
      // Get previous scan results
      const previousScan = await Scan.findOne({
        clientId,
        region,
        status: 'completed',
      }).sort({ completedAt: -1 });

      if (!previousScan) {
        // First scan - all results are new
        return currentResults.map(result => ({
          ...result,
          movement: 'new',
        }));
      }

      const previousResults = await ScanResult.find({
        scanId: previousScan._id,
        clientId,
        region,
      });

      const resultsWithMovement = [];

      for (const currentResult of currentResults) {
        const previousResult = previousResults.find(prev => 
          prev.url === currentResult.url && prev.keywordId.toString() === currentResult.keywordId.toString()
        );

        if (!previousResult) {
          // New result
          resultsWithMovement.push({
            ...currentResult,
            movement: 'new',
          });
        } else {
          // Existing result - check for changes
          let movement = 'unchanged';
          
          if (currentResult.rank < previousResult.rank) {
            movement = 'improved';
          } else if (currentResult.rank > previousResult.rank) {
            movement = 'dropped';
          }

          resultsWithMovement.push({
            ...currentResult,
            movement,
            previousRank: previousResult.rank,
            previousSentiment: previousResult.sentiment,
          });
        }
      }

      // Check for disappeared results
      for (const previousResult of previousResults) {
        const stillExists = currentResults.find(current => 
          current.url === previousResult.url && current.keywordId.toString() === previousResult.keywordId.toString()
        );

        if (!stillExists) {
          // This result disappeared
          resultsWithMovement.push({
            scanId: currentResults[0]?.scanId,
            clientId,
            keywordId: previousResult.keywordId,
            keyword: previousResult.keyword,
            url: previousResult.url,
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
      console.log('Starting weekly automated scan...');
      
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
              console.log(`Weekly scan completed for client ${client.name} in region ${region}`);
            } catch (error) {
              console.error(`Weekly scan failed for client ${client.name} in region ${region}:`, error.message);
            }
          }
        } catch (error) {
          console.error(`Error processing client ${client.name}:`, error.message);
        }
      }

      console.log('Weekly automated scan completed');
    } catch (error) {
      console.error('Weekly scan failed:', error);
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
      // Get real scan results from database - handle both ObjectId and string scanIds
      let query = {};
      
      // Try to match as ObjectId first, then as string
      try {
        const mongoose = require('mongoose');
        const objectId = new mongoose.Types.ObjectId(scanId);
        query = { scanId: objectId };
      } catch (error) {
        // If not a valid ObjectId, search as string
        query = { scanId: scanId };
      }
      
      const results = await ScanResult.find(query).sort({ position: 1 });
      
      console.log(`🔍 Found ${results.length} results for scanId: ${scanId}`);
      console.log(`🔍 Query used:`, query);
      
      // If no results found, return empty array (no mock data)
      if (results.length === 0) {
        console.log('⚠️ No scan results found in database');
        return [];
      }
      
      // Check for duplicates by title and URL
      const uniqueResults = [];
      const seen = new Set();
      
      for (const result of results) {
        const key = `${result.title}-${result.link || result.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(result);
        } else {
          console.log(`⚠️ Duplicate result found: ${result.title} -> ${result.link || result.url}`);
        }
      }
      
      console.log(`🔍 After deduplication: ${uniqueResults.length} unique results`);
      
      // Ensure originalUrl is populated for all results
      const processedResults = uniqueResults.map(result => {
        // Extract originalUrl from metadata or use link/url as fallback
        const originalUrl = result.metadata?.originalUrl || result.link || result.url;
        
        console.log(`🔗 Processing result: ${result.title} -> ${originalUrl}`);
        
        return {
          ...result.toObject(),
          originalUrl: originalUrl,
          originalLink: originalUrl,
          // Ensure link field has the original URL
          link: originalUrl || result.link || result.url
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
      const query = { ...filters };
      console.log('🔍 getAllScans query:', query);
      
      const scans = await Scan.find(query)
        .populate('clientId', 'name email contact settings')
        .sort({ createdAt: -1 })
        .limit(limit);

      console.log('🔍 Found scans in database:', scans.length);
      if (scans.length > 0) {
        console.log('🔍 Sample scan data:', {
          _id: scans[0]._id,
          status: scans[0].status,
          resultsCount: scans[0].resultsCount,
          createdAt: scans[0].createdAt,
          clientId: scans[0].clientId,
          clientName: scans[0].clientId?.name,
          clientEmail: scans[0].clientId?.email
        });
      }

      // Ensure client details are properly populated
      const scansWithClientDetails = scans.map(scan => ({
        ...scan.toObject(),
        clientName: scan.clientId?.name || scan.clientName || 'Unknown Client',
        clientEmail: scan.clientId?.email || scan.clientId?.contact?.email || 'No email'
      }));

      return scansWithClientDetails;
    } catch (error) {
      console.error('Error fetching all scans:', error);
      throw error;
    }
  }
}

module.exports = new ScanService();


