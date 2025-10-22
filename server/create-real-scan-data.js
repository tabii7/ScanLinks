const mongoose = require('mongoose');
const Scan = require('./models/Scan');
const Client = require('./models/Client');
const ScanResult = require('./models/ScanResult');

async function createRealScanData() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Clear existing scans and results
    await Scan.deleteMany({});
    await ScanResult.deleteMany({});
    console.log('🗑️ Cleared existing scans and results');
    
    // Create realistic clients if they don't exist
    const clients = await Client.find({});
    console.log(`👥 Found ${clients.length} existing clients`);
    
    // Use existing clients and create additional ones if needed
    let allClients = [...clients];
    
    // If we have less than 3 clients, create additional ones
    if (allClients.length < 3) {
      const realisticClients = [
        {
          name: 'TechCorp Solutions',
          email: 'contact@techcorp.com',
          phone: '+1-555-0123',
          company: 'TechCorp Solutions Inc.',
          industry: 'Technology',
          targetAudience: 'Enterprise Clients',
          website: 'https://techcorp.com',
          description: 'Leading provider of enterprise software solutions'
        },
        {
          name: 'Digital Marketing Pro',
          email: 'info@digitalmarketingpro.com',
          phone: '+1-555-0456',
          company: 'Digital Marketing Pro LLC',
          industry: 'Marketing',
          targetAudience: 'Small to Medium Businesses',
          website: 'https://digitalmarketingpro.com',
          description: 'Full-service digital marketing agency'
        },
        {
          name: 'HealthTech Innovations',
          email: 'hello@healthtech.com',
          phone: '+1-555-0789',
          company: 'HealthTech Innovations Inc.',
          industry: 'Healthcare Technology',
          targetAudience: 'Healthcare Providers',
          website: 'https://healthtech.com',
          description: 'Innovative healthcare technology solutions'
        }
      ];
      
      for (let i = 0; i < Math.min(3 - allClients.length, realisticClients.length); i++) {
        const clientData = realisticClients[i];
        try {
          const client = new Client({
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            company: clientData.company,
            industry: clientData.industry,
            targetAudience: clientData.targetAudience,
            website: clientData.website,
            description: clientData.description,
            subscription: {
              plan: 'Premium',
              status: 'active',
              startDate: new Date(),
              endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            },
            contact: {
              email: clientData.email,
              phone: clientData.phone,
              company: clientData.company
            },
            settings: {
              industry: clientData.industry,
              targetAudience: clientData.targetAudience,
              website: clientData.website,
              keywords: ['technology', 'innovation', 'solutions'],
              negativeKeywords: ['scam', 'fraud', 'fake'],
              reputationGoals: 'Build trust and credibility',
              currentChallenges: 'Online reputation management'
            }
          });
          await client.save();
          allClients.push(client);
          console.log(`✅ Created client: ${client.name}`);
        } catch (error) {
          console.log(`⚠️ Could not create client ${clientData.name}: ${error.message}`);
        }
      }
    }
    console.log(`📊 Total clients available: ${allClients.length}`);
    
    // Create realistic scans with different clients and dates
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
        status: 'completed',
        resultsCount: 6,
        weekNumber: 41,
        daysAgo: 1,
        keywords: ['healthtech', 'healthcare technology']
      },
      {
        clientIndex: 0,
        region: 'UK',
        scanType: 'manual',
        status: 'completed',
        resultsCount: 15,
        weekNumber: 42,
        daysAgo: 0,
        keywords: ['techcorp', 'software solutions']
      }
    ];
    
    const createdScans = [];
    
    for (let i = 0; i < scanData.length; i++) {
      const data = scanData[i];
      const client = allClients[data.clientIndex % allClients.length];
      
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
        completedAt: scanDate,
        totalKeywords: data.keywords.length,
        processedKeywords: data.keywords.length
      });
      
      await scan.save();
      createdScans.push(scan);
      
      // Create realistic scan results
      const clientIndustry = client.industry || client.settings?.industry || 'Technology';
      const clientWebsite = client.website || client.settings?.website || `https://${client.name.toLowerCase().replace(/\s+/g, '')}.com`;
      
      const sampleResults = [
        {
          title: `${client.name} Official Website`,
          url: clientWebsite,
          snippet: `Learn more about ${client.name} and our ${clientIndustry.toLowerCase()} solutions.`,
          sentiment: 'positive',
          confidence: 0.95,
          position: 1,
          movement: 'new'
        },
        {
          title: `${client.name} Reviews and Testimonials`,
          url: `https://reviews.example.com/${client.name.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Customer reviews and testimonials for ${client.name}.`,
          sentiment: 'positive',
          confidence: 0.88,
          position: 2,
          movement: 'improved'
        },
        {
          title: `${client.name} News and Updates`,
          url: `https://news.example.com/${client.name.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Latest news and updates from ${client.name}.`,
          sentiment: 'neutral',
          confidence: 0.75,
          position: 3,
          movement: 'unchanged'
        }
      ];
      
      // Create additional results to match resultsCount
      for (let j = 0; j < Math.min(data.resultsCount - 3, 5); j++) {
        const additionalResult =         {
          title: `${client.name} Related Content ${j + 1}`,
          url: `https://content${j + 1}.example.com/${client.name.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Additional content related to ${client.name} and ${clientIndustry.toLowerCase()}.`,
          sentiment: j % 2 === 0 ? 'positive' : 'neutral',
          confidence: 0.6 + (j * 0.05),
          position: 4 + j,
          movement: j % 3 === 0 ? 'new' : 'unchanged'
        };
        sampleResults.push(additionalResult);
      }
      
      // Save scan results
      for (const resultData of sampleResults) {
        const scanResult = new ScanResult({
          scanId: scan._id,
          clientId: client._id,
          keywordId: new mongoose.Types.ObjectId(),
          keyword: data.keywords[0],
          title: resultData.title,
          url: resultData.url,
          description: resultData.snippet,
          sentiment: resultData.sentiment,
          confidence: resultData.confidence,
          position: resultData.position,
          movement: resultData.movement,
          rank: resultData.position,
          site: new URL(resultData.url).hostname,
          region: data.region,
          analyzedAt: scanDate
        });
        await scanResult.save();
      }
      
      console.log(`✅ Created scan ${i + 1}/${scanData.length} for ${client.name} (${data.resultsCount} results)`);
    }
    
    console.log('\n🎉 Realistic scan data created successfully!');
    
    // Verify the created data
    const finalScans = await Scan.find({}).populate('clientId', 'name email industry');
    console.log('\n📊 Created scans:');
    finalScans.forEach((scan, index) => {
      console.log(`${index + 1}. Scan ${scan._id}:`);
      console.log(`   Client: ${scan.clientId?.name || 'Unknown'}`);
      console.log(`   Email: ${scan.clientId?.email || 'No email'}`);
      console.log(`   Industry: ${scan.clientId?.industry || 'Unknown'}`);
      console.log(`   Status: ${scan.status}`);
      console.log(`   Results: ${scan.resultsCount}`);
      console.log(`   Week: ${scan.weekNumber}`);
      console.log(`   Region: ${scan.region}`);
      console.log(`   Completed: ${scan.completedAt.toLocaleDateString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error creating realistic scan data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createRealScanData();
