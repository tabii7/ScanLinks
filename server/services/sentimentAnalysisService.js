const axios = require('axios');

class SentimentAnalysisService {
  constructor() {
    // Reload environment variables to ensure we have the latest key
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = 'https://api.openai.com/v1/chat/completions';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    // Log key status on initialization
    if (this.openaiApiKey && this.openaiApiKey.length > 10) {
      const keyPreview = `${this.openaiApiKey.substring(0, 4)}...${this.openaiApiKey.substring(this.openaiApiKey.length - 4)}`;
      console.log(`✅ SentimentAnalysisService initialized with OpenAI key: ${keyPreview}`);
    } else {
      console.error('❌ SentimentAnalysisService: OpenAI API key NOT FOUND or invalid');
    }
  }
  
  // Method to get current API key (reloads from env if needed)
  getApiKey() {
    // Always reload from environment to get latest key
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    return this.openaiApiKey;
  }

  async analyzeSentiment(links, clientData) {
    try {
      console.log('🔍 Starting OpenAI sentiment analysis for', links.length, 'results');
      
      // CRITICAL: Reload API key from environment to ensure we have the latest
      const apiKey = this.getApiKey();
      
      // Check if we have OpenAI API key - throw error if not configured
      if (!apiKey || apiKey === 'sk-proj-1234567890abcdef' || apiKey.trim() === '') {
        const error = new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
        error.code = 'API_NOT_CONFIGURED';
        console.error('❌ OpenAI API key not configured:', error.message);
        console.error('   Please check server/.env file has OPENAI_API_KEY set');
        throw error;
      }

      // Log API key status (masked for security)
      const keyPreview = apiKey.length > 8 
        ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
        : '***';
      console.log(`✅ Using OpenAI API Key: ${keyPreview}`);
      console.log(`📏 Key length: ${apiKey.length} characters`);

      // Prepare the prompt with user context and search results
      const prompt = this.createAnalysisPrompt(links, clientData);
      
      console.log('📝 Sending request to OpenAI API (GPT-4)...');
      console.log(`📊 Analyzing ${links.length} search result(s)`);
      
      const response = await axios.post(this.openaiBaseUrl, {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert ORM (Online Reputation Management) analyst. Analyze search results for sentiment and relevance to specific users.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      });

      
      // Parse the response
      const analysisResults = this.parseOpenAIResponse(response.data.choices[0].message.content, links);
      
      console.log(`✅ OpenAI analysis completed successfully`);
      console.log(`📊 Received ${analysisResults.length} analyzed result(s) from OpenAI`);
      console.log(`🎯 Sentiments: ${analysisResults.map(r => r.sentiment).join(', ')}`);
      
      return analysisResults;
      
    } catch (error) {
      console.error('❌ OpenAI sentiment analysis failed:', error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Error: ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 401) {
          console.error('   ❌ Authentication failed - Invalid API key');
        } else if (error.response.status === 429) {
          console.error('   ⚠️ Rate limit exceeded');
        }
      }
      
      // Re-throw the error instead of using fallback
      if (error.code === 'API_NOT_CONFIGURED') {
        throw error; // Re-throw configuration errors
      }
      // For other errors, still throw but with more context
      const analysisError = new Error(`OpenAI sentiment analysis failed: ${error.message}`);
      analysisError.code = error.code || 'ANALYSIS_FAILED';
      throw analysisError;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createAnalysisPrompt(links, clientData) {
    const userContext = this.buildUserContext(clientData);
    const searchResults = this.formatSearchResults(links);

    return `Analyze these search results for sentiment:

${userContext}

SEARCH RESULTS:
${searchResults}

For each result, determine sentiment (positive/negative/neutral), confidence (0.0-1.0), and relevance (high/medium/low).

Return JSON format:
{
  "results": [
    {
      "index": 1,
      "sentiment": "positive|negative|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation",
      "category": "reviews|news|social|other",
      "keywords": ["keyword1"],
      "relevance": "high|medium|low"
    }
  ]
}

Return ONLY the JSON response.`;
  }

  buildUserContext(clientData) {
    return `
USER DETAILS:
- Company Name: ${clientData?.name || 'Unknown Company'}
- Industry: ${clientData?.industry || 'Unknown Industry'}
- Business Type: ${clientData?.businessType || 'Unknown Business Type'}
- Target Audience: ${clientData?.targetAudience || 'General Audience'}
- Region: ${clientData?.region || 'US'}
- Website: ${clientData?.website || 'Not specified'}
- Description: ${clientData?.description || 'No description available'}
`;
  }

  formatSearchResults(links) {
    return links.map((link, index) => `
${index + 1}. ${link.title}
   URL: ${link.link}
   Domain: ${link.domain}
   Snippet: ${link.snippet}
`).join('\n');
  }

  parseOpenAIResponse(responseText, originalLinks) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in OpenAI response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Ensure we have results array
      if (!analysis.results || !Array.isArray(analysis.results)) {
        throw new Error('Invalid analysis results format from OpenAI');
      }
      
      // Map analysis back to original links
      return originalLinks.map((link, index) => {
        const analysisResult = analysis.results.find(r => r.index === index + 1) || analysis.results[index];
        
        // Validate sentiment
        const validSentiments = ['positive', 'negative', 'neutral'];
        const sentiment = validSentiments.includes(analysisResult?.sentiment) ? analysisResult.sentiment : 'neutral';
        
        return {
          ...link,
          sentiment: sentiment,
          confidence: Math.max(0, Math.min(1, analysisResult?.confidence || 0.5)),
          reasoning: analysisResult?.reasoning || 'Neutral content - no specific sentiment detected',
          keywords: Array.isArray(analysisResult?.keywords) ? analysisResult.keywords : [],
          category: analysisResult?.category || 'other',
          relevance: analysisResult?.relevance || 'medium',
          analyzedAt: new Date().toISOString(),
          originalUrl: link.metadata?.originalUrl || link.link || link.url,
          originalLink: link.metadata?.originalUrl || link.link || link.url
        };
      });
      
    } catch (error) {
      console.error('❌ Error parsing OpenAI response:', error);
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
  }

  // Generate report summary from sentiment analysis results
  async generateReportSummary(sentimentResults, clientData) {
    try {
      const totalResults = sentimentResults.length;
      const positiveResults = sentimentResults.filter(r => r.sentiment === 'positive').length;
      const negativeResults = sentimentResults.filter(r => r.sentiment === 'negative').length;
      const neutralResults = sentimentResults.filter(r => r.sentiment === 'neutral').length;
      
      const summary = {
        totalResults,
        positiveCount: positiveResults,
        negativeCount: negativeResults,
        neutralCount: neutralResults,
        positivePercentage: totalResults > 0 ? Math.round((positiveResults / totalResults) * 100) : 0,
        negativePercentage: totalResults > 0 ? Math.round((negativeResults / totalResults) * 100) : 0,
        neutralPercentage: totalResults > 0 ? Math.round((neutralResults / totalResults) * 100) : 0,
        overallSentiment: this.calculateOverallSentiment(positiveResults, negativeResults, neutralResults),
        keyFindings: this.extractKeyFindings(sentimentResults),
        recommendations: this.generateRecommendations(positiveResults, negativeResults, totalResults),
        generatedAt: new Date().toISOString()
      };
      
      return summary;
    } catch (error) {
      console.error('Error generating report summary:', error);
      return {
        totalResults: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        positivePercentage: 0,
        negativePercentage: 0,
        neutralPercentage: 0,
        overallSentiment: 'neutral',
        keyFindings: [],
        recommendations: ['Unable to generate recommendations due to analysis error'],
        generatedAt: new Date().toISOString()
      };
    }
  }

  calculateOverallSentiment(positive, negative, neutral) {
    if (positive > negative && positive > neutral) return 'positive';
    if (negative > positive && negative > neutral) return 'negative';
    return 'neutral';
  }

  extractKeyFindings(sentimentResults) {
    const findings = [];
    
    // Get top negative results
    const negativeResults = sentimentResults
      .filter(r => r.sentiment === 'negative')
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 3);
    
    negativeResults.forEach(result => {
      findings.push({
        type: 'negative',
        title: result.title || 'Negative mention found',
        url: result.link || result.url,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || 'Negative sentiment detected'
      });
    });
    
    return findings;
  }

  generateRecommendations(positive, negative, total) {
    const recommendations = [];
    
    if (negative > 0) {
      recommendations.push('Address negative mentions promptly');
      recommendations.push('Monitor reputation more frequently');
    }
    
    if (positive > 0) {
      recommendations.push('Leverage positive mentions for marketing');
    }
    
    if (total === 0) {
      recommendations.push('No mentions found - consider expanding search terms');
    }
    
    return recommendations;
  }

}

module.exports = new SentimentAnalysisService();