import fs from 'fs-extra';
import path from 'path';
import { OpenAI } from 'openai';
import natural from 'natural';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

interface KeywordData {
  occurrence: number;
  first_seen: string;
  last_seen: string;
}

interface KeywordDatabase {
  [keyword: string]: KeywordData;
}

class KeywordLearner {
  private openaiClient: OpenAI;
  private keywordDbPath: string;
  private tokenizer: natural.WordTokenizer;

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAI({
      apiKey: openaiApiKey
    });
    
    this.keywordDbPath = path.join(process.cwd(), '..', 'data', 'knowledge_base');
    fs.ensureDirSync(this.keywordDbPath);
    
    // Initialize natural language tokenizer
    this.tokenizer = new natural.WordTokenizer();
  }

  public async learnFromResults(tempCsvPath: string, creatorName: string): Promise<string[]> {
    if (!fs.existsSync(tempCsvPath)) {
      console.log('❌ Temp CSV file not found');
      return [];
    }

    console.log(`📊 Analyzing results from ${tempCsvPath}`);

    // Load the CSV data
    const records = await this.readCsvFile(tempCsvPath);
    
    // Extract text for analysis
    const textCorpus: string[] = [];
    records.forEach(record => {
      if (record.title) textCorpus.push(record.title);
      if (record.snippet) textCorpus.push(record.snippet);
    });

    const fullText = textCorpus.filter(t => typeof t === 'string').join(' ');
    console.log(`📝 Extracted ${textCorpus.length} text elements for analysis`);

    // Extract potential keywords with natural language processing
    const extractedKeywords = this.extractKeywords(fullText);
    console.log(`🔍 Extracted ${extractedKeywords.length} candidate keywords`);

    // Generate optimized keywords with AI
    const aiKeywords = await this.generateAiKeywords(records, extractedKeywords, creatorName);
    console.log(`🧠 Generated ${aiKeywords.length} AI-optimized keywords`);

    // Update keywords database
    const updatedKeywords = await this.updateKeywordDatabase(aiKeywords, creatorName);

    return updatedKeywords;
  }

  private extractKeywords(text: string): string[] {
    // Tokenize text
    const tokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    
    // Filter non-alphabetic words and short words
    const filteredWords = tokens.filter(word => 
      /^[a-z]+$/.test(word) && word.length > 3
    );
    
    // Count word frequencies
    const wordCounts: Record<string, number> = {};
    filteredWords.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Get words appearing multiple times
    const extractedKeywords = Object.entries(wordCounts)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word]) => word);
    
    return extractedKeywords;
  }

  private async generateAiKeywords(
    records: any[], 
    extractedKeywords: string[], 
    creatorName: string
  ): Promise<string[]> {
    // Prepare data for OpenAI
    const csvText = records.slice(0, 30).map(record => 
      `${record.title || ''} | ${record.url || ''} | ${record.snippet || ''}`
    ).join('\n');

    // Load existing keywords from database if available
    const existingKeywords = await this.getExistingKeywords(creatorName);
    const existingKeywordsText = existingKeywords.length 
      ? existingKeywords.slice(0, 15).join(', ')
      : 'No previous keywords available';

    const prompt = `
    **Role: You are a Search Intelligence Analyst specializing in finding leaked content.**

    We need to generate optimal search keywords for finding leaked content of creator "${creatorName}".

    **PREVIOUSLY SUCCESSFUL KEYWORDS:**
    ${existingKeywordsText}

    **EXTRACTED FREQUENT WORDS:**
    ${extractedKeywords.slice(0, 30).join(', ')}

    **SAMPLE CONTENT:**
    ${csvText.substring(0, 2000)}

    **YOUR TASK:**
    - Analyze the content to identify keywords that would find more leaked content
    - Generate ONLY 8-10 search keywords with highest probability of finding leaked content
    - Each keyword should focus on finding unauthorized/leaked content
    - Focus on NSFW/adult terms that appear to be associated with leaked content
    - Include terms for file types, platforms, or specific content types
    - Do NOT include the creator's name in the keywords (it will be added separately)

    **FINAL OUTPUT:**
    Return only a properly formatted JavaScript array of 8-10 keywords, no explanations.
    Example: ["leaked onlyfans", "nude photos", "explicit content", "private video"]
    `;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400
      });

      const generatedText = response.choices[0].message.content?.trim() || '';
      console.log('📋 AI response received');

      // Process the response to extract keywords
      try {
        // Clean up the list format
        const cleanText = generatedText.replace(/\\n/g, ' ');

        // Find the list part
        const startIdx = cleanText.indexOf('[');
        const endIdx = cleanText.lastIndexOf(']');

        if (startIdx !== -1 && endIdx !== -1) {
          const listText = cleanText.substring(startIdx, endIdx + 1);
          // Parse the JSON array
          const keywords = JSON.parse(listText);
          return keywords;
        } else {
          // Fallback if list format not found
          return this.extractFallbackKeywords(generatedText);
        }
      } catch (e) {
        console.log(`❌ Error parsing AI keywords: ${e}`);
        console.log('🔄 Using fallback keyword extraction');
        return this.extractFallbackKeywords(generatedText);
      }
    } catch (e) {
      console.log(`❌ Error generating AI keywords: ${e}`);
      return [];
    }
  }

  private extractFallbackKeywords(text: string): string[] {
    // Simple extraction based on line breaks and quotes
    const keywords: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && trimmedLine.length > 4 && !trimmedLine.startsWith('#')) {
        // Extract anything in quotes
        if (trimmedLine.includes('"')) {
          const parts = trimmedLine.split('"');
          for (let i = 1; i < parts.length; i += 2) {
            if (parts[i].trim()) {
              keywords.push(parts[i].trim());
            }
          }
        }
        // Or just take the whole line if it's short
        else if (
          trimmedLine.length < 30 && 
          !trimmedLine.startsWith('[') && 
          !trimmedLine.endsWith(']')
        ) {
          keywords.push(trimmedLine);
        }
      }
    }

    // Deduplicate and return max 10
    return [...new Set(keywords)].slice(0, 10);
  }

  private async getExistingKeywords(creatorName: string): Promise<string[]> {
    const dbFile = path.join(
      this.keywordDbPath, 
      `${creatorName.replace(/\s+/g, '_')}_keywords.json`
    );

    if (!fs.existsSync(dbFile)) {
      return [];
    }

    try {
      const data = await fs.readJson(dbFile);
      
      // Sort by familiarity index (occurrence count)
      const sortedKeywords = Object.entries(data as KeywordDatabase)
        .sort((a: [string, KeywordData], b: [string, KeywordData]) => b[1].occurrence - a[1].occurrence)
        .map(([keyword]) => keyword);
      
      return sortedKeywords;
    } catch (e) {
      console.log(`❌ Error loading existing keywords: ${e}`);
      return [];
    }
  }

  private async updateKeywordDatabase(
    aiKeywords: string[], 
    creatorName: string
  ): Promise<string[]> {
    const dbFile = path.join(
      this.keywordDbPath, 
      `${creatorName.replace(/\s+/g, '_')}_keywords.json`
    );

    // Load existing database or create new one
    let keywordData: KeywordDatabase = {};
    
    if (fs.existsSync(dbFile)) {
      try {
        keywordData = await fs.readJson(dbFile);
      } catch (e) {
        console.log(`❌ Error reading keyword database: ${e}`);
        keywordData = {};
      }
    }

    // Update occurrence counts for keywords
    const currentDate = new Date().toISOString().split('T')[0];

    for (const keyword of aiKeywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      
      if (keywordData[normalizedKeyword]) {
        // Update existing keyword
        keywordData[normalizedKeyword].occurrence += 1;
        keywordData[normalizedKeyword].last_seen = currentDate;
      } else {
        // Add new keyword
        keywordData[normalizedKeyword] = {
          occurrence: 1,
          first_seen: currentDate,
          last_seen: currentDate
        };
      }
    }

    // Save updated database
    await fs.writeJson(dbFile, keywordData, { spaces: 2 });
    console.log(`✅ Updated keyword database with ${aiKeywords.length} keywords`);

    // Return all keywords sorted by occurrence
    const sortedKeywords = Object.entries(keywordData)
      .sort((a, b) => b[1].occurrence - a[1].occurrence)
      .map(([keyword]) => keyword);
    
    return sortedKeywords;
  }

  public async getSuggestedKeywords(
    creatorName: string, 
    maxCount: number = 10
  ): Promise<string[]> {
    const keywords = await this.getExistingKeywords(creatorName);

    // Return top keywords from database
    if (keywords.length) {
      return keywords.slice(0, maxCount);
    } else {
      // Fallback to basic suggestions if no keywords in database
      return [
        'onlyfans leaks',
        'leaked content',
        'private photos',
        'nude leaks',
        'xxx content'
      ];
    }
  }

  private async readCsvFile(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      createReadStream(filePath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true
        }))
        .on('data', (data) => results.push(data))
        .on('error', (error) => reject(error))
        .on('end', () => resolve(results));
    });
  }
}

export default KeywordLearner;
