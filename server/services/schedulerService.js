const cron = require('node-cron');
const scanService = require('./scanService');
const Client = require('../models/Client');
const Keyword = require('../models/Keyword');

class SchedulerService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('🚀 Starting ORM scan scheduler...');

    // Run weekly scans every Monday at 9:00 AM
    cron.schedule('0 9 * * 1', async () => {
      console.log('📅 Running weekly automated scans...');
      await this.runWeeklyScans();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    // Run daily health checks at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('🔍 Running daily health check...');
      await this.runHealthCheck();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    // Run immediate scan for testing (every 5 minutes during development)
    if (process.env.NODE_ENV === 'development') {
      cron.schedule('*/5 * * * *', async () => {
        console.log('🧪 Development mode: Running test scan...');
        await this.runTestScan();
      }, {
        scheduled: true,
        timezone: 'America/New_York'
      });
    }

    this.isRunning = true;
    console.log('✅ Scheduler started successfully');
  }

  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    cron.destroy();
    this.isRunning = false;
    console.log('🛑 Scheduler stopped');
  }

  async runWeeklyScans() {
    try {
      console.log('🔄 Starting weekly automated scans...');

      // Get all active clients with auto-scan enabled
      const activeClients = await Client.find({ 
        status: 'active',
        'settings.autoScan': true 
      });

      console.log(`📊 Found ${activeClients.length} clients with auto-scan enabled`);

      for (const client of activeClients) {
        try {
          console.log(`👤 Processing client: ${client.name} (${client._id})`);

          // Get keywords for this client
          const keywords = await Keyword.find({ 
            clientId: client._id, 
            status: 'active' 
          });

          if (keywords.length === 0) {
            console.log(`⚠️  No active keywords found for client ${client.name}`);
            continue;
          }

          // Get unique regions for this client
          const regions = [...new Set(keywords.flatMap(k => k.targetRegions))];

          for (const region of regions) {
            try {
              console.log(`🌍 Running scan for ${client.name} in region ${region}`);
              
              const result = await scanService.runScan(client._id, region, 'automated');
              
              console.log(`✅ Weekly scan completed for ${client.name} in ${region}: ${result.resultsCount} results`);
              
              // Add delay between scans to avoid overwhelming the system
              await this.delay(2000);
              
            } catch (error) {
              console.error(`❌ Weekly scan failed for ${client.name} in ${region}:`, error.message);
            }
          }

          // Add delay between clients
          await this.delay(5000);
          
        } catch (error) {
          console.error(`❌ Error processing client ${client.name}:`, error.message);
        }
      }

      console.log('🎉 Weekly automated scans completed');
      
    } catch (error) {
      console.error('❌ Weekly scan process failed:', error);
    }
  }

  async runHealthCheck() {
    try {
      console.log('🏥 Running system health check...');

      // Check database connection
      const clientCount = await Client.countDocuments();
      const keywordCount = await Keyword.countDocuments();
      
      console.log(`📊 Health Check Results:`);
      console.log(`   - Clients: ${clientCount}`);
      console.log(`   - Keywords: ${keywordCount}`);
      console.log(`   - Status: Healthy ✅`);

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  async runTestScan() {
    try {
      // Only run if we have at least one client
      const clientCount = await Client.countDocuments();
      if (clientCount === 0) {
        console.log('⚠️  No clients found for test scan');
        return;
      }

      // Get the first client for testing
      const testClient = await Client.findOne({ status: 'active' });
      if (!testClient) {
        console.log('⚠️  No active clients found for test scan');
        return;
      }

      console.log(`🧪 Running test scan for client: ${testClient.name}`);
      
      // Run a test scan for US region
      const result = await scanService.runScan(testClient._id, 'US', 'test');
      console.log(`✅ Test scan completed: ${result.resultsCount} results`);
      
    } catch (error) {
      console.error('❌ Test scan failed:', error);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      nextWeeklyScan: this.getNextWeeklyScan(),
      uptime: process.uptime()
    };
  }

  getNextWeeklyScan() {
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (1 + 7 - now.getDay()) % 7);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  }
}

module.exports = new SchedulerService();

