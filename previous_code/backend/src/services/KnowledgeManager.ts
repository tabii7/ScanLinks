import fs from 'fs-extra';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import { URL } from 'url';

// Define types for better type safety
export interface ContentItem {
  title: string;
  url: string;
  snippet: string;
  query: string;
  page: number;
  date: string;
  contentType?: string;
  confidence?: number;
  domain?: string;
  discovered_date: string;
  risk_score?: number;
  dmca_status?: string;
  last_checked?: string;
}

export interface MasterData {
  [creatorName: string]: ContentItem[];
}

export interface ContentStats {
  total_urls: number;
  domains: Record<string, number>;
  content_types: Record<string, number>;
  newest_content: string | null;
  oldest_content: string | null;
  confidence_levels: Record<string, number>;
  risk_assessment: {
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
  discovery_timeline: Record<string, number>;
}

class KnowledgeManager {
  private masterDir: string;
  private dataDir: string;
  private masterData: MasterData = {};

  constructor() {
    this.dataDir = path.join(process.cwd(), '..', 'data');
    this.masterDir = path.join(this.dataDir, 'master_data');
    fs.ensureDirSync(this.masterDir);
  }

  /**
   * Calculate confidence score based on content analysis
   * Higher score means higher confidence that the content belongs to the creator
   * This is a critical component for accurately identifying creator-owned content
   */
  private calculateConfidenceScore(item: any, creatorName: string): number {
    let score = 0.15; // Base score - lowered to better differentiate
    
    // Extract all text content for analysis
    const allContent = [
      item.title || '',
      item.url || '',
      item.snippet || '',
      item.contentSnippet || ''
    ].join(' ').toLowerCase();
    
    // Check for exact creator name match (case insensitive)
    const creatorNameLower = creatorName.toLowerCase();
    const creatorNameNoSpaces = creatorNameLower.replace(/\s+/g, '');
    const creatorNameHyphen = creatorNameLower.replace(/\s+/g, '-');
    const creatorNameUnderscore = creatorNameLower.replace(/\s+/g, '_');
    
    // IMPORTANT: Check if this is likely the creator's own content
    // These are strong indicators of creator-owned content
    
    // Official websites and domains
    const officialDomains = [
      `${creatorNameNoSpaces}.com`,
      `${creatorNameHyphen}.com`,
      `${creatorNameUnderscore}.com`,
      `${creatorNameNoSpaces}.net`,
      `${creatorNameHyphen}.net`,
      `${creatorNameNoSpaces}.org`,
      `${creatorNameHyphen}.org`,
      `${creatorNameNoSpaces}.co`,
      `${creatorNameHyphen}.co`,
      `${creatorNameNoSpaces}.io`,
      `${creatorNameHyphen}.io`,
      `${creatorNameNoSpaces}.me`,
      `${creatorNameHyphen}.me`
    ];
    
    // Social media and content platforms
    const socialPlatforms = [
      // YouTube patterns
      `youtube.com/c/${creatorNameNoSpaces}`,
      `youtube.com/c/${creatorNameHyphen}`,
      `youtube.com/channel/`,
      `youtube.com/user/${creatorNameNoSpaces}`,
      `youtube.com/user/${creatorNameHyphen}`,
      `youtube.com/@${creatorNameNoSpaces}`,
      `youtube.com/@${creatorNameHyphen}`,
      
      // Instagram patterns
      `instagram.com/${creatorNameNoSpaces}`,
      `instagram.com/${creatorNameHyphen}`,
      `instagram.com/${creatorNameUnderscore}`,
      
      // Twitter/X patterns
      `twitter.com/${creatorNameNoSpaces}`,
      `twitter.com/${creatorNameHyphen}`,
      `twitter.com/${creatorNameUnderscore}`,
      `x.com/${creatorNameNoSpaces}`,
      `x.com/${creatorNameHyphen}`,
      `x.com/${creatorNameUnderscore}`,
      
      // TikTok patterns
      `tiktok.com/@${creatorNameNoSpaces}`,
      `tiktok.com/@${creatorNameHyphen}`,
      `tiktok.com/@${creatorNameUnderscore}`,
      
      // Facebook patterns
      `facebook.com/${creatorNameNoSpaces}`,
      `facebook.com/${creatorNameHyphen}`,
      `facebook.com/${creatorNameUnderscore}`,
      
      // Content monetization platforms
      `onlyfans.com/${creatorNameNoSpaces}`,
      `onlyfans.com/${creatorNameHyphen}`,
      `onlyfans.com/${creatorNameUnderscore}`,
      `patreon.com/${creatorNameNoSpaces}`,
      `patreon.com/${creatorNameHyphen}`,
      `patreon.com/${creatorNameUnderscore}`,
      `fanhouse.app/${creatorNameNoSpaces}`,
      `fanhouse.app/${creatorNameHyphen}`,
      `fansly.com/${creatorNameNoSpaces}`,
      `fansly.com/${creatorNameHyphen}`,
      
      // Other platforms
      `twitch.tv/${creatorNameNoSpaces}`,
      `twitch.tv/${creatorNameHyphen}`,
      `linkedin.com/in/${creatorNameHyphen}`,
      `threads.net/@${creatorNameNoSpaces}`,
      `threads.net/@${creatorNameHyphen}`
    ];
    
    // Check for official domain patterns in URL
    const url = item.url || '';
    const urlLower = url.toLowerCase();
    const domain = this.extractDomain(urlLower);
    
    // Check if URL is an official creator domain
    if (officialDomains.some(pattern => domain === pattern)) {
      score += 0.8; // Extremely high boost for creator's own domain
      return Math.min(score, 0.95); // Cap at 95% - almost certain
    }
    
    // Check if URL matches creator's social media profiles
    if (socialPlatforms.some(pattern => urlLower.includes(pattern))) {
      score += 0.75; // Very high boost for creator's verified social platforms
      return Math.min(score, 0.9); // Cap at 90% - very high confidence
    }
    
    // Check for verified badge indicators in content
    const verifiedIndicators = ['verified account', 'official account', 'verified profile', 'official profile', 'blue check'];
    if (verifiedIndicators.some(indicator => allContent.includes(indicator)) && allContent.includes(creatorNameLower)) {
      score += 0.6; // High boost for verified accounts
    }
    
    // Check for exact creator name match (case insensitive)
    if (allContent.includes(creatorNameLower)) {
      score += 0.3; // Boost for exact creator name match
    }
    
    // Check for name parts (for cases with spelling errors or partial matches)
    const nameParts = creatorNameLower.split(' ');
    let namePartsFound = 0;
    
    for (const part of nameParts) {
      if (part.length > 2 && allContent.includes(part)) { // Only consider parts with more than 2 chars
        namePartsFound++;
      }
    }
    
    // Add score based on percentage of name parts found
    if (nameParts.length > 0) {
      score += 0.2 * (namePartsFound / nameParts.length);
    }
    
    // Penalize for leak indicators
    const leakIndicators = ['leaked', 'leak', 'hacked', 'stolen', 'private content', 'exclusive content', 'paid content', 'premium content'];
    if (leakIndicators.some(indicator => allContent.includes(indicator))) {
      score -= 0.4; // Significant penalty for leak indicators
    }
    
    // Additional boost for content on reputable platforms
    const reputablePlatforms = ['youtube.com', 'instagram.com', 'twitter.com', 'facebook.com', 'linkedin.com', 'tiktok.com'];
    if (reputablePlatforms.some(platform => urlLower.includes(platform))) {
      score += 0.1; // Small boost for reputable platforms
    }
    
    // Ensure score is within bounds
    return Math.max(0.05, Math.min(score, 0.95));
  }
  
  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      // Remove protocol and get domain
      let domain = url.replace(/(https?:\/\/)?([^/]+)(\/.*)?/i, '$2');
      
      // Remove www. if present
      domain = domain.replace(/^www\./, '');
      
      return domain;
    } catch (error) {
      return url;
    }
  }

  /**
   * Calculate risk score based on content analysis
   * @param item Content item
   * @param domain Domain information
   */
  private calculateRiskScore(item: any, domain: string): number {
    // Implementation of risk scoring algorithm
    let score = 0.5; // Base score
    
    // Adjust score based on domain reputation
    const highRiskDomains = ['leaked', 'hack', 'porn', 'xxx', 'nude', 'stolen'];
    if (highRiskDomains.some(term => domain.includes(term))) {
      score += 0.3;
    }
    
    // Adjust based on content confidence
    if (item.confidence) {
      score -= item.confidence / 100 * 0.4; // Lower risk for high confidence (creator-owned) content
    }
    
    return Math.min(Math.max(score, 0), 1); // Ensure between 0 and 1
  }

  /**
   * Read CSV file and return records
   * @param filePath Path to CSV file
   */
  private async readCsvFile(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      
      createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true }))
        .on('data', (record) => {
          records.push(record);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * Update master content with new data
   * @param tempCsvPath Path to temporary CSV file
   * @param creatorName Creator name
   */
  public async updateMasterContent(tempCsvPath: string, creatorName: string): Promise<number> {
    try {
      if (!fs.existsSync(tempCsvPath)) {
        return 0;
      }

      // Load the temp CSV with new results
      const newRecords = await this.readCsvFile(tempCsvPath);
      
      // Normalize creator name for file operations
      const normalizedName = creatorName.replace(/\s+/g, '_').toLowerCase();
      
      // Get master file path
      const masterFilePath = path.join(this.masterDir, `${normalizedName}_master.json`);
      
      // Load existing data if available
      if (fs.existsSync(masterFilePath)) {
        try {
          const existingData = await fs.readJson(masterFilePath);
          this.masterData[normalizedName] = existingData;
        } catch (error) {
          console.error(`Error reading master file for ${creatorName}:`, error);
          this.masterData[normalizedName] = [];
        }
      } else {
        this.masterData[normalizedName] = [];
      }
      
      // Process new records
      let newCount = 0;
      for (const record of newRecords) {
        // Skip if URL already exists
        if (this.masterData[normalizedName].some(item => item.url === record.url)) {
          continue;
        }
        
        // Extract domain from URL
        const domain = this.extractDomain(record.url);
        
        // Calculate confidence score
        const confidence = this.calculateConfidenceScore(record, creatorName);
        
        // Calculate risk score
        const riskScore = this.calculateRiskScore(record, domain);
        
        // Add to master data
        this.masterData[normalizedName].push({
          ...record,
          domain,
          confidence,
          risk_score: riskScore,
          discovered_date: new Date().toISOString().split('T')[0],
          last_checked: new Date().toISOString().split('T')[0],
          dmca_status: 'not_filed'
        });
        
        newCount++;
      }
      
      // Save updated master data
      await fs.writeJson(masterFilePath, this.masterData[normalizedName], { spaces: 2 });
      
      return newCount;
    } catch (error) {
      console.error('Error updating master content:', error);
      return 0;
    }
  }

  /**
   * Get content statistics for a creator
   * @param creatorName Creator name
   */
  public async getContentStats(creatorName: string): Promise<ContentStats> {
    const normalizedName = creatorName.replace(/\s+/g, '_').toLowerCase();
    
    // Check if we have data in memory first
    if (!this.masterData[normalizedName] || this.masterData[normalizedName].length === 0) {
      // Try to load from file
      const masterFilePath = path.join(this.masterDir, `${normalizedName}_master.json`);
      
      if (fs.existsSync(masterFilePath)) {
        try {
          this.masterData[normalizedName] = await fs.readJson(masterFilePath);
        } catch (error) {
          console.error(`Error reading master file for ${creatorName}:`, error);
          // Return empty stats if file can't be read
          return this.getEmptyStats();
        }
      } else {
        // Return empty stats if no file exists
        return this.getEmptyStats();
      }
    }
    
    const items = this.masterData[normalizedName];
    
    if (!items || items.length === 0) {
      return this.getEmptyStats();
    }
    
    // Calculate domain distribution
    const domains: Record<string, number> = {};
    items.forEach(item => {
      const domain = item.domain || this.extractDomain(item.url);
      domains[domain] = (domains[domain] || 0) + 1;
    });
    
    // Calculate content types
    const contentTypes: Record<string, number> = {};
    items.forEach(item => {
      const type = item.contentType || 'unknown';
      contentTypes[type] = (contentTypes[type] || 0) + 1;
    });
    
    // Calculate confidence levels
    const confidenceLevels: Record<string, number> = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    items.forEach(item => {
      const confidence = item.confidence || 0;
      if (confidence >= 75) {
        confidenceLevels.high++;
      } else if (confidence >= 40) {
        confidenceLevels.medium++;
      } else {
        confidenceLevels.low++;
      }
    });
    
    // Calculate risk assessment
    const riskAssessment = {
      high_risk: 0,
      medium_risk: 0,
      low_risk: 0
    };
    
    items.forEach(item => {
      const risk = item.risk_score || 0;
      if (risk >= 0.7) {
        riskAssessment.high_risk++;
      } else if (risk >= 0.4) {
        riskAssessment.medium_risk++;
      } else {
        riskAssessment.low_risk++;
      }
    });
    
    // Calculate timeline data
    const timeline: Record<string, number> = {};
    items.forEach(item => {
      const date = item.discovered_date ? item.discovered_date.substring(0, 7) : 'unknown'; // Format: YYYY-MM
      timeline[date] = (timeline[date] || 0) + 1;
    });
    
    // Find oldest and newest content
    let oldestContent: string | null = null;
    let newestContent: string | null = null;
    
    items.forEach(item => {
      const date = item.discovered_date;
      if (date) {
        if (!oldestContent || date < oldestContent) {
          oldestContent = date;
        }
        if (!newestContent || date > newestContent) {
          newestContent = date;
        }
      }
    });
    
    return {
      total_urls: items.length,
      domains,
      content_types: contentTypes,
      confidence_levels: confidenceLevels,
      risk_assessment: riskAssessment,
      discovery_timeline: timeline,
      oldest_content: oldestContent,
      newest_content: newestContent
    };
  }
  
  /**
   * Get empty stats object
   */
  private getEmptyStats(): ContentStats {
    return {
      total_urls: 0,
      domains: {},
      content_types: {},
      confidence_levels: {
        high: 0,
        medium: 0,
        low: 0
      },
      risk_assessment: {
        high_risk: 0,
        medium_risk: 0,
        low_risk: 0
      },
      discovery_timeline: {},
      oldest_content: null,
      newest_content: null
    };
  }

  /**
   * Export master data to various formats
   * @param creatorName Creator name
   * @param format Export format (csv, excel, json)
   */
  public async exportMasterData(creatorName: string, format: string = 'json'): Promise<string | null> {
    const normalizedName = creatorName.replace(/\s+/g, '_').toLowerCase();
    
    // Check if we have data in memory first
    if (!this.masterData[normalizedName] || this.masterData[normalizedName].length === 0) {
      // Try to load from file
      const masterFilePath = path.join(this.masterDir, `${normalizedName}_master.json`);
      
      if (fs.existsSync(masterFilePath)) {
        try {
          this.masterData[normalizedName] = await fs.readJson(masterFilePath);
        } catch (error) {
          console.error(`Error reading master file for ${creatorName}:`, error);
          return null;
        }
      } else {
        return null;
      }
    }
    
    const items = this.masterData[normalizedName];
    
    if (!items || items.length === 0) {
      return null;
    }
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(this.dataDir, 'leak_detection_results');
    fs.ensureDirSync(exportDir);
    
    // Generate export path
    const exportPath = path.join(exportDir, `${normalizedName}_master.${format}`);
    
    // Export based on format
    if (format === 'csv') {
      await this.exportToCsv(items, exportPath);
    } else if (format === 'excel') {
      await this.exportToExcel(items, exportPath);
    } else {
      // JSON format (default)
      await fs.writeJson(exportPath, items, { spaces: 2 });
    }
    
    return exportPath;
  }
  
  /**
   * Export data to CSV format
   * @param items Items to export
   * @param exportPath Export file path
   */
  private async exportToCsv(items: ContentItem[], exportPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const columns = {
        title: 'Title',
        url: 'URL',
        snippet: 'Snippet',
        domain: 'Domain',
        confidence: 'Confidence',
        risk_score: 'Risk Score',
        discovered_date: 'Discovery Date',
        last_checked: 'Last Checked',
        dmca_status: 'DMCA Status'
      };
      
      stringify(items, {
        header: true,
        columns
      })
      .pipe(createWriteStream(exportPath))
      .on('finish', () => resolve())
      .on('error', (error: any) => reject(error));
    });
  }
  
  /**
   * Export data to Excel format
   * @param items Items to export
   * @param exportPath Export file path
   */
  private async exportToExcel(items: ContentItem[], exportPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Content Leaks');
    
    // Add headers
    worksheet.columns = [
      { header: 'Title', key: 'title', width: 30 },
      { header: 'URL', key: 'url', width: 50 },
      { header: 'Snippet', key: 'snippet', width: 50 },
      { header: 'Domain', key: 'domain', width: 20 },
      { header: 'Confidence', key: 'confidence', width: 15 },
      { header: 'Risk Score', key: 'risk_score', width: 15 },
      { header: 'Discovery Date', key: 'discovered_date', width: 15 },
      { header: 'Last Checked', key: 'last_checked', width: 15 },
      { header: 'DMCA Status', key: 'dmca_status', width: 15 }
    ];
    
    // Add rows
    items.forEach(item => {
      worksheet.addRow(item);
    });
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Save workbook
    await workbook.xlsx.writeFile(exportPath);
  }
}

export default KnowledgeManager;
