const OpenAI = require('openai');

class SentimentService {
  constructor() {
    // Only initialize OpenAI if API key is available and not a placeholder
    if (process.env.OPENAI_API_KEY && 
        process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && 
        process.env.OPENAI_API_KEY.length > 10) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.hasApiKey = true;
        console.log('✅ OpenAI API key configured');
      } catch (error) {
        console.log('⚠️ OpenAI API key invalid, using fallback analysis');
        this.hasApiKey = false;
      }
    } else {
      console.log('⚠️ OpenAI API key not configured, using fallback analysis');
      this.hasApiKey = false;
    }
  }

  async analyzeSentiment(title, description) {
    // Use fallback if API key is not available
    if (!this.hasApiKey) {
      return this.getFallbackSentimentResult(title, description);
    }

    try {
      const prompt = `
Analyze the sentiment of this content and classify it as one of the following:
- positive: Favorable, positive, or neutral content about the person/company
- negative: Harmful, defamatory, scandal-related, or negative content
- neutral: Unrelated or purely informational content
- unrelated: Content that is not about the person/company at all

Title: "${title}"
Description: "${description}"

Respond with only the classification (positive, negative, neutral, or unrelated) and a confidence score from 0-1.
Format: classification|score
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert sentiment analysis tool for online reputation management. Analyze content and classify sentiment accurately."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.1,
      });

      const result = response.choices[0].message.content.trim();
      const [classification, score] = result.split('|');
      
      return {
        sentiment: classification.toLowerCase(),
        confidence: parseFloat(score) || 0.5,
      };
    } catch (error) {
      console.error('OpenAI Sentiment Analysis Error:', error.message);
      // Fallback to neutral if API fails
      return {
        sentiment: 'neutral',
        confidence: 0.5,
      };
    }
  }

  async generateReportSummary(stats) {
    try {
      const prompt = `
Generate a professional summary for an ORM (Online Reputation Management) report based on these statistics:

Total Links: ${stats.totalLinks}
Positive Links: ${stats.positiveLinks}
Negative Links: ${stats.negativeLinks}
New Links: ${stats.newLinks}
Improved Links: ${stats.improvedLinks}
Dropped Links: ${stats.droppedLinks}
Suppressed Links: ${stats.suppressedLinks}

Write a 2-3 sentence professional summary highlighting the key improvements and changes. Focus on positive outcomes and reputation improvements.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional ORM analyst writing executive summaries for reputation management reports."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI Summary Generation Error:', error.message);
      return `This week's campaign shows ${stats.positiveLinks} positive results with ${stats.newLinks} new links and ${stats.suppressedLinks} suppressed negative content.`;
    }
  }

  async analyzeMultipleResults(results) {
    const analyzedResults = [];
    
    for (const result of results) {
      try {
        const sentiment = await this.analyzeSentiment(result.title, result.description);
        analyzedResults.push({
          ...result,
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.confidence,
        });
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error analyzing sentiment for "${result.title}":`, error.message);
        analyzedResults.push({
          ...result,
          sentiment: 'neutral',
          sentimentScore: 0.5,
        });
      }
    }
    
    return analyzedResults;
  }

  getFallbackSentimentResult(title, description) {
    // Fallback sentiment analysis based on content patterns
    const content = `${title} ${description}`.toLowerCase();
    
    let sentiment = 'neutral';
    let confidence = 0.7;
    let reasoning = 'Content appears neutral';
    
    // Check for positive indicators
    if (content.includes('excellent') || content.includes('great') || content.includes('amazing') || 
        content.includes('best') || content.includes('recommend') || content.includes('love')) {
      sentiment = 'positive';
      confidence = 0.8;
      reasoning = 'Content contains positive language indicators';
    }
    // Check for negative indicators
    else if (content.includes('terrible') || content.includes('awful') || content.includes('worst') || 
             content.includes('hate') || content.includes('scam') || content.includes('fraud') ||
             content.includes('complaint') || content.includes('problem')) {
      sentiment = 'negative';
      confidence = 0.8;
      reasoning = 'Content contains negative language indicators';
    }
    // Check for review sites (usually neutral to positive)
    else if (content.includes('review') || content.includes('rating') || content.includes('stars')) {
      sentiment = Math.random() > 0.3 ? 'positive' : 'neutral';
      confidence = 0.6;
      reasoning = 'Review site content detected';
    }
    // Check for news sites (usually neutral)
    else if (content.includes('news') || content.includes('article') || content.includes('report')) {
      sentiment = 'neutral';
      confidence = 0.7;
      reasoning = 'News content detected';
    }
    // Check for social media (varied sentiment)
    else if (content.includes('twitter') || content.includes('facebook') || content.includes('instagram')) {
      sentiment = Math.random() > 0.5 ? 'positive' : 'neutral';
      confidence = 0.5;
      reasoning = 'Social media content detected';
    }
    
    return {
      sentiment,
      confidence,
      reasoning
    };
  }
}

module.exports = new SentimentService();


