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
    const scanId = this.generateScanId();
    const scanStartTime = new Date();
    
    try {
      console.log(`Starting ORM scan for client ${clientId} in region ${region}`);
      
      // Step 1: Search keywords using Google Custom Search API
      console.log('Step 1: Searching keywords...');
      const searchResults = await googleSearchService.searchKeywords(keywords, region, options.numResults || 10);
      
      // Step 2: Analyze sentiment using OpenAI with timeout protection
      console.log('Step 2: Analyzing sentiment...');
      const sentimentResults = await this.analyzeSentimentWithTimeout(searchResults, options.clientData);
      
      // Step 3: Get previous scan for comparison
      console.log('Step 3: Comparing with previous scan...');
      const previousScan = await this.getPreviousScan(clientId, region);
      
      // Step 4: Compare ranks
      const currentScan = {
        id: scanId,
        clientId: clientId,
        region: region,
        keywords: this.groupResultsByKeyword(sentimentResults),
        scanDate: scanStartTime,
        status: this.scanStatus.COMPLETED
      };
      
      const rankComparison = await rankComparisonService.compareRanks(currentScan, previousScan);
      
      // Step 5: Generate report summary
      console.log('Step 5: Generating report summary...');
      const reportSummary = await sentimentAnalysisService.generateReportSummary(sentimentResults, options.clientData);
      
      // Step 6: Save scan results
      const scanResults = {
        scanId: scanId,
        clientId: clientId,
        region: region,
        keywords: keywords,
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
      await this.saveScanResults(scanResults);
      
      console.log(`ORM scan completed for client ${clientId} in ${new Date() - scanStartTime}ms`);
      
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
    
    for (const result of results) {
      if (!grouped[result.keyword]) {
        grouped[result.keyword] = {
          keyword: result.keyword,
          position: result.position,
          links: []
        };
      }
      
      grouped[result.keyword].links.push(result);
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
    // Query the database
    return null;
  }

  async saveScanResults(scanResults) {
    // Save to database
    console.log('Saving scan results:', scanResults.scanId);
    return scanResults;
  }

  generateScanId() {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async analyzeSentimentWithTimeout(searchResults, clientData) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⏰ Sentiment analysis timeout, using fallback');
        resolve(searchResults.map(link => ({
          ...link,
          sentiment: '-',
          confidence: '-',
          reasoning: '-',
          keywords: [],
          category: '-',
          analyzedAt: new Date().toISOString()
        })));
      }, 120000); // 2 minute timeout

      try {
        const results = await sentimentAnalysisService.analyzeSentiment(searchResults, clientData);
        clearTimeout(timeout);
        resolve(results);
      } catch (error) {
        clearTimeout(timeout);
        console.error('Sentiment analysis failed, using fallback:', error);
        resolve(searchResults.map(link => ({
          ...link,
          sentiment: '-',
          confidence: '-',
          reasoning: '-',
          keywords: [],
          category: '-',
          analyzedAt: new Date().toISOString()
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



