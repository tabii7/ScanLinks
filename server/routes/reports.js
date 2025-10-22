const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const reportService = require('../services/reportService');
const { adminAuth, clientAuth } = require('../middleware/auth');

const router = express.Router();

// Get all reports (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { region, weekNumber, limit } = req.query;
    const filters = {};
    
    if (region) filters.region = region;
    if (weekNumber) filters.weekNumber = parseInt(weekNumber);
    
    const limitNum = parseInt(limit) || 20;
    const reports = await reportService.getAllReports(filters, limitNum);
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all reports for a client (admin)
router.get('/client/:clientId', adminAuth, async (req, res) => {
  try {
    const { region, weekNumber, limit } = req.query;
    const filters = {};
    
    if (region) filters.region = region;
    if (weekNumber) filters.weekNumber = parseInt(weekNumber);
    
    const limitNum = parseInt(limit) || 20;
    const reports = await reportService.getReports(req.params.clientId, filters);
    
    res.json(reports.slice(0, limitNum));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get reports for current client
router.get('/my-reports', clientAuth, async (req, res) => {
  try {
    const { region, weekNumber, limit } = req.query;
    const filters = {};
    
    if (region) filters.region = region;
    if (weekNumber) filters.weekNumber = parseInt(weekNumber);
    
    const limitNum = parseInt(limit) || 20;
    const reports = await reportService.getReports(req.user.clientId, filters);
    
    res.json(reports.slice(0, limitNum));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate new report
router.post('/generate', adminAuth, async (req, res) => {
  try {
    const { clientId, region } = req.body;
    const report = await reportService.generateReport(clientId || 'demo-client', region || 'all');
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate report from scan
router.post('/generate-from-scan', adminAuth, async (req, res) => {
  try {
    const { scanId, clientId, region, weekNumber } = req.body;
    
    if (!scanId || !clientId) {
      return res.status(400).json({ 
        message: 'Scan ID and Client ID are required' 
      });
    }
    
    const report = await reportService.generateReportFromScan(
      scanId, 
      clientId, 
      region || 'US', 
      weekNumber || 1
    );
    
    res.json({
      success: true,
      message: 'Report generated successfully',
      report
    });
  } catch (error) {
    console.error('Error generating report from scan:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get single report
router.get('/:reportId', adminAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single report for current client
router.get('/:reportId/my-report', clientAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Check if report belongs to current client
    if (report.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download PDF report
router.get('/:reportId/download/pdf', async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    if (!report.files?.pdf?.path) {
      return res.status(404).json({ message: 'PDF file not found' });
    }

    const filePath = path.join(__dirname, '../', report.files.pdf.path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ message: 'PDF file not found on disk' });
    }

    res.download(filePath, `report_week${report.weekNumber}_${report.region}.pdf`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download Excel report
router.get('/:reportId/download/excel', async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    if (!report.files?.excel?.path) {
      return res.status(404).json({ message: 'Excel file not found' });
    }

    const filePath = path.join(__dirname, '../', report.files.excel.path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ message: 'Excel file not found on disk' });
    }

    res.download(filePath, `report_week${report.weekNumber}_${report.region}.xlsx`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download PDF report for current client
router.get('/:reportId/my-download/pdf', clientAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Check if report belongs to current client
    if (report.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!report.files?.pdf?.path) {
      return res.status(404).json({ message: 'PDF file not found' });
    }

    const filePath = path.join(__dirname, '../', report.files.pdf.path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ message: 'PDF file not found on disk' });
    }

    res.download(filePath, `report_week${report.weekNumber}_${report.region}.pdf`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download Excel report for current client
router.get('/:reportId/my-download/excel', clientAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Check if report belongs to current client
    if (report.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!report.files?.excel?.path) {
      return res.status(404).json({ message: 'Excel file not found' });
    }

    const filePath = path.join(__dirname, '../', report.files.excel.path);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ message: 'Excel file not found on disk' });
    }

    res.download(filePath, `report_week${report.weekNumber}_${report.region}.xlsx`);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Regenerate report
router.post('/:reportId/regenerate', adminAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Delete old files
    if (report.files?.pdf?.path) {
      try {
        await fs.unlink(path.join(__dirname, '../', report.files.pdf.path));
      } catch (error) {
        console.log('Old PDF file not found or already deleted');
      }
    }
    
    if (report.files?.excel?.path) {
      try {
        await fs.unlink(path.join(__dirname, '../', report.files.excel.path));
      } catch (error) {
        console.log('Old Excel file not found or already deleted');
      }
    }

    // Regenerate report
    const updatedReport = await reportService.generateReport(
      report.scanId,
      report.clientId,
      report.region,
      report.weekNumber
    );

    res.json({ message: 'Report regenerated successfully', report: updatedReport });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get report statistics
router.get('/:reportId/stats', adminAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    res.json({
      summary: report.summary,
      aiSummary: report.aiSummary,
      generatedAt: report.generatedAt,
      status: report.status,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get report statistics for current client
router.get('/:reportId/my-stats', clientAuth, async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Check if report belongs to current client
    if (report.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({
      summary: report.summary,
      aiSummary: report.aiSummary,
      generatedAt: report.generatedAt,
      status: report.status,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
