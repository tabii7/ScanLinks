const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { adminAuth } = require('../middleware/auth');

const Client = require('../models/Client');
const Keyword = require('../models/Keyword');
const Report = require('../models/Report');
const Scan = require('../models/Scan');
const ScanResult = require('../models/ScanResult');
const User = require('../models/User');

const router = express.Router();

// Danger: wipes DB except admin users. Call intentionally.
router.post('/reset-database', adminAuth, async (req, res) => {
  try {
    // Delete files in reports dir
    const reportsDir = path.join(__dirname, '../reports');
    try {
      const files = await fs.readdir(reportsDir);
      await Promise.all(files.map(async (f) => {
        if (f.endsWith('.pdf') || f.endsWith('.xlsx')) {
          await fs.unlink(path.join(reportsDir, f)).catch(() => {});
        }
      }));
    } catch (e) {
      // directory may not exist, ignore
    }

    // Wipe collections (order to satisfy refs)
    const deletedScanResults = await ScanResult.deleteMany({});
    const deletedScans = await Scan.deleteMany({});
    const deletedReports = await Report.deleteMany({});
    const deletedKeywords = await Keyword.deleteMany({});
    const deletedClients = await Client.deleteMany({});

    // Remove all non-admin users
    const deletedUsers = await User.deleteMany({ role: { $ne: 'admin' } });

    res.json({
      success: true,
      message: 'Database reset complete (kept admin users).',
      stats: {
        scans: deletedScans.deletedCount,
        scanResults: deletedScanResults.deletedCount,
        reports: deletedReports.deletedCount,
        keywords: deletedKeywords.deletedCount,
        clients: deletedClients.deletedCount,
        usersRemoved: deletedUsers.deletedCount,
      }
    });
  } catch (error) {
    console.error('❌ Reset DB failed:', error);
    res.status(500).json({ success: false, message: 'Reset failed', error: error.message });
  }
});

module.exports = router;


