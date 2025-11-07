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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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



