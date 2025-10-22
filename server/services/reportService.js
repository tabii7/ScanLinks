const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ReportService {
  async generatePDFReport(reportData) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('AceTrack™ ORM Report', 50, 50);
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80);
      doc.fontSize(12).text(`Client: ${reportData.clientName || 'N/A'}`, 50, 100);
      doc.fontSize(12).text(`Region: ${reportData.region || 'All'}`, 50, 120);
      
      // Summary section
      doc.fontSize(16).text('Executive Summary', 50, 160);
      doc.fontSize(12).text(reportData.aiSummary || 'No summary available', 50, 180, { width: 500 });
      
      // Statistics section
      doc.fontSize(16).text('Statistics', 50, 300);
      if (reportData.summary) {
        doc.fontSize(12).text(`Total Mentions: ${reportData.summary.totalLinks || 0}`, 70, 330);
        doc.text(`Positive: ${reportData.summary.positiveLinks || 0}`, 70, 350);
        doc.text(`Negative: ${reportData.summary.negativeLinks || 0}`, 70, 370);
        doc.text(`Neutral: ${reportData.summary.neutralLinks || 0}`, 70, 390);
        doc.text(`New Mentions: ${reportData.summary.newLinks || 0}`, 70, 410);
        doc.text(`Improved: ${reportData.summary.improvedLinks || 0}`, 70, 430);
        doc.text(`Dropped: ${reportData.summary.droppedLinks || 0}`, 70, 450);
      }
      
      // Scan results section
      doc.fontSize(16).text('Scan Results', 50, 500);
      let yPosition = 530;
      
      if (reportData.scanResults && reportData.scanResults.length > 0) {
        reportData.scanResults.slice(0, 10).forEach((result, index) => {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }
          
          doc.fontSize(12).text(`${index + 1}. ${result.title}`, 70, yPosition);
          doc.fontSize(10).text(`URL: ${result.url}`, 70, yPosition + 20);
          doc.text(`Sentiment: ${result.sentiment}`, 70, yPosition + 35);
          doc.text(`Position: ${result.position || result.rank}`, 70, yPosition + 50);
          yPosition += 80;
        });
      } else {
        doc.text('No scan results available', 70, yPosition);
      }
      
      doc.end();
    });
  }

  async generateExcelReport(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ORM Report');
    
    // Header
    worksheet.addRow(['AceTrack™ ORM Report']);
    worksheet.addRow([`Generated: ${new Date().toLocaleDateString()}`]);
    worksheet.addRow([`Client: ${reportData.clientName || 'N/A'}`]);
    worksheet.addRow([`Region: ${reportData.region || 'All'}`]);
    worksheet.addRow([]);
    
    // Summary
    worksheet.addRow(['Executive Summary']);
    worksheet.addRow([reportData.aiSummary || 'No summary available']);
    worksheet.addRow([]);
    
    // Statistics
    worksheet.addRow(['Statistics']);
    if (reportData.summary) {
      worksheet.addRow(['Total Mentions', reportData.summary.totalLinks || 0]);
      worksheet.addRow(['Positive', reportData.summary.positiveLinks || 0]);
      worksheet.addRow(['Negative', reportData.summary.negativeLinks || 0]);
      worksheet.addRow(['Neutral', reportData.summary.neutralLinks || 0]);
      worksheet.addRow(['New Mentions', reportData.summary.newLinks || 0]);
      worksheet.addRow(['Improved', reportData.summary.improvedLinks || 0]);
      worksheet.addRow(['Dropped', reportData.summary.droppedLinks || 0]);
    }
    worksheet.addRow([]);
    
    // Scan results
    worksheet.addRow(['Scan Results']);
    worksheet.addRow(['Title', 'URL', 'Sentiment', 'Position', 'Site']);
    
    if (reportData.scanResults && reportData.scanResults.length > 0) {
      reportData.scanResults.forEach(result => {
        worksheet.addRow([
          result.title,
          result.url,
          result.sentiment,
          result.position || result.rank,
          result.site || new URL(result.url).hostname
        ]);
      });
    }
    
    return workbook;
  }

  async saveReport(reportData, format = 'pdf') {
    const reportsDir = path.join(__dirname, '../reports');
    
    // Ensure reports directory exists
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `report_${reportData.clientId || 'unknown'}_${timestamp}.${format}`;
    const filepath = path.join(reportsDir, filename);
    
    if (format === 'pdf') {
      const pdfBuffer = await this.generatePDFReport(reportData);
      await fs.writeFile(filepath, pdfBuffer);
    } else if (format === 'xlsx') {
      const workbook = await this.generateExcelReport(reportData);
      await workbook.xlsx.writeFile(filepath);
    }
    
    return {
      filename,
      filepath,
      size: (await fs.stat(filepath)).size
    };
  }

  async getReport(reportId) {
    // Get report from database
    const Report = require('../models/Report');
    return await Report.findById(reportId).populate('clientId scanId');
  }

  async getAllReports(filters = {}, limit = 20) {
    const Report = require('../models/Report');
    return await Report.find(filters)
      .populate('clientId', 'name contact')
      .populate('scanId', 'keywords region status')
      .sort({ generatedAt: -1 })
      .limit(limit);
  }

  async getReports(clientId, filters = {}) {
    const Report = require('../models/Report');
    const query = { clientId, ...filters };
    return await Report.find(query)
      .populate('clientId', 'name contact')
      .populate('scanId', 'keywords region status')
      .sort({ generatedAt: -1 });
  }

  async generateReportFromScan(scanId, clientId, region, weekNumber) {
    try {
      const ScanResult = require('../models/ScanResult');
      const Client = require('../models/Client');
      const Scan = require('../models/Scan');
      
      // Get scan results for this scan
      const scanResults = await ScanResult.find({ scanId }).sort({ position: 1 });
      
      if (scanResults.length === 0) {
        throw new Error('No scan results found for this scan');
      }
      
      // Get client and scan info
      const client = await Client.findById(clientId);
      const scan = await Scan.findById(scanId);
      
      if (!client || !scan) {
        throw new Error('Client or scan not found');
      }
      
      // Calculate summary statistics from real data
      const summary = this.calculateSummaryFromResults(scanResults);
      
      // Generate AI summary
      const aiSummary = await this.generateAISummary(scanResults, client);
      
      // Create report record
      const Report = require('../models/Report');
      const report = new Report({
        clientId,
        scanId,
        weekNumber,
        region,
        reportType: 'weekly',
        status: 'completed',
        summary,
        aiSummary,
        generatedAt: new Date()
      });
      
      await report.save();
      
      // Generate PDF and Excel files
    const reportData = {
        clientName: client.name,
      region,
        weekNumber,
        summary,
        aiSummary,
        scanResults,
        keywords: scan.keywords || [],
        generatedAt: new Date()
      };
      
      // Generate files
    const pdfFile = await this.saveReport(reportData, 'pdf');
    const excelFile = await this.saveReport(reportData, 'xlsx');
      
      // Update report with file paths
      report.files = {
        pdf: {
          path: pdfFile.filepath,
          url: `/reports/${report._id}/download/pdf`,
          size: pdfFile.size
        },
        excel: {
          path: excelFile.filepath,
          url: `/reports/${report._id}/download/excel`,
          size: excelFile.size
        }
      };
      
      await report.save();
      
      return report;
    } catch (error) {
      console.error('Error generating report from scan:', error);
      throw error;
    }
  }

  calculateSummaryFromResults(scanResults) {
    const totalLinks = scanResults.length;
    const positiveLinks = scanResults.filter(r => r.sentiment === 'positive').length;
    const negativeLinks = scanResults.filter(r => r.sentiment === 'negative').length;
    const neutralLinks = scanResults.filter(r => r.sentiment === 'neutral').length;
    const newLinks = scanResults.filter(r => r.movement === 'new').length;
    const improvedLinks = scanResults.filter(r => r.movement === 'improved').length;
    const droppedLinks = scanResults.filter(r => r.movement === 'dropped').length;
    const suppressedLinks = scanResults.filter(r => r.isSuppressed).length;

    return {
      totalLinks,
      positiveLinks,
      negativeLinks,
      neutralLinks,
      newLinks,
      improvedLinks,
      droppedLinks,
      suppressedLinks
    };
  }

  async generateAISummary(scanResults, client) {
    // Generate AI summary based on real scan results
    const positiveCount = scanResults.filter(r => r.sentiment === 'positive').length;
    const negativeCount = scanResults.filter(r => r.sentiment === 'negative').length;
    const totalCount = scanResults.length;
    
    let summary = `Weekly ORM Report for ${client.name}\n\n`;
    summary += `Total Mentions: ${totalCount}\n`;
    summary += `Positive Mentions: ${positiveCount} (${Math.round((positiveCount/totalCount)*100)}%)\n`;
    summary += `Negative Mentions: ${negativeCount} (${Math.round((negativeCount/totalCount)*100)}%)\n\n`;
    
    if (negativeCount > 0) {
      const negativeResults = scanResults.filter(r => r.sentiment === 'negative');
      summary += `Areas of Concern:\n`;
      negativeResults.slice(0, 3).forEach((result, index) => {
        summary += `${index + 1}. ${result.title} - ${result.url}\n`;
      });
      summary += `\nRecommendations: Address negative mentions promptly and consider reputation management strategies.\n`;
    }
    
    if (positiveCount > 0) {
      summary += `\nPositive Highlights:\n`;
      const positiveResults = scanResults.filter(r => r.sentiment === 'positive');
      positiveResults.slice(0, 3).forEach((result, index) => {
        summary += `${index + 1}. ${result.title} - ${result.url}\n`;
      });
    }
    
    return summary;
  }
}

module.exports = new ReportService();