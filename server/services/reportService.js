const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ReportService {
  async generatePDFReport(reportData) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'ORM Report',
          Author: 'ACE REPUTATIONS',
          Subject: `ORM Report for ${reportData.clientName || 'Client'}`
        }
      });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to draw a table with improved styling
      const drawTable = (x, y, rows, options = {}) => {
        const { columnWidths, headerStyle, rowHeight = 25, alternateRows = false } = options;
        let currentY = y;
        const colCount = rows[0]?.length || 0;
        const widths = columnWidths || [contentWidth / colCount];
        
        rows.forEach((row, rowIndex) => {
          let currentX = x;
          const isHeader = rowIndex === 0;
          const isEvenRow = rowIndex > 0 && rowIndex % 2 === 0;
          
          row.forEach((cell, colIndex) => {
            const width = widths[colIndex] || widths[0];
            
            // Fill background first
            if (isHeader) {
              // Header: Purple gradient background
              doc.rect(currentX, currentY, width, rowHeight)
                .fillColor('#6C24E5')
                .fill();
            } else if (alternateRows && isEvenRow) {
              // Alternate rows: Light gray background
              doc.rect(currentX, currentY, width, rowHeight)
                .fillColor('#F9FAFB')
                .fill();
            }
            
            // Draw cell border (thicker for header)
            doc.rect(currentX, currentY, width, rowHeight)
              .lineWidth(isHeader ? 1 : 0.5)
              .strokeColor(isHeader ? '#4B0082' : '#E5E7EB')
              .stroke();
            
            // Add text with proper alignment and padding
            const cellPadding = isHeader ? 8 : 6;
            const fontSize = isHeader ? 11 : 9;
            const textColor = isHeader ? '#FFFFFF' : '#1F2937';
            
            // Determine alignment based on column
            let align = 'left';
            if (colIndex === row.length - 1) {
              align = 'right'; // Last column: right align
            } else if (colIndex === 2 || colIndex === 4) {
              align = 'center'; // Rank columns: center align
            } else if (colIndex === 1 || colIndex === 3) {
              align = 'center'; // Sentiment columns: center align
            }
            
            doc.fontSize(fontSize)
              .fillColor(textColor)
              .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
              .text(cell || '', currentX + cellPadding, currentY + (rowHeight - fontSize) / 2, {
                width: width - (cellPadding * 2),
                align: align
              });
            
            currentX += width;
          });
          
          currentY += rowHeight;
        });
        
        return currentY;
      };

      // Professional Header Design
      const headerHeight = 100;
      
      // Main header background with gradient effect
      doc.rect(margin, yPosition, contentWidth, headerHeight)
        .fillColor('#6C24E5')
        .fill();
      
      // Add accent line at top
      doc.rect(margin, yPosition, contentWidth, 4)
        .fillColor('#8B5CF6')
        .fill();
      
      // Company name - larger and bold
      doc.fontSize(28)
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .text('ACE REPUTATIONS', margin + 20, yPosition + 20);
      
      // Subtitle
      doc.fontSize(12)
        .fillColor('#E9D5FF')
        .font('Helvetica')
        .text('Online Reputation Management Platform', margin + 20, yPosition + 50);
      
      // Report type badge
      doc.roundedRect(margin + contentWidth - 150, yPosition + 15, 130, 30, 5)
        .lineWidth(2)
        .strokeColor('#FFFFFF')
        .fillColor('rgba(255, 255, 255, 0.2)')
        .fill()
        .stroke();
      
      doc.fontSize(11)
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .text('ORM REPORT', margin + contentWidth - 145, yPosition + 25, {
          align: 'center',
          width: 120
        });
      
      // Client name in a highlighted box
      doc.roundedRect(margin + 20, yPosition + 60, contentWidth - 40, 30, 5)
        .fillColor('rgba(255, 255, 255, 0.15)')
        .fill();
      
      doc.fontSize(16)
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .text(`Client: ${reportData.clientName || 'N/A'}`, margin + 30, yPosition + 70);
      
      yPosition += headerHeight + 20;

      // Report Metadata - Modern Card Design
      const weekDisplay = reportData.weekNumbers ? 
        reportData.weekNumbers.join(', ') : 
        (Array.isArray(reportData.weekNumber) ? reportData.weekNumber.join(', ') : (reportData.weekNumber || '1'));
      
      const metadataItems = [
        { label: 'Generated', value: new Date(reportData.generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Region', value: reportData.region || 'All' },
        { label: 'Weeks', value: weekDisplay },
        { label: 'Total Weeks', value: (reportData.totalWeeks || (reportData.weekNumbers?.length || 1)).toString() },
        { label: 'Status', value: 'Completed' }
      ];
      
      // Create metadata cards in a grid (2 columns)
      const cardWidth = (contentWidth - 20) / 2;
      const cardHeight = 50;
      let cardRow = 0;
      let cardCol = 0;
      
      metadataItems.forEach((item, index) => {
        const cardX = margin + (cardCol * (cardWidth + 20));
        const cardY = yPosition + (cardRow * (cardHeight + 15));
        
        // Card background with shadow effect
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
          .lineWidth(1.5)
          .strokeColor('#E5E7EB')
          .fillColor('#FFFFFF')
          .fill()
          .stroke();
        
        // Accent bar on left
        doc.rect(cardX, cardY, 4, cardHeight)
          .fillColor('#6C24E5')
          .fill();
        
        // Label
        doc.fontSize(9)
          .fillColor('#6B7280')
          .font('Helvetica')
          .text(item.label.toUpperCase(), cardX + 12, cardY + 8);
        
        // Value
        doc.fontSize(14)
          .fillColor('#1F2937')
          .font('Helvetica-Bold')
          .text(item.value, cardX + 12, cardY + 22, {
            width: cardWidth - 24,
            ellipsis: true
          });
        
        cardCol++;
        if (cardCol >= 2) {
          cardCol = 0;
          cardRow++;
        }
      });
      
      yPosition += (Math.ceil(metadataItems.length / 2) * (cardHeight + 15)) + 20;

      // Executive Summary Section - Enhanced Design
      // Section header with icon-like design
      doc.rect(margin, yPosition, 6, 28)
        .fillColor('#6C24E5')
        .fill();
      
      doc.fontSize(20)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('Executive Summary', margin + 15, yPosition + 4);
      
      doc.fontSize(10)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Overview of key metrics and performance indicators', margin + 15, yPosition + 22);
      
      yPosition += 45;

      const summaryRows = [
        ['Metric', 'Value'],
        ['Total Links', (reportData.summary?.totalLinks || 0).toString()],
        ['Positive Mentions', (reportData.summary?.positiveLinks || 0).toString()],
        ['Negative Mentions', (reportData.summary?.negativeLinks || 0).toString()],
        ['Neutral Mentions', (reportData.summary?.neutralLinks || 0).toString()]
      ];

      yPosition = drawTable(margin, yPosition, summaryRows, {
        columnWidths: [contentWidth * 0.6, contentWidth * 0.4],
        rowHeight: 32,
        alternateRows: true
      });

      yPosition += 30;

      // Ranking Changes Section - Enhanced Design
      if (yPosition > pageHeight - 200) {
            doc.addPage();
        yPosition = margin;
      }

      // Section header with icon-like design
      doc.rect(margin, yPosition, 6, 28)
        .fillColor('#6C24E5')
        .fill();
      
      doc.fontSize(20)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('Ranking Changes Overview', margin + 15, yPosition + 4);
      
      doc.fontSize(10)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Analysis of ranking movements and changes', margin + 15, yPosition + 22);
      
      yPosition += 45;

      const rankingRows = [
        ['Metric', 'Value'],
        ['Improved Rank', (reportData.summary?.improvedLinks || 0).toString()],
        ['Dropped Rank', (reportData.summary?.droppedLinks || 0).toString()],
        ['New Entries', (reportData.summary?.newLinks || 0).toString()],
        ['Unchanged', (reportData.summary?.unchangedLinks || ((reportData.summary?.totalLinks || 0) - ((reportData.summary?.improvedLinks || 0) + (reportData.summary?.droppedLinks || 0) + (reportData.summary?.newLinks || 0)))).toString()],
        ['Disappeared', (reportData.summary?.disappearedLinks || 0).toString()]
      ];

      yPosition = drawTable(margin, yPosition, rankingRows, {
        columnWidths: [contentWidth * 0.6, contentWidth * 0.4],
        rowHeight: 32,
        alternateRows: true
      });

      yPosition += 20;

      // Link Ranking Movement Table (Before vs After) - Section Header
      if (yPosition > pageHeight - 300) {
        doc.addPage();
        yPosition = margin;
      }

      const comparisonTableData = this.buildComparisonTableData(reportData);
      if (comparisonTableData && comparisonTableData.length > 0) {
        // Section header with icon-like design
        doc.rect(margin, yPosition, 6, 28)
          .fillColor('#6C24E5')
          .fill();
        
        doc.fontSize(20)
          .fillColor('#1F2937')
          .font('Helvetica-Bold')
          .text('Link Ranking Movement Analysis', margin + 15, yPosition + 4);
        
        doc.fontSize(10)
          .fillColor('#6B7280')
          .font('Helvetica')
          .text('Detailed comparison: Before vs After rankings', margin + 15, yPosition + 22);
        
        yPosition += 45;

        // Table headers
        const tableHeaders = [
          'Link',
          'Sentiment Before',
          'Rank Before',
          'Sentiment After',
          'Rank After',
          'Movement'
        ];

        // Calculate column widths for 6 columns
        const linkColWidth = contentWidth * 0.35;
        const sentimentColWidth = contentWidth * 0.12;
        const rankColWidth = contentWidth * 0.08;
        const movementColWidth = contentWidth * 0.25;
        const columnWidths = [
          linkColWidth,
          sentimentColWidth,
          rankColWidth,
          sentimentColWidth,
          rankColWidth,
          movementColWidth
        ];

        // Draw header row with better styling
        const headerRow = [tableHeaders];
        yPosition = drawTable(margin, yPosition, headerRow, {
          columnWidths: columnWidths,
          rowHeight: 32,
          alternateRows: false
        });

        // Draw data rows (limit to avoid overflow) with alternating colors
        const maxRows = Math.floor((pageHeight - yPosition - 100) / 26);
        const rowsToShow = comparisonTableData.slice(0, maxRows);
        
        const tableRows = rowsToShow.map(row => [
          (row.link || row.title || 'N/A').substring(0, 60), // Truncate long links
          row.sentimentBefore === '–' || !row.sentimentBefore ? '–' : (row.sentimentBefore.charAt(0).toUpperCase() + row.sentimentBefore.slice(1)),
          row.rankBefore === '–' || !row.rankBefore ? '–' : row.rankBefore.toString(),
          row.sentimentAfter === '–' || !row.sentimentAfter ? '–' : (row.sentimentAfter.charAt(0).toUpperCase() + row.sentimentAfter.slice(1)),
          row.rankAfter === '–' || !row.rankAfter ? '–' : row.rankAfter.toString(),
          row.movementText || '–'
        ]);

        if (tableRows.length > 0) {
          yPosition = drawTable(margin, yPosition, tableRows, {
            columnWidths: columnWidths,
            rowHeight: 26,
            alternateRows: true // Enable alternating row colors
          });
        }

        // If more rows exist, add note
        if (comparisonTableData.length > maxRows) {
          yPosition += 10;
          doc.fontSize(8)
            .fillColor('#6B7280')
            .font('Helvetica-Oblique')
            .text(`Showing ${maxRows} of ${comparisonTableData.length} links. Full data available in Excel export.`, margin, yPosition);
          yPosition += 15;
        }

        yPosition += 20;
      }

      // Analysis Section - Enhanced Design
      if (yPosition > pageHeight - 150) {
        doc.addPage();
        yPosition = margin;
      }

      // Section header with icon-like design
      doc.rect(margin, yPosition, 6, 28)
        .fillColor('#6C24E5')
        .fill();
      
      doc.fontSize(20)
        .fillColor('#1F2937')
        .font('Helvetica-Bold')
        .text('AI Analysis & Insights', margin + 15, yPosition + 4);
      
      doc.fontSize(10)
        .fillColor('#6B7280')
        .font('Helvetica')
        .text('Artificial intelligence powered analysis and recommendations', margin + 15, yPosition + 22);
      
      yPosition += 40;

      // Enhanced analysis box with modern design
      doc.roundedRect(margin, yPosition, contentWidth, 130, 10)
        .lineWidth(2)
        .strokeColor('#6C24E5')
        .fillColor('#F9FAFB')
        .fill()
        .stroke();

      // Left accent bar
      doc.rect(margin + 2, yPosition + 2, 4, 126)
        .fillColor('#6C24E5')
        .fill();

      const analysisText = reportData.aiSummary || 'No analysis available. This section will contain AI-generated insights based on the scan results.';
      
      // Add subtle background pattern
      doc.rect(margin + 10, yPosition + 10, contentWidth - 20, 110)
        .fillColor('#FFFFFF')
        .fill();

      doc.fontSize(11)
        .fillColor('#1F2937')
        .font('Helvetica')
        .text(analysisText, margin + 20, yPosition + 20, {
          width: contentWidth - 40,
          align: 'left',
          lineGap: 5
        });

      yPosition += 140;

      // Footer on each page
      const addFooter = (pageNum) => {
        doc.fontSize(8)
          .fillColor('#6B7280')
          .font('Helvetica-Oblique')
          .text('Generated by ACE REPUTATIONS ORM Platform', margin, pageHeight - 40, {
            width: contentWidth,
            align: 'center'
          });
        
        doc.text(`Page ${pageNum}`, margin, pageHeight - 25, {
          width: contentWidth,
          align: 'center'
        });
      };

      // Add footer to first page
      addFooter(1);
      
      doc.end();
    });
  }

  async generateExcelReport(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ORM Report');
    
    // Helper function to create header cell style
    const headerStyle = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C24E5' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };

    const subHeaderStyle = {
      font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      }
    };

    const cellStyle = {
      alignment: { vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      }
    };

    // Professional Report Header Section
    const headerRow1 = worksheet.addRow(['ACE REPUTATIONS - ORM REPORT']);
    headerRow1.getCell(1).font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
    headerRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C24E5' } };
    headerRow1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(`A1:F1`);
    worksheet.getRow(1).height = 40;
    
    const headerRow2 = worksheet.addRow([`Client: ${reportData.clientName || 'N/A'}`]);
    headerRow2.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
    headerRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(`A2:F2`);
    worksheet.getRow(2).height = 30;
    
    // Report Metadata - Modern Design
    let rowNum = 3;
    worksheet.addRow([]); // Empty row
    rowNum++;
    
    // Handle week numbers - support both single number, array, or weekNumbers array
    const weekDisplay = reportData.weekNumbers ? 
      reportData.weekNumbers.join(', ') : 
      (Array.isArray(reportData.weekNumber) ? reportData.weekNumber.join(', ') : (reportData.weekNumber || '1'));
    
    // Create metadata in a 2-column grid
    const metadata = [
      { label: 'Generated', value: new Date(reportData.generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
      { label: 'Region', value: reportData.region || 'All' },
      { label: 'Weeks', value: weekDisplay },
      { label: 'Total Weeks', value: (reportData.totalWeeks || (reportData.weekNumbers?.length || 1)).toString() },
      { label: 'Status', value: 'Completed' }
    ];
    
    // Create metadata cards (2 columns)
    metadata.forEach((item, index) => {
      const col = (index % 2) === 0 ? 1 : 4; // Column A or D
      const row = Math.floor(index / 2) + rowNum;
      
      // Label cell
      const labelCell = worksheet.getCell(row, col);
      labelCell.value = `${item.label}:`;
      labelCell.font = { bold: true, size: 11, color: { argb: 'FF6B7280' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      
      // Value cell
      const valueCell = worksheet.getCell(row, col + 1);
      valueCell.value = item.value;
      valueCell.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
      valueCell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
      
      // Merge cells for value
      worksheet.mergeCells(row, col + 1, row, col + 2);
    });
    
    rowNum += Math.ceil(metadata.length / 2) + 1;
    
    worksheet.addRow([]); // Empty row
    rowNum++;

    // Executive Summary Section - Enhanced Design
    const summaryHeaderRow = worksheet.addRow(['Executive Summary']);
    summaryHeaderRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FF1F2937' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: {
        top: { style: 'medium', color: { argb: 'FF6C24E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'none' },
        right: { style: 'none' }
      }
    };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;
    
    const summarySubHeaderRow = worksheet.addRow(['Overview of key metrics and performance indicators']);
    summarySubHeaderRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    summarySubHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;

    const summaryData = [
      ['Metric', 'Value'],
      ['Total Links', reportData.summary?.totalLinks || 0],
      ['Positive Mentions', reportData.summary?.positiveLinks || 0],
      ['Negative Mentions', reportData.summary?.negativeLinks || 0],
      ['Neutral Mentions', reportData.summary?.neutralLinks || 0]
    ];

    summaryData.forEach((rowData, idx) => {
      const row = worksheet.addRow(rowData);
      if (idx === 0) {
        // Header row
        row.getCell(1).style = subHeaderStyle;
        row.getCell(2).style = subHeaderStyle;
      } else {
        row.getCell(1).style = { ...cellStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } } };
        row.getCell(2).style = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'middle' } };
      }
      row.height = 25;
      rowNum++;
    });

    worksheet.addRow([]); // Empty row
    rowNum++;

    // Ranking Changes Section - Enhanced Design
    const rankingHeaderRow = worksheet.addRow(['Ranking Changes Overview']);
    rankingHeaderRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FF1F2937' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: {
        top: { style: 'medium', color: { argb: 'FF6C24E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'none' },
        right: { style: 'none' }
      }
    };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;
    
    const rankingSubHeaderRow = worksheet.addRow(['Analysis of ranking movements and changes']);
    rankingSubHeaderRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    rankingSubHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;

    const rankingData = [
      ['Metric', 'Value'],
      ['Improved Rank', reportData.summary?.improvedLinks || 0],
      ['Dropped Rank', reportData.summary?.droppedLinks || 0],
      ['New Entries', reportData.summary?.newLinks || 0],
      ['Unchanged', reportData.summary?.unchangedLinks || (reportData.summary?.totalLinks || 0) - ((reportData.summary?.improvedLinks || 0) + (reportData.summary?.droppedLinks || 0) + (reportData.summary?.newLinks || 0))],
      ['Disappeared', reportData.summary?.disappearedLinks || 0]
    ];

    rankingData.forEach((rowData, idx) => {
      const row = worksheet.addRow(rowData);
      if (idx === 0) {
        // Header row with better styling
        row.getCell(1).style = {
          font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B0082' } },
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
          border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          }
        };
        row.getCell(2).style = {
          font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B0082' } },
          alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
          border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          }
        };
      } else {
        const isEvenRow = idx % 2 === 0;
        row.getCell(1).style = { 
          ...cellStyle, 
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF' } }
        };
        row.getCell(2).style = { 
          ...cellStyle, 
          alignment: { horizontal: 'center', vertical: 'middle' },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? 'FFF9FAFB' : 'FFFFFFFF' } }
        };
      }
      row.height = 28;
      rowNum++;
    });

    worksheet.addRow([]); // Empty row
    rowNum++;

    // Link Ranking Movement Table (Before vs After) - Improved Design
    const comparisonTableData = this.buildComparisonTableData(reportData);
    if (comparisonTableData && comparisonTableData.length > 0) {
      // Section header
      const tableHeaderRow = worksheet.addRow([`${reportData.clientName || 'Client'} | Link Ranking Movement (Before vs After)`]);
      tableHeaderRow.getCell(1).style = {
        font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C24E5' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'medium', color: { argb: 'FF4B0082' } },
          bottom: { style: 'medium', color: { argb: 'FF4B0082' } },
          left: { style: 'medium', color: { argb: 'FF4B0082' } },
          right: { style: 'medium', color: { argb: 'FF4B0082' } }
        }
      };
      worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
      rowNum++;

      // Table headers with improved styling
      const headersRow = worksheet.addRow([
        'Link',
        'Sentiment Before',
        'Rank Before',
        'Sentiment After',
        'Rank After',
        'Movement'
      ]);
      
      headersRow.eachCell((cell, colNumber) => {
        cell.style = {
          font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B0082' } },
          alignment: { 
            horizontal: colNumber === 1 ? 'left' : (colNumber === 3 || colNumber === 5 ? 'center' : (colNumber === 2 || colNumber === 4 ? 'center' : 'left')),
            vertical: 'middle',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          }
        };
      });
      headersRow.height = 35;
      rowNum++;

      // Add data rows with alternating colors and better styling
      comparisonTableData.forEach((row, index) => {
        const isEvenRow = index % 2 === 0;
        const dataRow = worksheet.addRow([
          row.link || row.title || 'N/A',
          row.sentimentBefore === '–' || !row.sentimentBefore ? '–' : (row.sentimentBefore.charAt(0).toUpperCase() + row.sentimentBefore.slice(1)),
          row.rankBefore === '–' || !row.rankBefore ? '–' : row.rankBefore,
          row.sentimentAfter === '–' || !row.sentimentAfter ? '–' : (row.sentimentAfter.charAt(0).toUpperCase() + row.sentimentAfter.slice(1)),
          row.rankAfter === '–' || !row.rankAfter ? '–' : row.rankAfter,
          row.movementText || '–'
        ]);
        
        dataRow.eachCell((cell, colNumber) => {
          const baseStyle = {
            font: { size: 10, color: { argb: 'FF1F2937' } },
            alignment: { 
              horizontal: colNumber === 1 ? 'left' : (colNumber === 3 || colNumber === 5 ? 'center' : (colNumber === 2 || colNumber === 4 ? 'center' : 'left')),
              vertical: 'middle',
              wrapText: true
            },
            border: {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            }
          };

          // Alternate row background colors
          if (isEvenRow) {
            baseStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          } else {
            baseStyle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          }

          cell.style = baseStyle;
        });
        
        // Color code movement column with better colors
        const movementCell = dataRow.getCell(6);
        if (row.movement === 'improved' || row.movement === 'new') {
          movementCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          movementCell.font = { color: { argb: 'FF065F46' }, bold: true };
        } else if (row.movement === 'dropped') {
          movementCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          movementCell.font = { color: { argb: 'FF991B1B' }, bold: true };
        } else if (row.movement === 'disappeared') {
          movementCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
          movementCell.font = { color: { argb: 'FF92400E' }, bold: true };
        } else {
          movementCell.font = { color: { argb: 'FF6B7280' } };
        }
        
        dataRow.height = 28;
        rowNum++;
      });

      // Set optimized column widths for comparison table
      worksheet.getColumn(1).width = 50; // Link (wider for full URLs)
      worksheet.getColumn(2).width = 20; // Sentiment Before
      worksheet.getColumn(3).width = 14; // Rank Before (centered)
      worksheet.getColumn(4).width = 20; // Sentiment After
      worksheet.getColumn(5).width = 14; // Rank After (centered)
      worksheet.getColumn(6).width = 28; // Movement (wider for text)

      worksheet.addRow([]); // Empty row
      rowNum++;
    }

    // Analysis Section - Enhanced Design
    const analysisHeaderRow = worksheet.addRow(['AI Analysis & Insights']);
    analysisHeaderRow.getCell(1).style = {
      font: { bold: true, size: 16, color: { argb: 'FF1F2937' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: {
        top: { style: 'medium', color: { argb: 'FF6C24E5' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'none' },
        right: { style: 'none' }
      }
    };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;
    
    const analysisSubHeaderRow = worksheet.addRow(['Artificial intelligence powered analysis and recommendations']);
    analysisSubHeaderRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    analysisSubHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    rowNum++;

    const analysisRow = worksheet.addRow([reportData.aiSummary || 'No analysis available']);
    analysisRow.getCell(1).style = { ...cellStyle, alignment: { horizontal: 'left', vertical: 'top', wrapText: true } };
    worksheet.mergeCells(`A${rowNum}:F${rowNum}`);
    analysisRow.height = 60;
    rowNum++;

    worksheet.addRow([]); // Empty row
    rowNum++;

    // Footer
    const footerRow = worksheet.addRow(['Generated by ACE REPUTATIONS ORM Platform']);
    footerRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
    rowNum++;

    // Set column widths
    worksheet.getColumn(1).width = 30;
    worksheet.getColumn(2).width = 50;

    // Apply auto-fit for better readability
    worksheet.columns.forEach((column, index) => {
      if (index < 2) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 15), 50);
      }
    });
    
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

  async generateAggregateReportFromParent(parentScanId) {
    try {
      const Scan = require('../models/Scan');
      const ScanResult = require('../models/ScanResult');
      const Client = require('../models/Client');
      const Report = require('../models/Report');

      const parentScan = await Scan.findById(parentScanId);
      if (!parentScan) {
        throw new Error('Parent scan not found');
      }

      const client = await Client.findById(parentScan.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Find all child scans for this parent
      const childScans = await Scan.find({ parentId: parentScan._id }).sort({ completedAt: 1, startedAt: 1 });
      const allScanIds = [parentScan._id, ...childScans.map(s => s._id)];

      // Gather all results across parent + children
      const scanResults = await ScanResult.find({ scanId: { $in: allScanIds } }).sort({ position: 1, rank: 1 });

      // Build baseline-first comparison vs parent
      const resultsByScan = new Map();
      for (const res of scanResults) {
        const key = res.scanId.toString();
        if (!resultsByScan.has(key)) resultsByScan.set(key, []);
        resultsByScan.get(key).push(res);
      }

      const baselineId = parentScan._id.toString();
      const baselineResults = resultsByScan.get(baselineId) || [];

      // Stable key by URL (fallback to title+domain)
      const getKey = (r) => (r.originalUrl || r.link || r.url || '') || `${r.title || ''}|${r.site || r.domain || ''}`;
      const getRank = (r) => r.rank || r.position || 9999;

      const baselineMap = new Map();
      for (const r of baselineResults) baselineMap.set(getKey(r), r);

      const scansInOrder = [parentScan, ...childScans];

      // Per-week movement summaries and detailed changes
      const weeklyMovements = [];
      const overall = { improved: 0, dropped: 0, unchanged: 0, new: 0, disappeared: 0 };
      const rankingChanges = []; // conforms to Report.rankingChanges entries
      const sentimentChanges = [];

      for (const scan of scansInOrder) {
        const sid = scan._id.toString();
        const childList = resultsByScan.get(sid) || [];
        const childMap = new Map();
        for (const r of childList) childMap.set(getKey(r), r);

        // Compare child vs baseline
        let improved = 0, dropped = 0, unchanged = 0, disappeared = 0, newly = 0;

        // Baseline -> child
        for (const [k, b] of baselineMap.entries()) {
          const c = childMap.get(k);
          if (!c) { disappeared++; continue; }
          const bRank = getRank(b);
          const cRank = getRank(c);
          const delta = bRank - cRank;
          let movement = 'unchanged';
          if (delta > 0) { movement = 'improved'; improved++; }
          else if (delta < 0) { movement = 'dropped'; dropped++; }
          else { unchanged++; }

          rankingChanges.push({
            url: c.originalUrl || c.link || c.url,
            previousRank: bRank,
            currentRank: cRank,
            rankChange: delta,
            movement
          });

          if (b.sentiment && c.sentiment && b.sentiment !== c.sentiment) {
            sentimentChanges.push({
              url: c.originalUrl || c.link || c.url,
              previousSentiment: b.sentiment,
              currentSentiment: c.sentiment,
              sentimentChange: true
            });
          }
        }

        // Child-only new
        for (const [k, c] of childMap.entries()) {
          if (!baselineMap.has(k)) newly++;
        }

        weeklyMovements.push({
          scanId: scan._id,
          weekNumber: scan.weekNumber,
          improved,
          dropped,
          unchanged,
          disappeared,
          new: newly,
          baselineRetentionRate: baselineResults.length > 0
            ? Math.round(((baselineResults.length - disappeared) / baselineResults.length) * 100)
            : 0
        });

        overall.improved += improved;
        overall.dropped += dropped;
        overall.unchanged += unchanged;
        overall.disappeared += disappeared;
        overall.new += newly;
      }

      // Build weeks array for the report model
      const weeks = [];
      // reuse scansInOrder computed above
      for (const s of scansInOrder) {
        const resultsForScan = scanResults.filter(r => r.scanId.toString() === s._id.toString());
        const weekSummary = this.calculateSummaryFromResults(resultsForScan);
        // augment with disappeared/new/movements from weeklyMovements (if found)
        const movement = weeklyMovements.find(w => w.scanId.toString() === s._id.toString());
        const enrichedSummary = movement ? {
          ...weekSummary,
          disappearedLinks: movement.disappeared,
          newLinks: weekSummary.newLinks, // already computed from results
          improvedLinks: weekSummary.improvedLinks,
          droppedLinks: weekSummary.droppedLinks,
          baselineRetentionRate: movement.baselineRetentionRate
        } : weekSummary;

        weeks.push({
          weekNumber: s.weekNumber,
          scanId: s._id,
          completedAt: s.completedAt || s.startedAt || new Date(),
          resultsCount: resultsForScan.length,
          summary: enrichedSummary
        });
      }

      const summary = this.calculateSummaryFromResults(scanResults);
      const aiSummary = await this.generateAISummary(scanResults, client);

      const report = new Report({
        clientId: parentScan.clientId,
        scanId: parentScan._id,
        weekNumber: parentScan.weekNumber,
        region: parentScan.region,
        reportType: 'weekly_comparison',
        status: 'completed',
        summary,
        aiSummary,
        weeks,
        comparisonData: {
          previousWeek: {
            weekNumber: parentScan.weekNumber,
            scanId: parentScan._id,
            resultsCount: baselineResults.length,
            summary: this.calculateSummaryFromResults(baselineResults)
          },
          currentWeek: weeks[weeks.length - 1] ? {
            weekNumber: weeks[weeks.length - 1].weekNumber,
            scanId: weeks[weeks.length - 1].scanId,
            resultsCount: weeks[weeks.length - 1].resultsCount,
            summary: weeks[weeks.length - 1].summary
          } : undefined,
          changes: {
            newResults: overall.new,
            disappearedResults: overall.disappeared,
            commonResults: Math.max(baselineResults.length - weeklyMovements[weeklyMovements.length - 1]?.disappeared || 0, 0),
            totalChange: overall.improved + overall.dropped + overall.new + overall.disappeared
          },
          movement: {
            improved: overall.improved,
            dropped: overall.dropped,
            unchanged: overall.unchanged,
            new: overall.new,
            disappeared: overall.disappeared
          },
          sentimentChanges,
          rankingChanges
        },
        generatedAt: new Date()
      });

      await report.save();

      const reportData = {
        clientName: client.name,
        region: parentScan.region,
        weekNumber: parentScan.weekNumber,
        summary,
        aiSummary,
        scanResults,
        keywords: parentScan.keywords || [],
        generatedAt: new Date()
      };

      const pdfFile = await this.saveReport(reportData, 'pdf');
      const excelFile = await this.saveReport(reportData, 'xlsx');

      report.files = {
        pdf: { path: pdfFile.filepath, url: `/reports/${report._id}/download/pdf`, size: pdfFile.size },
        excel: { path: excelFile.filepath, url: `/reports/${report._id}/download/excel`, size: excelFile.size }
      };

      await report.save();
      return report;
    } catch (error) {
      console.error('Error generating aggregate report:', error);
      throw error;
    }
  }

  buildComparisonTableData(reportData) {
    try {
      // If reportData has comparisonData, use it
      if (reportData.comparisonData && reportData.comparisonData.rankingChanges) {
        const rankingChanges = reportData.comparisonData.rankingChanges;
        const sentimentChanges = reportData.comparisonData.sentimentChanges || [];
        
        // Create a map of sentiment changes by URL
        const sentimentMap = new Map();
        sentimentChanges.forEach(sc => {
          const key = (sc.url || '').toLowerCase().trim();
          if (key) {
            sentimentMap.set(key, sc);
          }
        });

        // Build comparison rows from rankingChanges
        const comparisonData = rankingChanges.map(rc => {
          const urlKey = (rc.url || '').toLowerCase().trim();
          const sentimentChange = sentimentMap.get(urlKey);
          
          // Determine movement text
          let movementText = '–';
          if (rc.movement === 'improved') {
            const change = Math.abs(rc.rankChange || 0);
            movementText = `⬆️ ${change}`;
          } else if (rc.movement === 'dropped') {
            const change = Math.abs(rc.rankChange || 0);
            movementText = `⬇️ ${change}`;
          } else if (rc.movement === 'new') {
            const sentiment = sentimentChange?.currentSentiment || 'neutral';
            movementText = sentiment === 'positive' ? '⬆️ New Positive' : sentiment === 'negative' ? '⬆️ New Negative' : '⬆️ New';
          } else if (rc.movement === 'disappeared') {
            movementText = '✗ Disappeared';
          }

          return {
            link: rc.url || 'N/A',
            title: rc.url || 'N/A',
            sentimentBefore: sentimentChange?.previousSentiment || '–',
            rankBefore: rc.previousRank || '–',
            sentimentAfter: sentimentChange?.currentSentiment || '–',
            rankAfter: rc.currentRank || '–',
            movement: rc.movement || 'unchanged',
            movementText
          };
        });

        // Sort by rank after (or before if no after rank)
        return comparisonData.sort((a, b) => {
          const rankA = a.rankAfter === '–' ? (a.rankBefore === '–' ? 999 : Number(a.rankBefore) || 999) : Number(a.rankAfter) || 999;
          const rankB = b.rankAfter === '–' ? (b.rankBefore === '–' ? 999 : Number(b.rankBefore) || 999) : Number(b.rankAfter) || 999;
          return rankA - rankB;
        });
      }

      // Fallback: Build from scanResults if available
      if (reportData.scanResults && Array.isArray(reportData.scanResults)) {
        // Group by scanId to find parent and latest child
        const resultsByScan = new Map();
        reportData.scanResults.forEach(result => {
          const scanId = result.scanId?.toString() || result.scanId;
          if (!resultsByScan.has(scanId)) {
            resultsByScan.set(scanId, []);
          }
          resultsByScan.get(scanId).push(result);
        });

        // Find parent scan (assuming first scan is parent, or scan with no parentId)
        const scanIds = Array.from(resultsByScan.keys());
        if (scanIds.length < 2) {
          return []; // Need at least parent + child for comparison
        }

        // Get parent results (first scan) and latest child results (last scan)
        const parentResults = resultsByScan.get(scanIds[0]) || [];
        const latestResults = resultsByScan.get(scanIds[scanIds.length - 1]) || [];

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

        // Create maps for quick lookup
        const parentMap = new Map();
        parentResults.forEach(r => {
          const url = r.url || r.link || r.originalUrl || '';
          const key = normalizeUrl(url);
          if (key) parentMap.set(key, r);
        });

        const latestMap = new Map();
        latestResults.forEach(r => {
          const url = r.url || r.link || r.originalUrl || '';
          const key = normalizeUrl(url);
          if (key) latestMap.set(key, r);
        });

        // Build comparison data
        const allUrls = new Set();
        parentResults.forEach(r => {
          const url = r.url || r.link || r.originalUrl || '';
          if (url) allUrls.add(normalizeUrl(url));
        });
        latestResults.forEach(r => {
          const url = r.url || r.link || r.originalUrl || '';
          if (url) allUrls.add(normalizeUrl(url));
        });

        const comparisonData = [];
        allUrls.forEach(urlKey => {
          const parentResult = parentMap.get(urlKey);
          const latestResult = latestMap.get(urlKey);

          if (!parentResult && !latestResult) return;

          let movementText = '–';
          if (!parentResult && latestResult) {
            const sentiment = latestResult.sentiment?.toLowerCase();
            movementText = sentiment === 'positive' ? '⬆️ New Positive' : sentiment === 'negative' ? '⬆️ New Negative' : '⬆️ New';
          } else if (parentResult && !latestResult) {
            movementText = '✗ Disappeared';
          } else if (parentResult && latestResult) {
            const beforeRank = parentResult.position || parentResult.rank || 999;
            const afterRank = latestResult.position || latestResult.rank || 999;
            const rankChange = beforeRank - afterRank;
            
            if (rankChange > 0) {
              const change = Math.abs(rankChange);
              const sentiment = latestResult.sentiment?.toLowerCase();
              if (afterRank === 1 && sentiment === 'positive') {
                movementText = `⬆️ ${change} (positive #1 secured)`;
              } else {
                movementText = `⬆️ ${change}`;
              }
            } else if (rankChange < 0) {
              movementText = `⬇️ ${Math.abs(rankChange)}`;
            }
          }

          comparisonData.push({
            link: latestResult?.title || parentResult?.title || urlKey,
            title: latestResult?.title || parentResult?.title || urlKey,
            url: latestResult?.url || latestResult?.link || latestResult?.originalUrl || parentResult?.url || parentResult?.link || parentResult?.originalUrl || urlKey,
            sentimentBefore: parentResult?.sentiment || '–',
            rankBefore: parentResult?.position || parentResult?.rank || '–',
            sentimentAfter: latestResult?.sentiment || '–',
            rankAfter: latestResult?.position || latestResult?.rank || '–',
            movement: !parentResult ? 'new' : !latestResult ? 'disappeared' : 'unchanged',
            movementText
          });
        });

        // Sort by rank after
        return comparisonData.sort((a, b) => {
          const rankA = a.rankAfter === '–' ? (a.rankBefore === '–' ? 999 : Number(a.rankBefore) || 999) : Number(a.rankAfter) || 999;
          const rankB = b.rankAfter === '–' ? (b.rankBefore === '–' ? 999 : Number(b.rankBefore) || 999) : Number(b.rankAfter) || 999;
          return rankA - rankB;
        });
      }

      return [];
    } catch (error) {
      console.error('Error building comparison table data:', error);
      return [];
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