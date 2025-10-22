const ScanResult = require('../models/ScanResult');
const Scan = require('../models/Scan');

class RankingService {
  async compareRankings(currentScanId, previousScanId) {
    try {
      console.log('🔍 Comparing rankings between scans:', { currentScanId, previousScanId });
      
      // Get current scan results
      const currentResults = await ScanResult.find({ scanId: currentScanId }).sort({ position: 1 });
      console.log(`📊 Current scan has ${currentResults.length} results`);
      
      // Get previous scan results
      const previousResults = await ScanResult.find({ scanId: previousScanId }).sort({ position: 1 });
      console.log(`📊 Previous scan had ${previousResults.length} results`);
      
      // Create a map of previous results by URL for quick lookup
      const previousResultsMap = new Map();
      previousResults.forEach(result => {
        previousResultsMap.set(result.url, {
          rank: result.rank,
          position: result.position,
          sentiment: result.sentiment
        });
      });
      
      // Compare and update current results
      const updatedResults = [];
      
      for (const currentResult of currentResults) {
        const previousData = previousResultsMap.get(currentResult.url);
        
        if (previousData) {
          // URL exists in previous scan - calculate ranking change
          const rankingChange = previousData.rank - currentResult.rank; // Positive = moved up, Negative = moved down
          const rankingDirection = this.getRankingDirection(rankingChange);
          
          // Update the current result with ranking comparison data
          currentResult.previousRank = previousData.rank;
          currentResult.previousSentiment = previousData.sentiment;
          currentResult.rankingChange = rankingChange;
          currentResult.rankingDirection = rankingDirection;
          currentResult.movement = this.getMovementType(rankingDirection);
          
          console.log(`📈 URL ranking change: ${currentResult.url}`, {
            previous: previousData.rank,
            current: currentResult.rank,
            change: rankingChange,
            direction: rankingDirection
          });
        } else {
          // URL is new - wasn't in previous scan
          currentResult.rankingChange = 0;
          currentResult.rankingDirection = 'new';
          currentResult.movement = 'new';
          currentResult.previousRank = null;
          currentResult.previousSentiment = null;
          
          console.log(`🆕 New URL found: ${currentResult.url}`);
        }
        
        // Save the updated result
        await currentResult.save();
        updatedResults.push(currentResult);
      }
      
      // Check for disappeared URLs (in previous but not in current)
      const currentUrls = new Set(currentResults.map(r => r.url));
      const disappearedUrls = previousResults.filter(prev => !currentUrls.has(prev.url));
      
      console.log(`📉 ${disappearedUrls.length} URLs disappeared from rankings`);
      
      return {
        currentResults: updatedResults,
        disappearedUrls: disappearedUrls,
        totalCurrent: currentResults.length,
        totalPrevious: previousResults.length,
        newUrls: updatedResults.filter(r => r.rankingDirection === 'new').length,
        improvedUrls: updatedResults.filter(r => r.rankingDirection === 'up').length,
        declinedUrls: updatedResults.filter(r => r.rankingDirection === 'down').length,
        disappearedUrls: disappearedUrls.length
      };
      
    } catch (error) {
      console.error('❌ Error comparing rankings:', error);
      throw error;
    }
  }
  
  getRankingDirection(rankingChange) {
    if (rankingChange > 0) return 'up';      // Moved up in rankings
    if (rankingChange < 0) return 'down';     // Moved down in rankings
    return 'same';                           // Same position
  }
  
  getMovementType(rankingDirection) {
    switch (rankingDirection) {
      case 'up': return 'improved';
      case 'down': return 'dropped';
      case 'same': return 'unchanged';
      case 'new': return 'new';
      default: return 'new';
    }
  }
  
  async getRankingTrends(scanId) {
    try {
      const results = await ScanResult.find({ scanId }).sort({ position: 1 });
      
      const trends = {
        total: results.length,
        new: results.filter(r => r.rankingDirection === 'new').length,
        improved: results.filter(r => r.rankingDirection === 'up').length,
        declined: results.filter(r => r.rankingDirection === 'down').length,
        unchanged: results.filter(r => r.rankingDirection === 'same').length,
        results: results.map(result => ({
          url: result.url,
          title: result.title,
          currentRank: result.rank,
          previousRank: result.previousRank,
          rankingChange: result.rankingChange,
          rankingDirection: result.rankingDirection,
          sentiment: result.sentiment,
          previousSentiment: result.previousSentiment
        }))
      };
      
      return trends;
    } catch (error) {
      console.error('❌ Error getting ranking trends:', error);
      throw error;
    }
  }
  
  async scheduleWeeklyScan(scanId, clientId, keywords, region) {
    try {
      console.log('⏰ Scheduling weekly scan for:', { scanId, clientId, keywords, region });
      
      // This would integrate with a job scheduler like node-cron
      // For now, we'll just log the scheduling
      console.log('📅 Weekly scan scheduled for 7 days from now');
      
      // In a real implementation, you'd use:
      // - node-cron for scheduling
      // - Bull Queue for job management
      // - Redis for job storage
      
      return {
        scheduled: true,
        nextScanDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        scanId,
        clientId,
        keywords,
        region
      };
    } catch (error) {
      console.error('❌ Error scheduling weekly scan:', error);
      throw error;
    }
  }
}

module.exports = new RankingService();
