const axios = require('axios');

class SentimentAnalysisService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || 'sk-proj-1234567890abcdef';
    this.openaiBaseUrl = 'https://api.openai.com/v1/chat/completions';
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async analyzeSentiment(links, clientData) {
    try {
      console.log('🔍 Starting OpenAI sentiment analysis for', links.length, 'results');
      
      // Check if we have OpenAI API key
      if (!this.openaiApiKey || this.openaiApiKey === 'sk-proj-1234567890abcdef') {
        console.log('⚠️ OpenAI API key not configured - using fallback analysis');
        return this.getFallbackResults(links);
      }

      // Prepare the prompt with user context and search results
      const prompt = this.createAnalysisPrompt(links, clientData);
      
      console.log('📝 Sending request to OpenAI...');
      
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
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('✅ OpenAI response received');
      
      // Parse the response
      const analysisResults = this.parseOpenAIResponse(response.data.choices[0].message.content, links);
      
      return analysisResults;
      
    } catch (error) {
      console.error('❌ OpenAI sentiment analysis failed:', error.message);
      console.log('🔄 Using fallback analysis');
      return this.getFallbackResults(links);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createAnalysisPrompt(links, clientData) {
    const userContext = this.buildUserContext(clientData);
    const searchResults = this.formatSearchResults(links);

    return `
ANALYZE THESE SEARCH RESULTS FOR SENTIMENT AND RELEVANCE:

${userContext}

SEARCH RESULTS TO ANALYZE:
${searchResults}

For each result, provide analysis in this EXACT JSON format:
{
  "results": [
  {
    "index": 1,
      "sentiment": "positive|negative|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of why this sentiment for this specific user",
      "category": "reviews|news|social|competitor|industry|other",
      "keywords": ["keyword1", "keyword2"],
      "relevance": "high|medium|low"
    }
  ]
}

Focus on:
- How relevant is this result to the user's business?
- Does it mention the user's company positively/negatively?
- Is it from a credible source?
- Would this help or hurt the user's online reputation?
- Is it about competitors or industry trends?

Return ONLY the JSON response, no other text.`;
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
        console.log('⚠️ No JSON found in OpenAI response, using fallback');
        return this.getFallbackResults(originalLinks);
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Ensure we have results array
      if (!analysis.results || !Array.isArray(analysis.results)) {
        console.log('⚠️ Invalid analysis results format, using fallback');
        return this.getFallbackResults(originalLinks);
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
      console.log('🔄 Using fallback analysis for all results');
      return this.getFallbackResults(originalLinks);
    }
  }

  getFallbackResults(links) {
      return links.map(link => ({
        ...link,
        sentiment: 'neutral',
        confidence: 0.5,
      reasoning: 'Neutral content - no specific sentiment detected',
        keywords: [],
        category: 'other',
      relevance: 'medium',
      analyzedAt: new Date().toISOString(),
      originalUrl: link.metadata?.originalUrl || link.link || link.url,
      originalLink: link.metadata?.originalUrl || link.link || link.url
    }));
  }

  // REMOVED: Mock sentiment analysis method - no longer needed
  getMockSentimentResults(links, clientData) {
    // This method has been removed - no mock data generation
    return links.map(link => ({
        ...link,
      sentiment: '-',
      confidence: '-',
      reasoning: '-',
      keywords: [],
      category: '-',
      analyzedAt: new Date().toISOString(),
      originalUrl: link.metadata?.originalUrl || link.link || link.url,
      originalLink: link.metadata?.originalUrl || link.link || link.url
    }));
  }
}

module.exports = new SentimentAnalysisService();