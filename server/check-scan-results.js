const mongoose = require('mongoose');
require('dotenv').config();

// Import the ScanResult model
const ScanResult = require('./models/ScanResult');

async function checkScanResults() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Get a sample scan result to see the structure
    const sampleResult = await ScanResult.findOne();
    
    if (sampleResult) {
      console.log('📊 Sample scan result structure:');
      console.log(JSON.stringify(sampleResult, null, 2));
    } else {
      console.log('❌ No scan results found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkScanResults();
