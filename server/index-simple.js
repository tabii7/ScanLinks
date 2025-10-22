const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const schedulerService = require('./services/schedulerService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('🗄️ MongoDB connected successfully');
})
.catch((error) => {
  console.log('⚠️ MongoDB connection failed, using in-memory storage');
  console.log('💡 To use MongoDB, install it: brew install mongodb-community');
});

// Database Models
const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  company: { type: String, required: true },
  website: String,
  industry: String,
  targetAudience: String,
  keywords: [String],
  negativeKeywords: [String],
  reputationGoals: [String],
  currentChallenges: [String],
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ScanSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientName: { type: String, required: true },
  keywords: [String],
  region: { type: String, required: true },
  scanType: { type: String, enum: ['manual', 'scheduled', 'test'], default: 'manual' },
  weekNumber: { type: Number, required: true },
  resultsCount: { type: Number, default: 0 },
  status: { type: String, default: 'completed' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: Date.now }
});

const ScanResultSchema = new mongoose.Schema({
  scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
  keyword: String,
  title: String,
  link: { type: String, required: true },
  snippet: String,
  position: Number,
  page: Number,
  region: String,
  domain: String,
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral'], required: true },
  confidence: { type: Number, required: true },
  reasoning: String,
  keywords: [String],
  category: String,
  analyzedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);
const Scan = mongoose.models.Scan || mongoose.model('Scan', ScanSchema);
const ScanResult = mongoose.models.ScanResult || mongoose.model('ScanResult', ScanResultSchema);

// Fallback in-memory storage (if MongoDB not available)
let clients = [];
let scans = [];
let scanResults = [];

// Simple routes for demo
app.use('/api/auth', require('./routes/auth-simple'));
app.use('/api/reports', require('./routes/reports-simple'));
app.use('/api/orm-scan', require('./routes/orm-scan'));

// Mock data endpoints
app.get('/api/dashboard/admin', (req, res) => {
  res.json({
    overview: {
      totalClients: 5,
      activeClients: 4,
      totalKeywords: 25,
      activeKeywords: 22,
      totalScans: 48,
      totalReports: 45,
    },
    recentActivity: {
      scans: [
        { id: 1, clientId: { name: 'Demo Client 1' }, completedAt: new Date(), region: 'US' },
        { id: 2, clientId: { name: 'Demo Client 2' }, completedAt: new Date(), region: 'UK' },
      ],
      reports: [
        { id: 1, clientId: { name: 'Demo Client 1' }, generatedAt: new Date(), weekNumber: 1 },
        { id: 2, clientId: { name: 'Demo Client 2' }, generatedAt: new Date(), weekNumber: 2 },
      ]
    }
  });
});

app.get('/api/dashboard/client', (req, res) => {
  res.json({
    client: {
      name: 'Demo Client',
      logo: null,
      subscription: { plan: 'Ace+', duration: 6 },
      campaignProgress: { percentage: 50, monthsElapsed: 3, totalMonths: 6 }
    },
    overview: {
      totalKeywords: 8,
      activeKeywords: 7,
      totalScans: 12,
      totalReports: 10,
    },
    recentActivity: {
      scans: [
        { id: 1, completedAt: new Date(), region: 'US' },
        { id: 2, completedAt: new Date(), region: 'UK' },
      ],
      reports: [
        { id: 1, generatedAt: new Date(), weekNumber: 1, region: 'US' },
        { id: 2, generatedAt: new Date(), weekNumber: 2, region: 'UK' },
      ]
    },
    campaignStats: {
      linksRemoved: 3,
      deIndexed: 2,
      suppressed: 1,
      newPositiveLinks: 5,
      totalPositiveLinks: 12,
      totalNegativeLinks: 3,
    }
  });
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const clients = await Client.find().sort({ createdAt: -1 });
      res.json(clients);
    } else {
      // Fallback to in-memory
      res.json(clients);
    }
  } catch (error) {
    console.error('❌ Error fetching clients:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clients' });
  }
});

// Create new client
app.post('/api/clients', async (req, res) => {
  try {
    const clientData = req.body;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const newClient = new Client(clientData);
      await newClient.save();
      
      console.log('✅ New client created in MongoDB:', newClient.name);
      
      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        client: newClient
      });
    } else {
      // Fallback to in-memory
      const newClient = {
        _id: Date.now().toString(),
        ...clientData,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      clients.push(newClient);
      
      console.log('✅ New client created in memory:', newClient.name);
      console.log('📊 Total clients:', clients.length);
      
      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        client: newClient
      });
    }
  } catch (error) {
    console.error('❌ Error creating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
});

// Update client
app.put('/api/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const clientData = req.body;
    
    const clientIndex = clients.findIndex(client => client._id === id);
    if (clientIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    // Update client
    clients[clientIndex] = {
      ...clients[clientIndex],
      ...clientData,
      updatedAt: new Date()
    };
    
    console.log('✅ Client updated:', clients[clientIndex].name);
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      client: clients[clientIndex]
    });
  } catch (error) {
    console.error('❌ Error updating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client',
      error: error.message
    });
  }
});

// Delete client
app.delete('/api/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const clientIndex = clients.findIndex(client => client._id === id);
    if (clientIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }
    
    const deletedClient = clients[clientIndex];
    clients.splice(clientIndex, 1);
    
    console.log('🗑️ Client deleted:', deletedClient.name);
    console.log('📊 Total clients:', clients.length);
    
    res.json({
      success: true,
      message: 'Client deleted successfully',
      client: deletedClient
    });
  } catch (error) {
    console.error('❌ Error deleting client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
      error: error.message
    });
  }
});

app.get('/api/keywords', (req, res) => {
  res.json([
    { _id: '1', keyword: 'demo keyword 1', clientId: '1', status: 'active', targetRegions: ['US', 'UK'], priority: 'high', createdAt: new Date() },
    { _id: '2', keyword: 'demo keyword 2', clientId: '1', status: 'active', targetRegions: ['US'], priority: 'medium', createdAt: new Date() },
  ]);
});

// Get all scans
app.get('/api/scans', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const scans = await Scan.find().populate('clientId', 'name email company').sort({ createdAt: -1 });
      res.json(scans);
    } else {
      // Fallback to in-memory
      res.json(scans);
    }
  } catch (error) {
    console.error('❌ Error fetching scans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scans' });
  }
});

// Create new scan
app.post('/api/scans', async (req, res) => {
  try {
    const scanData = req.body;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const newScan = new Scan(scanData);
      await newScan.save();
      
      console.log('✅ New scan created in MongoDB for client:', scanData.clientId);
      
      res.status(201).json({
        success: true,
        message: 'Scan created successfully',
        scan: newScan
      });
    } else {
      // Fallback to in-memory
      const newScan = {
        _id: Date.now().toString(),
        ...scanData,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date()
      };
      
      scans.push(newScan);
      
      console.log('✅ New scan created in memory for client:', scanData.clientId);
      
      res.status(201).json({
        success: true,
        message: 'Scan created successfully',
        scan: newScan
      });
    }
  } catch (error) {
    console.error('❌ Error creating scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scan',
      error: error.message
    });
  }
});

// Get individual scan
app.get('/api/scans/:id', async (req, res) => {
  try {
    const scanId = req.params.id;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const scan = await Scan.findById(scanId).populate('clientId', 'name email company');
      if (!scan) {
        return res.status(404).json({ success: false, message: 'Scan not found' });
      }
      res.json(scan);
    } else {
      // Fallback to in-memory
      const scan = scans.find(s => s._id === scanId);
      if (!scan) {
        return res.status(404).json({ success: false, message: 'Scan not found' });
      }
      res.json(scan);
    }
  } catch (error) {
    console.error('❌ Error fetching scan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scan' });
  }
});

// Delete scan
app.delete('/api/scans/:id', async (req, res) => {
  try {
    const scanId = req.params.id;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const deletedScan = await Scan.findByIdAndDelete(scanId);
      if (!deletedScan) {
        return res.status(404).json({ success: false, message: 'Scan not found' });
      }
      
      // Also delete associated scan results
      await ScanResult.deleteMany({ scanId: scanId });
      
      console.log('✅ Scan deleted from MongoDB:', scanId);
      res.json({ success: true, message: 'Scan deleted successfully' });
    } else {
      // Fallback to in-memory
      const scanIndex = scans.findIndex(s => s._id === scanId);
      if (scanIndex === -1) {
        return res.status(404).json({ success: false, message: 'Scan not found' });
      }
      
      scans.splice(scanIndex, 1);
      // Also remove associated scan results
      const resultIndices = scanResults.map((result, index) => result.scanId === scanId ? index : -1).filter(i => i !== -1);
      resultIndices.reverse().forEach(index => scanResults.splice(index, 1));
      
      console.log('✅ Scan deleted from memory:', scanId);
      res.json({ success: true, message: 'Scan deleted successfully' });
    }
  } catch (error) {
    console.error('❌ Error deleting scan:', error);
    res.status(500).json({ success: false, message: 'Failed to delete scan' });
  }
});

// Get scan results
app.get('/api/scans/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const results = await ScanResult.find({ scanId: id }).sort({ position: 1 });
      
      res.json({
        success: true,
        results: results
      });
    } else {
      // Fallback to in-memory
      const results = scanResults.filter(result => result.scanId === id);
      
      res.json({
        success: true,
        results: results
      });
    }
  } catch (error) {
    console.error('❌ Error fetching scan results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scan results',
      error: error.message
    });
  }
});

// Store scan results
app.post('/api/scans/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const results = req.body.results;
    
    if (mongoose.connection.readyState === 1) {
      // Use MongoDB
      const resultsWithScanId = results.map(result => ({
        ...result,
        scanId: id
      }));
      
      await ScanResult.insertMany(resultsWithScanId);
      
      console.log('✅ Scan results stored in MongoDB for scan:', id);
      
      res.status(201).json({
        success: true,
        message: 'Scan results stored successfully',
        results: resultsWithScanId
      });
    } else {
      // Fallback to in-memory
      const resultsWithScanId = results.map(result => ({
        ...result,
        scanId: id,
        _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date()
      }));
      
      scanResults.push(...resultsWithScanId);
      
      console.log('✅ Scan results stored in memory for scan:', id);
      
      res.status(201).json({
        success: true,
        message: 'Scan results stored successfully',
        results: resultsWithScanId
      });
    }
  } catch (error) {
    console.error('❌ Error storing scan results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store scan results',
      error: error.message
    });
  }
});

app.get('/api/reports', (req, res) => {
  res.json([
    { _id: '1', clientId: { name: 'Demo Client 1' }, weekNumber: 1, region: 'US', status: 'completed', summary: { totalLinks: 10, positiveLinks: 7, negativeLinks: 2 }, generatedAt: new Date() },
    { _id: '2', clientId: { name: 'Demo Client 2' }, weekNumber: 2, region: 'UK', status: 'completed', summary: { totalLinks: 8, positiveLinks: 6, negativeLinks: 1 }, generatedAt: new Date() },
  ]);
});

app.get('/api/reports/my-reports', (req, res) => {
  res.json([
    { _id: '1', clientId: 'demo-client-1', weekNumber: 1, region: 'US', status: 'completed', summary: { totalLinks: 10, positiveLinks: 7, negativeLinks: 2 }, generatedAt: new Date() },
    { _id: '2', clientId: 'demo-client-1', weekNumber: 2, region: 'UK', status: 'completed', summary: { totalLinks: 8, positiveLinks: 6, negativeLinks: 1 }, generatedAt: new Date() },
  ]);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 AceTrack™ Server running on port ${PORT}`);
  console.log(`📊 ORM Tracking System Active (Demo Mode)`);
  console.log(`🔗 Frontend: http://localhost:3000`);
  console.log(`🔗 Backend: http://localhost:${PORT}`);
  console.log(`\n📝 Demo Credentials:`);
  console.log(`   Admin: admin@acetrack.com / admin123`);
  console.log(`   Client: client@acetrack.com / client123`);
  
  // Start the scheduler service
  schedulerService.start();
  console.log(`⏰ Scheduler service started - Weekly scans scheduled`);
});
