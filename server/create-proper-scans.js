const mongoose = require('mongoose');
const Scan = require('./models/Scan');
const Client = require('./models/Client');
const ScanResult = require('./models/ScanResult');

async function createProperScans() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Get existing clients
    const clients = await Client.find({});
    console.log(`👥 Found ${clients.length} clients`);
    
    if (clients.length === 0) {
      console.log('❌ No clients found. Please create some clients first.');
      return;
    }
    
    // Create scans with proper status and type values
    const scanData = [
      {
        clientIndex: 0,
        region: 'US',
        scanType: 'automated',
        status: 'completed',
        resultsCount: 8,
        weekNumber: 40,
        daysAgo: 7,
        keywords: ['techcorp solutions', 'enterprise software']
      },
      {
        clientIndex: 1,
        region: 'US',
        scanType: 'manual',
        status: 'completed',
        resultsCount: 12,
        weekNumber: 41,
        daysAgo: 3,
        keywords: ['digital marketing', 'online advertising']
      },
      {
        clientIndex: 2,
        region: 'CA',
        scanType: 'automated',
        status: 'running',
        resultsCount: 0,
        weekNumber: 41,
        daysAgo: 1,
        keywords: ['healthtech', 'healthcare technology']
      },
      {
        clientIndex: 0,
        region: 'UK',
        scanType: 'manual',
        status: 'failed',
        resultsCount: 0,
        weekNumber: 42,
        daysAgo: 0,
        keywords: ['techcorp', 'software solutions']
      }
    ];
    
    for (let i = 0; i < scanData.length; i++) {
      const data = scanData[i];
      const client = clients[data.clientIndex % clients.length];
      
      const scanDate = new Date();
      scanDate.setDate(scanDate.getDate() - data.daysAgo);
      
      const scan = new Scan({
        clientId: client._id,
        weekNumber: data.weekNumber,
        region: data.region,
        scanType: data.scanType,
        status: data.status,
        resultsCount: data.resultsCount,
        startedAt: new Date(scanDate.getTime() - 2 * 60 * 60 * 1000), // 2 hours before completion
        completedAt: data.status === 'completed' ? scanDate : null,
        totalKeywords: data.keywords.length,
        processedKeywords: data.status === 'completed' ? data.keywords.length : 0
      });
      
      await scan.save();
      
      // Create scan results only for completed scans
      if (data.status === 'completed' && data.resultsCount > 0) {
        const maxResults = Math.min(data.resultsCount, 10); // Limit to 10 results max
        for (let j = 0; j < maxResults; j++) {
          const scanResult = new ScanResult({
            scanId: scan._id,
            clientId: client._id,
            keywordId: new mongoose.Types.ObjectId(),
            keyword: data.keywords[0],
            title: `${client.name} Result ${j + 1}`,
            url: `https://example${j + 1}.com/${client.name.toLowerCase().replace(/\s+/g, '-')}`,
            description: `Description for ${client.name} result ${j + 1}`,
            sentiment: j % 3 === 0 ? 'positive' : j % 3 === 1 ? 'negative' : 'neutral',
            confidence: 0.6 + (j * 0.05),
            position: j + 1,
            movement: j % 2 === 0 ? 'new' : 'unchanged',
            rank: j + 1,
            site: `example${j + 1}.com`,
            region: data.region,
            analyzedAt: scanDate
          });
          await scanResult.save();
        }
      }
      
      console.log(`✅ Created scan ${i + 1}/${scanData.length} for ${client.name}:`);
      console.log(`   Status: ${scan.status}`);
      console.log(`   Type: ${scan.scanType}`);
      console.log(`   Results: ${scan.resultsCount}`);
      console.log(`   Region: ${scan.region}`);
      console.log(`   Week: ${scan.weekNumber}`);
      console.log('');
    }
    
    console.log('🎉 Proper scan data created successfully!');
    
    // Verify the created data
    const finalScans = await Scan.find({}).populate('clientId', 'name email');
    console.log('\n📊 Final scan data:');
    finalScans.forEach((scan, index) => {
      console.log(`${index + 1}. Scan ${scan._id}:`);
      console.log(`   Client: ${scan.clientId?.name || 'Unknown'}`);
      console.log(`   Status: ${scan.status}`);
      console.log(`   Type: ${scan.scanType}`);
      console.log(`   Results: ${scan.resultsCount}`);
      console.log(`   Week: ${scan.weekNumber}`);
      console.log(`   Region: ${scan.region}`);
      console.log(`   Completed: ${scan.completedAt ? scan.completedAt.toLocaleDateString() : 'Not completed'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error creating proper scan data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createProperScans();
