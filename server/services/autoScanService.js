const Scan = require('../models/Scan');
const Client = require('../models/Client');
const rankingService = require('./rankingService');

class AutoScanService {
  async scheduleWeeklyScan(scanId, clientId, keywords, region) {
    try {
      console.log('📅 Scheduling weekly auto-scan for scan:', scanId);
      
      // Update the scan to enable auto-scanning
      const nextScanDate = new Date();
      nextScanDate.setDate(nextScanDate.getDate() + 7); // 7 days from now
      
      await Scan.findByIdAndUpdate(scanId, {
        autoScanEnabled: true,
        nextAutoScanDate: nextScanDate
      });
      
      console.log('✅ Weekly auto-scan scheduled for:', nextScanDate);
      
      return {
        success: true,
        nextScanDate: nextScanDate,
        scanId: scanId,
        clientId: clientId,
        keywords: keywords,
        region: region
      };
    } catch (error) {
      console.error('❌ Error scheduling weekly scan:', error);
      throw error;
    }
  }
  
  async checkAndExecuteAutoScans() {
    try {
      console.log('🔍 Checking for auto-scans to execute...');
      
      // Find scans that are due for auto-scanning
      const dueScans = await Scan.find({
        autoScanEnabled: true,
        nextAutoScanDate: { $lte: new Date() },
        status: 'completed'
      }).populate('clientId');
      
      console.log(`📊 Found ${dueScans.length} scans due for auto-scanning`);
      
      for (const scan of dueScans) {
        try {
          console.log(`🔄 Executing auto-scan for scan ${scan._id} (${scan.clientName})`);
          
          // Create a new scan based on the original
          const newScan = new Scan({
            clientId: scan.clientId._id,
            clientName: scan.clientName,
            weekNumber: scan.weekNumber + 1, // Increment week number
            region: scan.region,
            status: 'pending',
            clientStatus: 'not_sent',
            scanType: 'automated',
            autoScanEnabled: true, // Keep auto-scanning enabled
            parentScanId: scan._id, // Reference to original scan
            totalKeywords: scan.totalKeywords,
            processedKeywords: 0,
            resultsCount: 0
          });
          
          await newScan.save();
          
          // Schedule the next auto-scan
          const nextScanDate = new Date();
          nextScanDate.setDate(nextScanDate.getDate() + 7);
          
          await Scan.findByIdAndUpdate(scan._id, {
            nextAutoScanDate: nextScanDate
          });
          
          console.log(`✅ Auto-scan created: ${newScan._id} for ${scan.clientName}`);
          console.log(`📅 Next auto-scan scheduled for: ${nextScanDate}`);
          
          // TODO: Here you would trigger the actual scan process
          // This would involve calling the Google Search API and sentiment analysis
          // For now, we just create the scan record
          
        } catch (error) {
          console.error(`❌ Error executing auto-scan for ${scan._id}:`, error);
        }
      }
      
      return {
        success: true,
        processedScans: dueScans.length,
        message: `Processed ${dueScans.length} auto-scans`
      };
      
    } catch (error) {
      console.error('❌ Error checking auto-scans:', error);
      throw error;
    }
  }
  
  async disableAutoScan(scanId) {
    try {
      console.log('🛑 Disabling auto-scan for scan:', scanId);
      
      await Scan.findByIdAndUpdate(scanId, {
        autoScanEnabled: false,
        nextAutoScanDate: null
      });
      
      console.log('✅ Auto-scan disabled for scan:', scanId);
      
      return {
        success: true,
        message: 'Auto-scan disabled successfully'
      };
    } catch (error) {
      console.error('❌ Error disabling auto-scan:', error);
      throw error;
    }
  }
  
  async getAutoScanStatus(scanId) {
    try {
      const scan = await Scan.findById(scanId);
      
      if (!scan) {
        return {
          success: false,
          message: 'Scan not found'
        };
      }
      
      return {
        success: true,
        autoScanEnabled: scan.autoScanEnabled || false,
        nextAutoScanDate: scan.nextAutoScanDate,
        parentScanId: scan.parentScanId
      };
    } catch (error) {
      console.error('❌ Error getting auto-scan status:', error);
      throw error;
    }
  }
}

module.exports = new AutoScanService();
