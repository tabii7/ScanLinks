const mongoose = require('mongoose');
const Scan = require('./models/Scan');

async function fixScanStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/acetrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Get all scans
    const scans = await Scan.find({});
    console.log(`📊 Found ${scans.length} scans`);
    
    // Check and fix each scan
    for (let i = 0; i < scans.length; i++) {
      const scan = scans[i];
      console.log(`\n🔍 Scan ${i + 1}: ${scan._id}`);
      console.log(`   Current status: ${scan.status}`);
      console.log(`   Current scanType: ${scan.scanType}`);
      console.log(`   Results count: ${scan.resultsCount}`);
      console.log(`   Completed at: ${scan.completedAt}`);
      
      // Fix status based on results and completion
      let newStatus = scan.status;
      if (scan.resultsCount > 0 && scan.completedAt) {
        newStatus = 'completed';
      } else if (scan.resultsCount === 0 && !scan.completedAt) {
        newStatus = 'running';
      } else if (scan.resultsCount === 0 && scan.completedAt) {
        newStatus = 'failed';
      }
      
      // Fix scanType if needed
      let newScanType = scan.scanType;
      if (!['manual', 'scheduled', 'automated', 'creator_scan'].includes(scan.scanType)) {
        newScanType = 'manual';
      }
      
      // Update if needed
      if (newStatus !== scan.status || newScanType !== scan.scanType) {
        scan.status = newStatus;
        scan.scanType = newScanType;
        await scan.save();
        console.log(`   ✅ Updated status: ${scan.status}`);
        console.log(`   ✅ Updated scanType: ${scan.scanType}`);
      } else {
        console.log(`   ✅ Status and scanType are correct`);
      }
    }
    
    console.log('\n🎉 Scan statuses fixed!');
    
    // Verify the fixes
    const updatedScans = await Scan.find({}).populate('clientId', 'name email');
    console.log('\n📊 Final scan statuses:');
    updatedScans.forEach((scan, index) => {
      console.log(`${index + 1}. Scan ${scan._id}:`);
      console.log(`   Status: ${scan.status}`);
      console.log(`   ScanType: ${scan.scanType}`);
      console.log(`   Client: ${scan.clientId?.name || 'Unknown'}`);
      console.log(`   Results: ${scan.resultsCount}`);
      console.log(`   Completed: ${scan.completedAt ? scan.completedAt.toLocaleDateString() : 'Not completed'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error fixing scan statuses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixScanStatus();
