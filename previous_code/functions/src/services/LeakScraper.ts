import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { URL } from 'url';
import { createObjectCsvWriter } from 'csv-writer';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  query: string;
  page: number;
  date: string;
}

class LeakScraper {
  private creatorName: string;
  private apiKey: string;
  private searchEngineId: string;
  private maxSearches: number;
  private apiCalls: number;
  private baseDir: string;
  private outputFile: string;
  private uniqueUrls: Set<string>;

  constructor(creatorName: string, apiKey: string, searchEngineId: string, maxSearches: number = 100) {
    this.creatorName = creatorName;
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
    this.maxSearches = maxSearches;
    this.apiCalls = 0;

    // Create output directory
    this.baseDir = path.join(process.cwd(), '..', 'data', 'leak_detection_results');
    fs.ensureDirSync(this.baseDir);

    // Default output file
    this.outputFile = path.join(this.baseDir, `${creatorName.replace(/\s+/g, '_')}_results.csv`);

    // Track URLs to avoid duplicates
    this.uniqueUrls = new Set<string>();

    // Load existing results if file exists
    this.loadExistingResults();
  }

  private loadExistingResults(): void {
    try {
      if (fs.existsSync(this.outputFile)) {
        const content = fs.readFileSync(this.outputFile, 'utf8');
        const lines = content.split('\n').slice(1); // Skip header
        
        lines.forEach(line => {
          if (line) {
            const parts = line.split(',');
            if (parts.length > 1) {
              const url = parts[1].replace(/"/g, '');
              this.uniqueUrls.add(url);
            }
          }
        });
        
        console.log(`✅ Loaded ${this.uniqueUrls.size} previously found URLs`);
      }
    } catch (error) {
      console.log(`ℹ️ No previous results loaded: ${error}`);
    }
  }

  private adaptiveBatchKeywords(keywords: string[], maxBatchSize: number = 1): string[][] {
    // Group keywords into batches
    return keywords.reduce((batches: string[][], keyword, index) => {
      const batchIndex = Math.floor(index / maxBatchSize);
      
      if (!batches[batchIndex]) {
        batches[batchIndex] = [];
      }
      
      batches[batchIndex].push(keyword);
      return batches;
    }, []);
  }

  private buildQuery(keywordBatch: string[]): string {
    const queryParts = keywordBatch.map(keyword => {
      // Check if the keyword already has quotes
      if (keyword.startsWith('"') && keyword.endsWith('"')) {
        return keyword;
      } else if (keyword.includes('site:')) {
        // Don't add quotes to site-specific searches
        return keyword;
      } else {
        // Add the keyword as is
        return keyword;
      }
    });

    // Join with OR operator
    return queryParts.join(' OR ');
  }

  private getDateRestrict(timeframe: string): string {
    if (timeframe === 'today') {
      return 'd1';
    } else if (timeframe.includes('days')) {
      const days = parseInt(timeframe.split(' ')[1], 10);
      return `d${days}`;
    } else if (timeframe.includes('weeks')) {
      const weeks = parseInt(timeframe.split(' ')[1], 10);
      const days = weeks * 7;
      return `d${days}`;
    } else if (timeframe.includes('months')) {
      const months = parseInt(timeframe.split(' ')[1], 10);
      const days = months * 30;
      return `d${days}`;
    } else {
      // Default to last 30 days
      return 'd30';
    }
  }

  private async searchBatch(keywordBatch: string[], dateRestrict: string, maxPages: number = 10): Promise<SearchResult[]> {
    // Build combined query
    const query = this.buildQuery(keywordBatch);
    const encodedQuery = encodeURIComponent(query);

    console.log(`\n🔍 Searching batch: ${keywordBatch.slice(0, 3).join(' | ')}...`);
    if (keywordBatch.length > 3) {
      console.log(`   ...and ${keywordBatch.length - 3} more keywords`);
    }
    console.log(`   Query: ${query.length > 100 ? query.substring(0, 100) + '...' : query}`);

    // Store results
    const batchResults: SearchResult[] = [];

    // Search with pagination
    for (let page = 1; page <= maxPages; page++) {
      // Check if we've hit our search limit
      if (this.apiCalls >= this.maxSearches) {
        console.log(`⚠️ Reached search limit (${this.apiCalls}/${this.maxSearches})`);
        return batchResults;
      }

      // Calculate start index for pagination
      const startIndex = ((page - 1) * 10) + 1;

      // Build URL parameters
      const urlParams = [
        `q=${encodedQuery}`,
        `cx=${this.searchEngineId}`,
        `key=${this.apiKey}`,
        'num=10', // Always 10 (API limit)
        `start=${startIndex}`
      ];

      // Add date restriction
      urlParams.push(`dateRestrict=${dateRestrict}`);

      // ALWAYS add exactTerms to ensure creator name is present
      urlParams.push(`exactTerms=${encodeURIComponent(this.creatorName)}`);

      // Build final URL
      const apiUrl = `https://www.googleapis.com/customsearch/v1?${urlParams.join('&')}`;

      try {
        console.log(`   📄 Page ${page}/${maxPages}...`);
        const response = await axios.get(apiUrl);
        this.apiCalls += 1;
        const data = response.data;

        // Handle API errors
        if (data.error) {
          const errorMsg = data.error.message || 'Unknown error';
          console.log(`   ⚠️ API error: ${errorMsg}`);

          // Check for quota exceeded errors
          if (errorMsg.toLowerCase().includes('quota')) {
            console.log('❌ API quota exceeded! Stopping searches.');
            return batchResults;
          }

          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer if we hit an error
          continue;
        }

        if (data.items) {
          const resultCount = data.items.length;
          let newCount = 0;
          console.log(`\n   📋 Page ${page} Results:`);

          for (let i = 0; i < resultCount; i++) {
            const item = data.items[i];
            const title = item.title || '';
            const link = item.link || '';
            const snippet = item.snippet || '';

            // Show all links in terminal
            const isNew = !this.uniqueUrls.has(link);
            const status = isNew ? '🆕' : '📎';
            console.log(`   ${status} ${i + 1}. ${title.substring(0, 50)}... - ${link}`);

            // Only add if it's a new URL
            if (isNew) {
              batchResults.push({
                title,
                url: link,
                snippet,
                query: JSON.stringify(keywordBatch),
                page,
                date: new Date().toISOString().split('T')[0]
              });
              this.uniqueUrls.add(link);
              newCount += 1;
            }
          }

          console.log(`\n   ✅ Found ${resultCount} results, ${newCount} new URLs`);

          // If we do not find new results on a new page
          if (resultCount === 0) {
            console.log('   ℹ️ No more results available');
            break;
          }
        } else {
          console.log('   ⚠️ No results found on this page');
          break; // No need to check more pages
        }

        // Respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.log(`   ⚠️ Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return batchResults;
  }

  public async runScan(keywords: string[], timeframe: string, maxSearches?: number): Promise<SearchResult[]> {
    if (maxSearches !== undefined) {
      this.maxSearches = maxSearches;
    }

    console.log(`\n🚀 Starting leak scan for: ${this.creatorName}`);
    console.log(`📅 Timeframe: ${timeframe}`);
    console.log(`🔢 Search budget: ${this.maxSearches} API calls`);
    console.log(`🔍 Using ${keywords.length} keywords: ${keywords}`);

    // Reset API calls counter
    this.apiCalls = 0;

    // Convert timeframe to date_restrict parameter
    const dateRestrict = this.getDateRestrict(timeframe);
    console.log(`ℹ️ Converted timeframe to date parameter: ${dateRestrict}`);

    // Group keywords into appropriately sized batches
    const batches = this.adaptiveBatchKeywords(keywords);
    console.log(`ℹ️ Created ${batches.length} batches of keywords`);

    // Store all results
    const allResults: SearchResult[] = [];

    // Process each batch
    for (let batchNum = 0; batchNum < batches.length; batchNum++) {
      // Check if we've hit our search limit
      if (this.apiCalls >= this.maxSearches) {
        console.log(`⚠️ Reached search limit (${this.apiCalls}/${this.maxSearches})`);
        break;
      }

      console.log(`\n🔍 Processing batch ${batchNum + 1}/${batches.length}`);

      // Search this batch with pagination
      const batchResults = await this.searchBatch(batches[batchNum], dateRestrict);
      allResults.push(...batchResults);

      // Show progress
      console.log(`Progress: ${this.apiCalls}/${this.maxSearches} API calls used (${(this.apiCalls / this.maxSearches * 100).toFixed(1)}%)`);
      console.log(`Found ${allResults.length} unique URLs so far`);

      // Save results after each batch
      await this.saveResults(allResults);
    }

    console.log(`\n✅ Scan complete! Results saved to ${this.outputFile}`);
    console.log(`🔢 API calls used: ${this.apiCalls}/${this.maxSearches}`);
    console.log(`🔗 Unique URLs found: ${allResults.length}`);

    // Print summary of top domains
    this.printDomainSummary(allResults);

    return allResults;
  }

  private printDomainSummary(results: SearchResult[]): void {
    if (!results.length) {
      return;
    }

    // Extract domains from URLs
    const domains: string[] = [];
    results.forEach(result => {
      try {
        // Extract domain from URL
        const url = new URL(result.url);
        domains.push(url.hostname);
      } catch {
        // Skip invalid URLs
      }
    });

    // Count domains
    const domainCounts: Record<string, number> = {};
    domains.forEach(domain => {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    // Sort by count
    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Print top domains
    console.log('\n📊 Top Domains with Content:');
    sortedDomains.forEach(([domain, count], i) => {
      console.log(`   ${i + 1}. ${domain}: ${count} URLs`);
    });
  }

  public async saveResults(results: SearchResult[]): Promise<void> {
    if (!results.length) {
      console.log('⚠️ No results to save');
      return;
    }

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: this.outputFile,
      header: [
        { id: 'title', title: 'title' },
        { id: 'url', title: 'url' },
        { id: 'snippet', title: 'snippet' },
        { id: 'query', title: 'query' },
        { id: 'page', title: 'page' },
        { id: 'date', title: 'date' }
      ]
    });

    await csvWriter.writeRecords(results);
    console.log(`✅ Saved ${results.length} results to ${this.outputFile}`);
  }

  public async saveTempResults(results: SearchResult[], creatorName: string): Promise<string | null> {
    if (!results.length) {
      return null;
    }

    const tempDir = path.join(process.cwd(), '..', 'data', 'temp_results');
    fs.ensureDirSync(tempDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
    const tempFile = path.join(tempDir, `${creatorName.replace(/\s+/g, '_')}_temp_${timestamp}.csv`);

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: tempFile,
      header: [
        { id: 'title', title: 'title' },
        { id: 'url', title: 'url' },
        { id: 'snippet', title: 'snippet' },
        { id: 'query', title: 'query' },
        { id: 'page', title: 'page' },
        { id: 'date', title: 'date' }
      ]
    });

    await csvWriter.writeRecords(results);
    console.log(`✅ Saved temp results to ${tempFile} for keyword learning`);

    return tempFile;
  }
}

export default LeakScraper;
