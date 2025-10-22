const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

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

// Weekly scan automation (runs every Monday at 9 AM)
cron.schedule('0 9 * * 1', async () => {
  console.log('Running weekly automated scan...');
  const { runWeeklyScan } = require('./services/scanService');
  try {
    await runWeeklyScan();
    console.log('Weekly scan completed successfully');
  } catch (error) {
    console.error('Weekly scan failed:', error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 AceTrack™ Server running on port ${PORT}`);
  console.log(`📊 ORM Tracking System Active`);
});



