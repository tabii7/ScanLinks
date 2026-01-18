const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const reportService = require('../services/reportService');
const { adminAuth, clientAuth } = require('../middleware/auth');
const Report = require('../models/Report');

const router = express.Router();

// Helper function to build reportData with comparison data
async function buildReportDataWithComparison(scan, client, childScans, allResults, report) {
  // Build comparison data for parent vs latest child
  let comparisonData = null;
  if (childScans.length > 0) {
    const ScanResult = require('../models/ScanResult');
    const latestChild = childScans[childScans.length - 1];
    const latestChildResults = await ScanResult.find({ scanId: latestChild._id }).sort({ position: 1 });
    const parentResults = await ScanResult.find({ scanId: scan._id }).sort({ position: 1 });
    
    // Normalize URLs for comparison
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.toLowerCase().trim();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/^www\./, '');
        normalized = normalized.replace(/\/$/, '');
        return normalized;
      } catch (e) {
        return url.toLowerCase().trim();
      }
    };

    const parentMap = new Map();
    parentResults.forEach(r => {
      const key = normalizeUrl(r.url || r.link || r.originalUrl || '');
      if (key) parentMap.set(key, r);
    });

    const latestMap = new Map();
    latestChildResults.forEach(r => {
      const key = normalizeUrl(r.url || r.link || r.originalUrl || '');
      if (key) latestMap.set(key, r);
    });

    const rankingChanges = [];
    const sentimentChanges = [];
    const allUrls = new Set();
    parentResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      if (url) allUrls.add(normalizeUrl(url));
    });
    latestChildResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      if (url) allUrls.add(normalizeUrl(url));
    });

    allUrls.forEach(urlKey => {
      const parentResult = parentMap.get(urlKey);
      const latestResult = latestMap.get(urlKey);

      if (!parentResult && !latestResult) return;

      const beforeRank = parentResult?.position || parentResult?.rank || 999;
      const afterRank = latestResult?.position || latestResult?.rank || 999;
      const rankChange = beforeRank - afterRank;
      
      let movement = 'unchanged';
      if (!parentResult && latestResult) {
        movement = 'new';
      } else if (parentResult && !latestResult) {
        movement = 'disappeared';
      } else if (rankChange > 0) {
        movement = 'improved';
      } else if (rankChange < 0) {
        movement = 'dropped';
      }

      rankingChanges.push({
        url: latestResult?.url || latestResult?.link || latestResult?.originalUrl || parentResult?.url || parentResult?.link || parentResult?.originalUrl || urlKey,
        previousRank: beforeRank,
        currentRank: afterRank,
        rankChange,
        movement
      });

      if (parentResult && latestResult && parentResult.sentiment && latestResult.sentiment && parentResult.sentiment !== latestResult.sentiment) {
        sentimentChanges.push({
          url: latestResult.url || latestResult.link || latestResult.originalUrl || urlKey,
          previousSentiment: parentResult.sentiment,
          currentSentiment: latestResult.sentiment,
          sentimentChange: true
        });
      }
    });

    comparisonData = { rankingChanges, sentimentChanges };
  }

  return {
    clientName: client?.name || scan.clientName || 'Unknown Client',
    region: scan.region,
    weekNumber: scan.weekNumber,
    weekNumbers: [scan.weekNumber, ...childScans.map(s => s.weekNumber)],
    totalWeeks: childScans.length + 1,
    summary: reportService.calculateSummaryFromResults(allResults),
    aiSummary: report?.aiSummary || 'No analysis available',
    scanResults: allResults,
    comparisonData,
    generatedAt: new Date()
  };
}

// Get all reports (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { region, weekNumber, limit, type } = req.query;
    const filters = {};
    
    if (region) filters.region = region;
    if (weekNumber) filters.weekNumber = parseInt(weekNumber);
    if (type) filters.reportType = type;
    
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

// Generate aggregate report for a parent scan (includes all child scans)
router.post('/generate-aggregate', adminAuth, async (req, res) => {
  try {
    const { parentScanId } = req.body;
    if (!parentScanId) {
      return res.status(400).json({ message: 'parentScanId is required' });
    }
    const report = await reportService.generateAggregateReportFromParent(parentScanId);
    res.json({ success: true, message: 'Aggregate report generated successfully', report });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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

// Download report by scan ID (for clients) - generates on-the-fly if needed
// IMPORTANT: These routes must come BEFORE /:reportId/download/* routes to avoid route conflicts
router.get('/scan/:scanId/download/pdf', clientAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    const Scan = require('../models/Scan');
    const ScanResult = require('../models/ScanResult');
    const Client = require('../models/Client');
    
    // Find the scan (should be a parent scan)
    const scan = await Scan.findById(scanId);
    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }
    
    // Verify the scan belongs to the current client
    const scanClientId = scan.clientId?._id?.toString() || scan.clientId?.toString();
    const userClientId = req.user.clientId?._id?.toString() || req.user.clientId?.toString();
    
    if (!scanClientId || !userClientId || scanClientId !== userClientId) {
      console.log('❌ [DOWNLOAD PDF] Client ID mismatch:', {
        scanClientId,
        userClientId,
        scanId: scan._id.toString()
      });
      return res.status(403).json({ message: 'Access denied - scan does not belong to this client' });
    }
    
    // Allow clients to download their own scans regardless of status
    
    // Check if there's an existing report for this scan
    const Report = require('../models/Report');
    let report = await Report.findOne({ scanId: scan._id });
    
    // If no report exists, generate one on-the-fly
    if (!report) {
      report = await reportService.generateAggregateReportFromParent(scanId);
    }
    
    // Generate PDF on-the-fly if file doesn't exist
    if (!report.files?.pdf?.path) {
      const client = await Client.findById(scan.clientId);
      const childScans = await Scan.find({ parentId: scan._id }).sort({ weekNumber: 1 });
      const allScanIds = [scan._id, ...childScans.map(s => s._id)];
      const allResults = await ScanResult.find({ scanId: { $in: allScanIds } }).sort({ position: 1 });
      
      const reportData = await buildReportDataWithComparison(scan, client, childScans, allResults, report);
      
      const pdfBuffer = await reportService.generatePDFReport(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ORM_Report_${reportData.clientName.replace(/\s+/g, '_')}_Weeks${reportData.weekNumbers.join('-')}.pdf"`);
      return res.send(pdfBuffer);
    }
    
    // Use existing file
    const filePath = path.join(__dirname, '../', report.files.pdf.path);
    try {
      await fs.access(filePath);
      res.download(filePath, `ORM_Report_${scan.clientName || 'Client'}_Week${scan.weekNumber}.pdf`);
    } catch (error) {
      // File doesn't exist, generate on-the-fly
      const client = await Client.findById(scan.clientId);
      const childScans = await Scan.find({ parentId: scan._id }).sort({ weekNumber: 1 });
      const allScanIds = [scan._id, ...childScans.map(s => s._id)];
      const allResults = await ScanResult.find({ scanId: { $in: allScanIds } }).sort({ position: 1 });
      
      const reportData = {
        clientName: client?.name || scan.clientName || 'Unknown Client',
        region: scan.region,
        weekNumber: scan.weekNumber,
        weekNumbers: [scan.weekNumber, ...childScans.map(s => s.weekNumber)],
        totalWeeks: childScans.length + 1,
        summary: reportService.calculateSummaryFromResults(allResults),
        aiSummary: report.aiSummary || 'No analysis available',
        scanResults: allResults,
        generatedAt: new Date()
      };
      
      const pdfBuffer = await reportService.generatePDFReport(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ORM_Report_${reportData.clientName.replace(/\s+/g, '_')}_Weeks${reportData.weekNumbers.join('-')}.pdf"`);
      return res.send(pdfBuffer);
    }
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download Excel report by scan ID (for clients) - generates on-the-fly if needed
router.get('/scan/:scanId/download/excel', clientAuth, async (req, res) => {
  try {
    const { scanId } = req.params;
    const Scan = require('../models/Scan');
    const ScanResult = require('../models/ScanResult');
    const Client = require('../models/Client');
    
    // Find the scan (should be a parent scan)
    const scan = await Scan.findById(scanId);
    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }
    
    // Verify the scan belongs to the current client
    const scanClientId = scan.clientId?._id?.toString() || scan.clientId?.toString();
    const userClientId = req.user.clientId?._id?.toString() || req.user.clientId?.toString();
    
    if (!scanClientId || !userClientId || scanClientId !== userClientId) {
      console.log('❌ [DOWNLOAD EXCEL] Client ID mismatch:', {
        scanClientId,
        userClientId,
        scanId: scan._id.toString()
      });
      return res.status(403).json({ message: 'Access denied - scan does not belong to this client' });
    }
    
    // Allow clients to download their own scans regardless of status
    
    // Check if there's an existing report for this scan
    const Report = require('../models/Report');
    let report = await Report.findOne({ scanId: scan._id });
    
    // If no report exists, generate one on-the-fly
    if (!report) {
      report = await reportService.generateAggregateReportFromParent(scanId);
    }
    
    // Generate Excel on-the-fly if file doesn't exist
    if (!report.files?.excel?.path) {
      const client = await Client.findById(scan.clientId);
      const childScans = await Scan.find({ parentId: scan._id }).sort({ weekNumber: 1 });
      const allScanIds = [scan._id, ...childScans.map(s => s._id)];
      const allResults = await ScanResult.find({ scanId: { $in: allScanIds } }).sort({ position: 1 });
      
      const reportData = await buildReportDataWithComparison(scan, client, childScans, allResults, report);
      
      const workbook = await reportService.generateExcelReport(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ORM_Report_${reportData.clientName.replace(/\s+/g, '_')}_Weeks${reportData.weekNumbers.join('-')}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    
    // Use existing file
    const filePath = path.join(__dirname, '../', report.files.excel.path);
    try {
      await fs.access(filePath);
      res.download(filePath, `ORM_Report_${scan.clientName || 'Client'}_Week${scan.weekNumber}.xlsx`);
    } catch (error) {
      // File doesn't exist, generate on-the-fly
      const client = await Client.findById(scan.clientId);
      const childScans = await Scan.find({ parentId: scan._id }).sort({ weekNumber: 1 });
      const allScanIds = [scan._id, ...childScans.map(s => s._id)];
      const allResults = await ScanResult.find({ scanId: { $in: allScanIds } }).sort({ position: 1 });
      
      const reportData = {
        clientName: client?.name || scan.clientName || 'Unknown Client',
        region: scan.region,
        weekNumber: scan.weekNumber,
        weekNumbers: [scan.weekNumber, ...childScans.map(s => s.weekNumber)],
        totalWeeks: childScans.length + 1,
        summary: reportService.calculateSummaryFromResults(allResults),
        aiSummary: report.aiSummary || 'No analysis available',
        scanResults: allResults,
        generatedAt: new Date()
      };
      
      const workbook = await reportService.generateExcelReport(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ORM_Report_${reportData.clientName.replace(/\s+/g, '_')}_Weeks${reportData.weekNumbers.join('-')}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
  } catch (error) {
    console.error('Error downloading report:', error);
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

// Delete a report and its files
router.delete('/:reportId', adminAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Delete files if present
    try {
      if (report.files?.pdf?.path) {
        await fs.unlink(path.join(__dirname, '../', report.files.pdf.path)).catch(() => {});
      }
      if (report.files?.excel?.path) {
        await fs.unlink(path.join(__dirname, '../', report.files.excel.path)).catch(() => {});
      }
    } catch (e) {}

    await Report.findByIdAndDelete(reportId);

    // Also disable any schedulers for the scans tied to this report
    try {
      const Scan = require('../models/Scan');
      const parentScanId = report.scanId;
      const scanIds = [parentScanId];
      // include any weeks referenced in the report
      if (Array.isArray(report.weeks)) {
        report.weeks.forEach(w => { if (w.scanId) scanIds.push(w.scanId); });
      }
      await Scan.updateMany(
        { _id: { $in: scanIds } },
        { $set: { autoScanEnabled: false, nextAutoScanDate: null } }
      );
      // Extra hardening: Disable all schedules for this client
      await Scan.updateMany({ clientId: report.clientId }, {
        $set: {
          autoScanEnabled: false,
          nextAutoScanDate: null
        }
      });
    } catch (e) {
      // non-fatal
    }

    res.json({ success: true, message: 'Report and related schedules removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete report', error: error.message });
  }
});
