import express from 'express';
import { 
  getSuggestedKeywords, 
  startScan, 
  exportData, 
  getContentStats 
} from '../controllers/leakDetectionController';

const router = express.Router();

// Get suggested keywords for a creator
router.get('/suggest-keywords', getSuggestedKeywords);

// Start a scan with provided parameters
router.post('/start-scan', startScan);

// Export data in selected format
router.get('/export-data', exportData);

// Get statistics about collected content
router.get('/stats', getContentStats);

export default router;
