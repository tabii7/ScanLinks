const axios = require('axios');

class GoogleSearchService {
  constructor() {
    // Use environment variables for API keys
    // Support both GOOGLE_API_KEY and GOOGLE_SEARCH_API_KEY for compatibility
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';
    
    // Check if API keys are placeholders or not set
    const isPlaceholder = 
      !this.apiKey || 
      !this.searchEngineId ||
      (this.apiKey && (this.apiKey.includes('your_') || this.apiKey.includes('here') || this.apiKey === 'your-google-search-api-key')) ||
      (this.searchEngineId && (this.searchEngineId.includes('your_') || this.searchEngineId.includes('here') || this.searchEngineId === 'your-search-engine-id'));
    
    this.isDemoMode = isPlaceholder;
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 2 seconds between requests (matches previous_code implementation)
    
    if (this.isDemoMode) {
      console.log('⚠️ Google Custom Search API not configured');
      console.log('❌ Scans will fail if API is not properly configured');
    } else {
      console.log('✅ Google Custom Search API configured');
      console.log('ℹ️ Note: Custom Search API may return different results than regular Google search');
      console.log('ℹ️ This is normal behavior - the API uses a different index and ranking system');
    }
  }

  async searchKeywords(keywords, region = 'US', numResults = 100, searchOptions = {}, clientName = '') {
    try {
      // Check if API is configured - throw error if not
      if (this.isDemoMode) {
        const error = new Error('Google Custom Search API is not configured. Please set GOOGLE_API_KEY (or GOOGLE_SEARCH_API_KEY) and GOOGLE_SEARCH_ENGINE_ID environment variables.');
        error.code = 'API_NOT_CONFIGURED';
        console.error('❌ Google Custom Search API not configured:', error.message);
        throw error;
      }

      // Cap numResults at 100 (Google's maximum per query)
      const maxResults = Math.min(numResults, 100);
      
      // Track unique URLs across all keywords (like previous_code implementation)
      const uniqueUrls = new Set();
      const allResults = [];
      let finalSearchQuery = '';
      
      // CRITICAL: For child scans, check if we should use parent's EXACT query
      const isChildScan = searchOptions.parentId !== undefined && searchOptions.parentId !== null;
      
      if (isChildScan) {
        console.log('🔄 CHILD SCAN DETECTED - Checking for parent exact query...');
        console.log('   - parentExactQuery:', searchOptions.parentExactQuery || 'NOT PROVIDED');
        console.log('   - parentDateRestrict:', searchOptions.parentDateRestrict || 'NOT PROVIDED');
      }
      
      // Process each keyword individually (like previous_code implementation)
      // Each keyword can get up to maxResults results
      for (const keywordObj of keywords) {
        // Extract keyword string from object
        let keyword = typeof keywordObj === 'string' ? keywordObj : keywordObj.keyword;
        
        // CRITICAL: For child scans, use parent's EXACT query if provided
        // This ensures child scans use the exact same query string as parent
        let enhancedQuery;
        if (isChildScan && searchOptions.parentExactQuery) {
          // Use parent's exact query (no modifications)
          enhancedQuery = searchOptions.parentExactQuery;
          console.log(`🔄 CHILD SCAN - Using parent's exact query: ${enhancedQuery}`);
        } else {
          // Build query for parent scan (or first scan)
          // Combine client name with keyword for more targeted results (avoid duplication)
          if (clientName && !keyword.toLowerCase().includes(clientName.toLowerCase())) {
            enhancedQuery = `${clientName} ${keyword}`;
          } else {
            enhancedQuery = keyword;
          }
          
          // Add content type filters to query (EXACT same as parent)
          if (searchOptions.contentType && searchOptions.contentType !== 'all') {
            const contentTypeFilters = {
              'news': 'site:news.google.com OR site:cnn.com OR site:bbc.com OR site:reuters.com',
              'blogs': 'site:blogspot.com OR site:wordpress.com OR site:medium.com',
              'social': 'site:twitter.com OR site:facebook.com OR site:linkedin.com OR site:instagram.com',
              'forums': 'site:reddit.com OR site:stackoverflow.com OR site:quora.com',
              'reviews': 'site:yelp.com OR site:google.com/maps OR site:trustpilot.com',
              'press': 'site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com'
            };
            
            if (contentTypeFilters[searchOptions.contentType]) {
              enhancedQuery = `${enhancedQuery} ${contentTypeFilters[searchOptions.contentType]}`;
            }
          }
          
          console.log(`Google Search Query: ${enhancedQuery}`);
        }
        
        // Store the final search query (use the first keyword's enhanced query)
        if (finalSearchQuery === '') {
          finalSearchQuery = enhancedQuery;
        }
        
        try {
          // Track results count before processing this keyword
          const resultsBeforeKeyword = allResults.length;
          
          // Get up to maxResults for THIS keyword (like previous_code - each keyword gets up to 100 results)
          let allSearchResults = await this.performMultipleSearches(enhancedQuery, region, maxResults, searchOptions);
          
          // CRITICAL: For child scans (when parentId exists), NEVER use fallback searches
          // This ensures child scans use EXACT same query as parent, even if no results
          // Fallback logic only applies to parent scans to ensure we get some results
          if (allSearchResults.length === 0 && !isChildScan) {
            // Only use fallback for parent scans (when parentId is not set)
            console.log(`⚠️ No results for "${enhancedQuery}", trying general search...`);
            const generalQuery = keyword.split(' ')[0]; // Use first word only
            allSearchResults = await this.performMultipleSearches(generalQuery, region, maxResults, searchOptions);
            
            // If still no results, try with a very basic search
            if (allSearchResults.length === 0) {
              console.log(`⚠️ Still no results, trying basic search...`);
              allSearchResults = await this.performMultipleSearches('news', region, maxResults, searchOptions);
            }
          } else if (allSearchResults.length === 0 && isChildScan) {
            // Child scan with no results - log but don't use fallback
            console.log(`⚠️ CHILD SCAN: No results for "${enhancedQuery}" (using exact parent query, no fallback)`);
          }
          
          // Process results and filter duplicates (like previous_code)
          for (const result of allSearchResults) {
            const cleanUrl = this.cleanAndValidateUrl(result.link);
            const url = cleanUrl;
            
            // Only add if it's a new URL (unique URL tracking)
            if (!uniqueUrls.has(url)) {
              uniqueUrls.add(url);
              
              allResults.push({
                keyword: keyword,
                keywordId: keywordObj._id || keywordObj.id || null,
                title: result.title,
                link: cleanUrl,
                url: cleanUrl,
                snippet: result.snippet,
                position: allResults.length + 1, // Global position across all keywords
                page: Math.ceil((allResults.length + 1) / 10),
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
              });
            }
          }
          
          const newResultsAdded = allResults.length - resultsBeforeKeyword;
          console.log(`✅ Keyword "${keyword}": Found ${allSearchResults.length} results, ${newResultsAdded} new unique URLs added`);
        } catch (error) {
          console.error(`❌ Error searching for keyword "${keyword}":`, error.message);
          // Continue with other keywords
        }
      }

      // Return all unique results (up to maxResults total)
      const finalResults = allResults.slice(0, maxResults);
      console.log(`Google Search Response: ${finalResults.length} unique results (from ${keywords.length} keyword(s))`);
      
      // Return exact query and dateRestrict used (for child scan inheritance)
      let exactGoogleQuery = finalSearchQuery;
      let exactDateRestrict = undefined;
      
      // If child scan used parent's exact query, return it
      if (isChildScan && searchOptions.parentExactQuery) {
        exactGoogleQuery = searchOptions.parentExactQuery;
      }
      
      // Capture the dateRestrict that was actually used in performSearch
      // We need to get it from the last search performed
      if (isChildScan && searchOptions.parentDateRestrict) {
        // Child scan uses parent's exact dateRestrict
        exactDateRestrict = searchOptions.parentDateRestrict;
      } else {
        // For parent scans, capture from performSearch
        // This is set in performSearch based on timeFrame
        // If timeFrame is 'all_time', exactDateRestrict will be undefined (which is correct)
        // We need to get it from the performMultipleSearches call
        // Check if it was captured in searchOptions
        if (searchOptions._capturedDateRestrict !== undefined) {
          exactDateRestrict = searchOptions._capturedDateRestrict;
        }
      }
      
      return { 
        results: finalResults, 
        searchQuery: finalSearchQuery,
        exactGoogleQuery: exactGoogleQuery,
        exactDateRestrict: exactDateRestrict
      };
    } catch (error) {
      console.error('❌ Google Search Error:', error);
      // Re-throw the error instead of returning empty results
      if (error.code === 'API_NOT_CONFIGURED') {
        throw error; // Re-throw configuration errors
      }
      // For other errors, wrap and re-throw
      const searchError = new Error(`Google Search failed: ${error.message}`);
      searchError.code = error.code || 'SEARCH_FAILED';
      throw searchError;
    }
  }

  async performMultipleSearches(query, region, totalResults, searchOptions = {}) {
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
        
        const pageResults = await this.performSearch(query, region, maxResultsPerPage, startIndex, searchOptions);
        
        // Capture dateRestrict from first page (all pages use same dateRestrict)
        if (page === 1 && searchOptions._actualDateRestrict !== undefined) {
          // Store it in searchOptions for return
          searchOptions._capturedDateRestrict = searchOptions._actualDateRestrict;
        }
        
        if (pageResults.length === 0) {
          break;
        }
        
        allResults.push(...pageResults);
        
        if (pageResults.length < maxResultsPerPage || allResults.length >= totalResults) {
          break;
        }
        
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        break;
      }
    }
    
    // Return only the requested number of results
    return allResults.slice(0, totalResults);
  }

  async performSearch(query, region, numResults, startIndex = 1, searchOptions = {}) {
    const params = {
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: Math.min(numResults, 10), // Google API max is 10 per request
      start: startIndex
    };

    // Map region codes to Google country codes (gl parameter)
    // gl = geolocation: Country code to bias search results (2-letter ISO country code)
    const regionToCountryCode = {
      'US': 'us',
      'UK': 'uk',
      'UAE': 'ae',
      'CA': 'ca',
      'AU': 'au',
      'DE': 'de',
      'FR': 'fr',
      'IT': 'it',
      'ES': 'es',
      'NL': 'nl',
      'PK': 'pk',  // Pakistan
      'IN': 'in',  // India
      'CN': 'cn',  // China
      'JP': 'jp',  // Japan
      'BR': 'br',  // Brazil
      'MX': 'mx',  // Mexico
    };

    // Add geolocation parameter based on region
    // gl = geolocation: Country code to bias search results (2-letter ISO country code, lowercase)
    // cr = countryRestrict: Restrict results to documents originating in a particular country (format: countryXX where XX is uppercase)
    if (region && regionToCountryCode[region.toUpperCase()]) {
      const countryCode = regionToCountryCode[region.toUpperCase()];
      params.gl = countryCode.toLowerCase(); // gl must be lowercase
      params.cr = `country${countryCode.toUpperCase()}`; // cr format: countryUS, countryUK, etc.
    } else if (region) {
      params.gl = region.toLowerCase();
    }

    // Add time frame parameter if specified
    // CRITICAL: For child scans, use parent's exact dateRestrict value (if stored)
    // Otherwise, dateRestrict is relative to execution time, causing different results
    // For child scans, we MUST use parentDateRestrict to ensure exact same time window
    const isChildScanInPerform = searchOptions.parentId !== undefined && searchOptions.parentId !== null;
    
    if (isChildScanInPerform && searchOptions.parentDateRestrict) {
      // Use parent's exact dateRestrict value for child scan (this is the EXACT timeFrame from parent)
      params.dateRestrict = searchOptions.parentDateRestrict;
      console.log(`🔄 CHILD SCAN (performSearch) - Using parent's exact dateRestrict: ${params.dateRestrict}`);
      console.log(`   - Parent timeFrame was: ${searchOptions.timeFrame || 'N/A'}`);
      console.log(`   - Using exact dateRestrict: ${params.dateRestrict} (from parent scan)`);
    } else if (searchOptions.timeFrame && searchOptions.timeFrame !== 'all_time') {
      // For parent scans, convert timeFrame to dateRestrict
      const timeFrameMap = {
        'past_week': 'w1',
        'past_month': 'm1',
        'past_3_months': 'm3',
        'past_year': 'y1'
      };
      
      if (timeFrameMap[searchOptions.timeFrame]) {
        params.dateRestrict = timeFrameMap[searchOptions.timeFrame];
        console.log(`📅 PARENT SCAN - Converting timeFrame "${searchOptions.timeFrame}" to dateRestrict: ${params.dateRestrict}`);
        console.log(`   └─ User selected: "${searchOptions.timeFrame}" → Google API gets: "${params.dateRestrict}"`);
      }
    } else if (searchOptions.timeFrame === 'all_time' || !searchOptions.timeFrame) {
      // "All" or no timeFrame means NO dateRestrict (search all time)
      console.log(`📅 PARENT SCAN - timeFrame is "all_time" or not set - NO dateRestrict parameter`);
      console.log(`   └─ User selected: "All" → Google API gets: NO dateRestrict (searches all time)`);
      params.dateRestrict = undefined; // Explicitly no dateRestrict
    }

    // Store the dateRestrict that was actually used (for return value)
    const actualDateRestrict = params.dateRestrict || undefined;
    
    console.log('Google Search Parameters:', {
      q: params.q,
      gl: params.gl || 'none',
      cr: params.cr || 'none',
      dateRestrict: actualDateRestrict || 'NONE (searching all time)',
      num: params.num,
      start: params.start || 1,
      key: params.key ? params.key.substring(0, 10) + '...' : 'none',
      cx: params.cx ? params.cx.substring(0, 10) + '...' : 'none'
    });
    
    // Return the actual dateRestrict used (for parent scan storage)
    // This will be used to set exactDateRestrict in the response
    if (actualDateRestrict) {
      // Store it in searchOptions so it can be returned
      searchOptions._actualDateRestrict = actualDateRestrict;
    } else {
      // No dateRestrict means "all time" - store as undefined
      searchOptions._actualDateRestrict = undefined;
    }
    
    try {
      const response = await axios.get(this.baseUrl, { 
        params,
        timeout: 10000 // 10 second timeout
      });
      
      // Verify this is a real API response (not mock)
      const isRealResponse = response.data && response.data.searchInformation && response.data.kind === 'customsearch#search';
      
      console.log('Google Search Response:', {
        kind: response.data.kind || 'unknown',
        totalResults: response.data.searchInformation?.totalResults || '0',
        itemsCount: response.data.items?.length || 0,
        isRealAPIResponse: isRealResponse,
        searchTime: response.data.searchInformation?.searchTime || 'N/A'
      });
      
      if (!isRealResponse) {
        console.error('⚠️ WARNING: Response does not appear to be from Google Custom Search API');
        console.error('Response structure:', Object.keys(response.data || {}));
      }
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`✅ Found ${response.data.items.length} results for "${query}" (from Google API)`);
        console.log(`📋 First few results:`, response.data.items.slice(0, 3).map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet?.substring(0, 100) + '...'
        })));
        return response.data.items;
      } else {
        console.log(`⚠️ No results found for "${query}"`);
        console.log(`🔍 Search info:`, response.data.searchInformation);
        return [];
      }
    } catch (error) {
      if (error.response) {
        // API error response
        console.error(`❌ Google API Error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
        
        if (error.response.status === 429) {
          console.error('⏰ Rate limit exceeded (429)');
          console.error('   - Quota exceeded for this API key');
          console.error('   - Error details:', error.response.data?.error || {});
          // Don't retry immediately - quota is exhausted
          throw new Error('Google Search API quota exceeded. Please wait or upgrade quota.');
        } else if (error.response.status === 400) {
          console.error('❌ Bad Request (400) - Check parameters');
          console.error('   - Error details:', error.response.data?.error || {});
          throw new Error(`Google Search API bad request: ${error.response.data?.error?.message || 'Invalid parameters'}`);
        } else if (error.response.status === 401 || error.response.status === 403) {
          console.error('❌ Authentication Error - Invalid API key');
          console.error('   - Error details:', error.response.data?.error || {});
          throw new Error('Google Search API authentication failed. Please check your API key.');
        } else {
          console.error(`❌ API Error (${error.response.status})`);
          console.error('   - Error details:', error.response.data?.error || {});
          throw new Error(`Google Search API error: ${error.response.data?.error?.message || error.response.statusText}`);
        }
      } else if (error.request) {
        console.error('❌ Network Error: No response received from Google API');
        console.error('   - This means the request was sent but no response received');
        console.error('   - Possible causes: timeout, network issue, or API endpoint unreachable');
        throw new Error(`Google Search API network error: ${error.message}`);
      } else {
        console.error('❌ Request Error:', error.message);
        throw error;
      }
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