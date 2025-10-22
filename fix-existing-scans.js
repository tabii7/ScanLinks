const mongoose = require('mongoose');
const Scan = require('./server/models/Scan');
const Client = require('./server/models/Client');

async function fixExistingScans() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Get all existing scans
    const scans = await Scan.find({});
    console.log(`📊 Found ${scans.length} existing scans`);
    
    // Get all clients to use for fixing scans
    const clients = await Client.find({});
    console.log(`👥 Found ${clients.length} clients`);
    
    if (clients.length === 0) {
      console.log('❌ No clients found. Please create some clients first.');
      return;
    }
    
    // Use the first client as default for existing scans
    const defaultClient = clients[0];
    console.log(`🎯 Using default client: ${defaultClient.name} (${defaultClient._id})`);
    
    // Update each scan with real client data
    for (let i = 0; i < scans.length; i++) {
      const scan = scans[i];
      
      // Update scan with real client data
      scan.clientId = defaultClient._id;
      await scan.save();
      
      console.log(`✅ Updated scan ${i + 1}/${scans.length}: ${scan._id}`);
    }
    
    console.log('🎉 All existing scans have been updated with real client data!');
    
    // Verify the updates
    const updatedScans = await Scan.find({}).populate('clientId', 'name email');
    console.log('\n📊 Updated scans:');
    updatedScans.forEach((scan, index) => {
      console.log(`${index + 1}. Scan ${scan._id}:`);
      console.log(`   Client: ${scan.clientId?.name || 'Unknown'}`);
      console.log(`   Email: ${scan.clientId?.email || 'No email'}`);
      console.log(`   Status: ${scan.status}`);
      console.log(`   Results: ${scan.resultsCount}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error fixing scans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixExistingScans();
