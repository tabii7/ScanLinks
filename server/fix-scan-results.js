const mongoose = require('mongoose');
require('dotenv').config();

// Import the ScanResult model
const ScanResult = require('./models/ScanResult');

async function fixScanResults() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB');

    // Find all scan results that don't have originalUrl field
    const scanResults = await ScanResult.find({
      $or: [
        { originalUrl: { $exists: false } },
        { originalUrl: null },
        { originalUrl: undefined }
      ]
    });

    console.log(`📊 Found ${scanResults.length} scan results to fix`);

    let fixedCount = 0;

    for (const result of scanResults) {
      try {
        // Extract originalUrl from metadata or use link/url as fallback
        const originalUrl = result.metadata?.originalUrl || result.link || result.url;
        
        if (originalUrl) {
          // Update the scan result with the originalUrl
          await ScanResult.findByIdAndUpdate(result._id, {
            $set: {
              originalUrl: originalUrl,
              originalLink: originalUrl
            }
          });

          console.log(`✅ Fixed result ${result._id}: ${originalUrl}`);
          fixedCount++;
        } else {
          console.log(`⚠️ No URL found for result ${result._id}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing result ${result._id}:`, error.message);
      }
    }

    console.log(`🎉 Fixed ${fixedCount} scan results`);
    console.log('✅ Database update complete');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixScanResults();
