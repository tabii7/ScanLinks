const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const schedulerService = require('../services/scheduler/schedulerService');

// Health check for this router
router.get('/health', (req, res) => {
  console.log('✅ /api/schedule router health ping');
  res.json({ success: true, router: 'schedule' });
});

// Start weekly schedule for a parent scan
router.post('/:parentId/start', adminAuth, async (req, res) => {
  try {
    const { parentId } = req.params;
    const result = await schedulerService.scheduleWeekly(parentId);
    res.json({ success: true, message: 'Weekly schedule started', ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to start schedule', error: error.message });
  }
});

// Stop weekly schedule
router.post('/:parentId/stop', adminAuth, async (req, res) => {
  try {
    const { parentId } = req.params;
    const result = await schedulerService.cancelWeekly(parentId);
    res.json({ success: true, message: 'Weekly schedule stopped', ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to stop schedule', error: error.message });
  }
});

// Get schedule status (pattern A)
router.get('/:parentId/status', async (req, res) => {
  try {
    const { parentId } = req.params;
    const status = await schedulerService.getStatus(parentId);
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(200).json({ success: true, scheduled: false });
  }
});

// Get schedule status (pattern B mirror)
router.get('/status/:parentId', async (req, res) => {
  try {
    const { parentId } = req.params;
    const status = await schedulerService.getStatus(parentId);
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(200).json({ success: true, scheduled: false });
  }
});

module.exports = router;
