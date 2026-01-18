const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure required directories exist
const dataDirectories = [
  path.join(__dirname, '..', '..', 'data', 'temp_results'),
  path.join(__dirname, '..', '..', 'data', 'master_data'),
  path.join(__dirname, '..', '..', 'data', 'knowledge_base'),
  path.join(__dirname, '..', '..', 'data', 'leak_detection_results')
];

dataDirectories.forEach(dir => {
  fs.ensureDirSync(dir);
  console.log(`Ensured directory exists: ${dir}`);
});

// Simple test routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/suggest-keywords', (req, res) => {
  const { creator } = req.query;
  
  // Mock data for testing
  const keywords = [
    'onlyfans leaks',
    'leaked content',
    'private photos',
    'nude leaks',
    'xxx content',
    'patreon content',
    'leaked photos',
    'private content',
    'exclusive content',
    'premium content'
  ];
  
  res.status(200).json({ 
    success: true,
    creator: creator || 'Unknown',
    keywords
  });
});

app.post('/api/start-scan', (req, res) => {
  const { 
    creator, 
    keywords, 
    timeframe, 
    maxSearches,
    useSuggestedKeywords 
  } = req.body;
  
  console.log('Scan requested:', { creator, keywords, timeframe, maxSearches, useSuggestedKeywords });
  
  res.status(202).json({ 
    success: true,
    message: 'Scan started',
    creator: creator || 'Unknown',
    keywords: keywords || [],
    timeframe: timeframe || 'last 7 days',
    maxSearches: maxSearches || 50
  });
});

app.get('/api/stats', (req, res) => {
  const { creator } = req.query;
  
  // Mock data for testing
  const stats = {
    total_urls: 127,
    domains: {
      'example1.com': 45,
      'example2.com': 32,
      'example3.com': 21,
      'example4.com': 15,
      'example5.com': 14
    },
    newest_content: '2025-05-20',
    oldest_content: '2025-01-15'
  };
  
  res.status(200).json({ 
    success: true,
    creator: creator || 'Unknown',
    stats
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
