const express = require('express');
const router = express.Router();
const Scan = require('../models/Scan');
const { auth } = require('../middleware/auth');

// Get notifications for admin and client
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const notifications = [];
    
    // Get scans based on user role
    let scans;
    if (req.user.role === 'admin') {
      // Admin sees all scans
      scans = await Scan.find({})
        .populate('clientId', 'name')
        .sort({ createdAt: -1 })
        .limit(100);
    } else if (req.user.role === 'client' && req.user.clientId) {
      // Client sees only their scans
      scans = await Scan.find({ clientId: req.user.clientId })
        .populate('clientId', 'name')
        .sort({ createdAt: -1 })
        .limit(100);
    } else {
      scans = [];
    }
    
    // Check for scans that are due (nextAutoScanDate has passed)
    scans.forEach(scan => {
      if (scan.nextAutoScanDate) {
        const dueDate = new Date(scan.nextAutoScanDate);
        if (dueDate <= now) {
          notifications.push({
            id: `due-${scan._id}`,
            type: 'scan_due',
            title: 'Scan Due',
            message: `Scan for ${scan.clientName || scan.clientId?.name || 'Client'} (${scan.region}) is due now`,
            timestamp: dueDate,
            read: false,
            link: `/admin/reports/${scan._id}`
          });
        }
      }
    });
    
    // Check for recent completed scans (last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    scans.filter(scan => 
      scan.status === 'completed' && 
      scan.completedAt && 
      new Date(scan.completedAt) > oneDayAgo
    ).forEach(scan => {
      notifications.push({
        id: `completed-${scan._id}`,
        type: 'scan_completed',
        title: 'Scan Completed',
        message: `Scan completed for ${scan.clientName || scan.clientId?.name || 'Client'} (${scan.region})`,
        timestamp: new Date(scan.completedAt),
        read: false,
        link: `/admin/scans/${scan._id}`
      });
    });
    
    // Check for failed scans (last 7 days)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    scans.filter(scan => 
      scan.status === 'failed' && 
      (scan.completedAt ? new Date(scan.completedAt) > oneWeekAgo : new Date(scan.startedAt) > oneWeekAgo)
    ).forEach(scan => {
      notifications.push({
        id: `failed-${scan._id}`,
        type: 'scan_failed',
        title: 'Scan Failed',
        message: `Scan failed for ${scan.clientName || scan.clientId?.name || 'Client'} (${scan.region})`,
        timestamp: scan.completedAt ? new Date(scan.completedAt) : new Date(scan.startedAt),
        read: false,
        link: `/admin/scans/${scan._id}`
      });
    });
    
    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to 20 most recent
    const limitedNotifications = notifications.slice(0, 20);
    const unreadCount = limitedNotifications.filter(n => !n.read).length;
    
    res.json({
      success: true,
      notifications: limitedNotifications,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

module.exports = router;

