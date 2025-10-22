const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');

// Get all reports (demo)
router.get('/', async (req, res) => {
  try {
    // Mock reports data
    const reports = [
      {
        id: '1',
        clientId: 'demo-client-1',
        clientName: 'Demo Client 1',
        region: 'US',
        weekNumber: 1,
        createdAt: new Date().toISOString(),
        summary: 'Positive trends in keyword rankings with improved sentiment analysis.',
        status: 'completed'
      },
      {
        id: '2',
        clientId: 'demo-client-2',
        clientName: 'Demo Client 2',
        region: 'UK',
        weekNumber: 2,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        summary: 'Mixed results with some keywords improving and others declining.',
        status: 'completed'
      }
    ];
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get specific report
router.get('/:reportId', async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate new report
router.post('/generate', async (req, res) => {
  try {
    const { clientId, region } = req.body;
    const report = await reportService.generateReport(clientId || 'demo-client', region || 'all');
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download PDF report
router.get('/:reportId/download/pdf', async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Generate a simple PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${report.id}.pdf"`);
    
    // For demo purposes, return a simple text response
    res.send(`
      PDF Report for ${report.clientName}
      Region: ${report.region}
      Week: ${report.weekNumber}
      
      Summary: ${report.summary}
      
      Keywords:
      ${report.keywords.map(k => `- ${k.keyword}: Position ${k.position} (${k.change})`).join('\n')}
      
      Sentiment: ${report.sentiment.overall}
      Positive: ${report.sentiment.positive}
      Negative: ${report.sentiment.negative}
      Neutral: ${report.sentiment.neutral}
    `);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download Excel report
router.get('/:reportId/download/excel', async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.reportId);
    
    // Generate a simple Excel response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report_${report.id}.xlsx"`);
    
    // For demo purposes, return a simple CSV-like response
    const csvData = `Keyword,Position,Change,Sentiment
${report.keywords.map(k => `${k.keyword},${k.position},${k.change},${k.sentiment}`).join('\n')}`;
    
    res.send(csvData);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



