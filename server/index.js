const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
// Load .env from multiple possible locations
// Priority: server/.env (if exists) > root .env
const serverEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '../.env');

if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
}
require('dotenv').config({ path: rootEnvPath });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/keywords', require('./routes/keywords'));
app.use('/api/regions', require('./routes/regions'));
app.use('/api/scans', require('./routes/scans'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/orm-scan', require('./routes/orm-scan'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/admin-tools', require('./routes/admin-tools'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test OpenAI API Key endpoint
app.get('/api/test/openai-key', async (req, res) => {
  try {
    const axios = require('axios');
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    // Check if key exists
    if (!openaiApiKey || openaiApiKey.trim() === '' || openaiApiKey === 'your-openai-api-key-here') {
      return res.json({
        status: 'error',
        configured: false,
        message: 'OpenAI API key is not configured',
        details: 'Please set OPENAI_API_KEY in your .env file',
        keyLength: 0
      });
    }
    
    const keyPreview = openaiApiKey.length > 8 
      ? `${openaiApiKey.substring(0, 4)}...${openaiApiKey.substring(openaiApiKey.length - 4)}`
      : '***';
    
    // Test the API key with a simple request
    try {
      const testResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Say "test" and nothing else.' }],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      return res.json({
        status: 'success',
        configured: true,
        message: 'OpenAI API key is valid and working',
        keyPreview: keyPreview,
        keyLength: openaiApiKey.length,
        testResponse: testResponse.data.choices[0]?.message?.content || 'No response',
        model: 'gpt-3.5-turbo'
      });
      
    } catch (apiError) {
      let errorMessage = 'Unknown error';
      let errorCode = 'UNKNOWN';
      
      if (apiError.response) {
        errorCode = apiError.response.status;
        if (apiError.response.status === 401) {
          errorMessage = 'Invalid API key - Authentication failed';
        } else if (apiError.response.status === 429) {
          errorMessage = 'Rate limit exceeded (but key might be valid)';
        } else if (apiError.response.status === 403) {
          errorMessage = 'Access forbidden - Check API key permissions';
        } else {
          errorMessage = apiError.response.data?.error?.message || `HTTP ${apiError.response.status}`;
        }
      } else if (apiError.request) {
        errorMessage = 'No response from OpenAI API - Network error';
        errorCode = 'NETWORK_ERROR';
      } else {
        errorMessage = apiError.message;
      }
      
      return res.json({
        status: 'error',
        configured: true,
        message: 'OpenAI API key test failed',
        keyPreview: keyPreview,
        keyLength: openaiApiKey.length,
        error: errorMessage,
        errorCode: errorCode,
        details: apiError.response?.data || null
      });
    }
    
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to test OpenAI API key',
      error: error.message
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 AceTrack™ Server running on port ${PORT}`);
  console.log(`📊 ORM Tracking System Active`);

  // Initialize Agenda scheduler
  try {
    const scheduler = require('./services/scheduler/schedulerService');
    await scheduler.start();
    console.log('⏱️ Agenda scheduler initialized');
  } catch (e) {
    console.log('⚠️ Scheduler init failed:', e?.message);
  }
});



