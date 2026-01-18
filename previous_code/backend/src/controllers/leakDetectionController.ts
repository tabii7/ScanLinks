import { Request, Response, RequestHandler } from 'express';
import LeakScraper from '../services/LeakScraper';
import KeywordLearner from '../services/KeywordLearner';
import KnowledgeManager from '../services/KnowledgeManager';

// Initialize services
const keywordLearner = new KeywordLearner(process.env.OPENAI_API_KEY || '');
const knowledgeManager = new KnowledgeManager();

/**
 * Get suggested keywords for a creator
 */
export const getSuggestedKeywords: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { creator } = req.query;
    
    if (!creator || typeof creator !== 'string') {
      res.status(400).json({ error: 'Creator name is required' });
      return;
    }

    const suggestedKeywords = await keywordLearner.getSuggestedKeywords(creator);
    
    res.status(200).json({ 
      success: true,
      creator,
      keywords: suggestedKeywords
    });
  } catch (error: any) {
    console.error('Error getting suggested keywords:', error);
    res.status(500).json({ 
      error: 'Failed to get suggested keywords',
      message: error.message
    });
  }
};

/**
 * Start a scan with provided parameters
 */
export const startScan: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { 
      creator, 
      keywords, 
      timeframe, 
      maxSearches,
      useSuggestedKeywords 
    } = req.body;
    
    if (!creator) {
      res.status(400).json({ error: 'Creator name is required' });
      return;
    }

    // Validate keywords
    let searchKeywords: string[] = [];
    
    if (useSuggestedKeywords) {
      // Use suggested keywords
      searchKeywords = await keywordLearner.getSuggestedKeywords(creator);
    } else if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // Use provided keywords
      searchKeywords = keywords.slice(0, 10); // Limit to 10 keywords
    } else {
      res.status(400).json({ 
        error: 'Keywords are required or useSuggestedKeywords must be true' 
      });
      return;
    }

    // Validate timeframe
    if (!timeframe) {
      res.status(400).json({ error: 'Timeframe is required' });
      return;
    }

    // Create and run the scraper
    const scraper = new LeakScraper(
      creator,
      process.env.GOOGLE_API_KEY || '',
      process.env.SEARCH_ENGINE_ID || '',
      maxSearches || 50
    );

    // Add creator name to each keyword
    const fullKeywords = searchKeywords.map(kw => `${creator} ${kw}`);

    // Start the scan (non-blocking)
    res.status(202).json({ 
      success: true,
      message: 'Scan started',
      creator,
      keywords: searchKeywords,
      timeframe,
      maxSearches: maxSearches || 50
    });

    // Run the scan asynchronously
    const results = await scraper.runScan(fullKeywords, timeframe);

    if (results && results.length > 0) {
      // Save temporary results for learning
      const tempFile = await scraper.saveTempResults(results, creator);
      
      if (tempFile) {
        // Learn from results
        console.log('Learning from search results...');
        await keywordLearner.learnFromResults(tempFile, creator);

        // Update master content repository
        console.log('Updating master content repository...');
        const newCount = await knowledgeManager.updateMasterContent(tempFile, creator);
        console.log(`Added ${newCount} new records to master content`);
      }
    }
  } catch (error: any) {
    console.error('Error starting scan:', error);
    // Note: We've already sent a response, so we just log the error
  }
};

/**
 * Export data in selected format
 */
export const exportData: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { creator, format } = req.query;
    
    if (!creator || typeof creator !== 'string') {
      res.status(400).json({ error: 'Creator name is required' });
      return;
    }

    if (!format || typeof format !== 'string' || !['csv', 'excel', 'json'].includes(format)) {
      res.status(400).json({ error: 'Valid format (csv, excel, json) is required' });
      return;
    }

    const exportPath = await knowledgeManager.exportMasterData(creator, format);
    
    if (!exportPath) {
      res.status(404).json({ error: 'No data found for export' });
      return;
    }

    // Send the file
    res.download(exportPath, `${creator.replace(' ', '_')}_master.${format}`);
  } catch (error: any) {
    console.error('Error exporting data:', error);
    res.status(500).json({ 
      error: 'Failed to export data',
      message: error.message
    });
  }
};

/**
 * Get statistics about collected content
 */
export const getContentStats: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { creator } = req.query;
    
    if (!creator || typeof creator !== 'string') {
      res.status(400).json({ error: 'Creator name is required' });
      return;
    }

    const stats = await knowledgeManager.getContentStats(creator);
    
    res.status(200).json({ 
      success: true,
      creator,
      stats
    });
  } catch (error: any) {
    console.error('Error getting content stats:', error);
    res.status(500).json({ 
      error: 'Failed to get content stats',
      message: error.message
    });
  }
};
