#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack';
    await mongoose.connect(uri);

    const Client = require('../models/Client');
    const Keyword = require('../models/Keyword');
    const Report = require('../models/Report');
    const Scan = require('../models/Scan');
    const ScanResult = require('../models/ScanResult');
    const User = require('../models/User');

    // Delete data
    const r1 = await ScanResult.deleteMany({});
    const r2 = await Scan.deleteMany({});
    const r3 = await Report.deleteMany({});
    const r4 = await Keyword.deleteMany({});
    const r5 = await Client.deleteMany({});
    const r6 = await User.deleteMany({ role: { $ne: 'admin' } });

    console.log(JSON.stringify({
      success: true,
      stats: {
        scanResults: r1.deletedCount,
        scans: r2.deletedCount,
        reports: r3.deletedCount,
        keywords: r4.deletedCount,
        clients: r5.deletedCount,
        usersRemoved: r6.deletedCount,
      }
    }, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  }
}

run();


