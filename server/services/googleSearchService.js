const axios = require('axios');

class GoogleSearchService {
  constructor() {
    // Use environment variables for API keys
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';
    this.isDemoMode = !this.apiKey || !this.searchEngineId;
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
    
    if (this.isDemoMode) {
      console.log('⚠️ Google Custom Search API not configured - using fallback');
    } else {
      console.log('✅ Google Custom Search API configured');
    }
  }

  async searchKeywords(keywords, region = 'US', numResults = 5) {
    try {
      // Check if API is configured
      if (this.isDemoMode) {
        console.log('⚠️ Google Custom Search API not configured - returning empty results');
        return [];
      }

      console.log('🔍 Using real Google Custom Search API');

      const results = [];
      
      for (const keywordObj of keywords) {
        // Extract keyword string from object
        const keyword = typeof keywordObj === 'string' ? keywordObj : keywordObj.keyword;
        console.log(`Searching for keyword: ${keyword} (requesting ${numResults} results)`);
        
        try {
          // Get multiple pages of results to reach the requested number
          const allSearchResults = await this.performMultipleSearches(keyword, region, numResults);
          
          // Process results
          const processedResults = allSearchResults.map((result, index) => {
            const cleanUrl = this.cleanAndValidateUrl(result.link);
            
            return {
              keyword: keyword,
              keywordId: keywordObj._id || keywordObj.id || null,
              title: result.title,
              link: cleanUrl,
              url: cleanUrl,
              snippet: result.snippet,
              position: index + 1,
              page: Math.ceil((index + 1) / 10),
              region: region,
              searchDate: new Date().toISOString(),
              domain: this.extractDomain(cleanUrl),
              isInternal: false,
              metadata: {
                displayLink: result.displayLink,
                formattedUrl: result.formattedUrl,
                htmlTitle: result.htmlTitle,
                htmlSnippet: result.htmlSnippet,
                originalUrl: result.link
              }
            };
          });
          
          results.push(...processedResults);
        } catch (error) {
          console.error(`Error searching for keyword "${keyword}":`, error.message);
          // Continue with other keywords
        }
      }

      return results;
    } catch (error) {
      console.error('Google Search Error:', error);
      return [];
    }
  }

  async performMultipleSearches(query, region, totalResults) {
    const allResults = [];
    const maxResultsPerPage = 10; // Google API limit
    const maxPages = Math.min(Math.ceil(totalResults / maxResultsPerPage), 10); // Google allows max 10 pages (100 results)
    
    console.log(`🔍 Fetching ${totalResults} results across ${maxPages} pages`);
    
    for (let page = 1; page <= maxPages; page++) {
      const startIndex = (page - 1) * maxResultsPerPage + 1;
      
      try {
        // Rate limiting between pages
        if (page > 1) {
          await this.enforceRateLimit();
        }
        
        const pageResults = await this.performSearch(query, region, maxResultsPerPage, startIndex);
        
        if (pageResults.length === 0) {
          console.log(`⚠️ No more results found at page ${page}, stopping`);
          break;
        }
        
        allResults.push(...pageResults);
        console.log(`✅ Page ${page}: Found ${pageResults.length} results (Total: ${allResults.length})`);
        
        // If we got fewer results than expected, we've reached the end
        if (pageResults.length < maxResultsPerPage) {
          console.log(`📄 Reached end of results at page ${page}`);
          break;
        }
        
        // If we have enough results, stop
        if (allResults.length >= totalResults) {
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        break; // Stop on error
      }
    }
    
    // Return only the requested number of results
    return allResults.slice(0, totalResults);
  }

  async performSearch(query, region, numResults, startIndex = 1) {
    const params = {
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: Math.min(numResults, 10), // Google API max is 10 per request
      start: startIndex,
      gl: region.toLowerCase(),
      hl: 'en',
      safe: 'off',
      filter: '1'
    };

    console.log(`🔍 Searching: ${query} in ${region}`);
    
    try {
      const response = await axios.get(this.baseUrl, { 
        params,
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.items) {
        console.log(`✅ Found ${response.data.items.length} results for "${query}"`);
        return response.data.items;
      } else {
        console.log(`⚠️ No results found for "${query}"`);
        return [];
      }
    } catch (error) {
      if (error.response) {
        // API error response
        console.error(`❌ Google API Error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
        
        if (error.response.status === 429) {
          console.log('⏰ Rate limit exceeded, waiting before retry...');
          await this.delay(5000); // Wait 5 seconds
          return []; // Return empty for now
        }
      } else if (error.request) {
        console.error('❌ Network Error: No response received');
      } else {
        console.error('❌ Request Error:', error.message);
      }
      
      return [];
    }
  }

  cleanAndValidateUrl(url) {
    try {
      if (!url) return '';
      
      // Remove any URL encoding issues
      let cleanUrl = decodeURIComponent(url);
      
      // Ensure it starts with http/https
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      // Validate URL
      new URL(cleanUrl);
      
      console.log(`🔗 Cleaned URL: ${cleanUrl}`);
      return cleanUrl;
    } catch (error) {
      console.error(`❌ Invalid URL: ${url}`, error.message);
      return url; // Return original if cleaning fails
    }
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      return 'unknown';
    }
  }

  // Rate limiting helper
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏰ Rate limiting: waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  // Delay helper
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  enhanceSearchQuery(keyword) {
    // Add context to improve search results
    const contexts = [
      'reviews', 'ratings', 'feedback', 'opinions', 'experiences',
      'company', 'business', 'services', 'solutions', 'provider',
      'news', 'articles', 'blog', 'updates', 'information'
    ];
    
    const randomContext = contexts[Math.floor(Math.random() * contexts.length)];
    return `${keyword} ${randomContext}`;
  }

  // Get search suggestions for a keyword
  async getSearchSuggestions(keyword) {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: keyword,
          num: 5
        }
      });
      
      return response.data.items?.map(item => ({
        suggestion: item.title,
        url: item.link
      })) || [];
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }
}

module.exports = new GoogleSearchService();