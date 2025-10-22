const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Client = require('../models/Client');
const User = require('../models/User');
const { adminAuth, clientAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/logos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all clients (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single client
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get client's own data
router.get('/me/data', clientAuth, async (req, res) => {
  try {
    const client = await Client.findById(req.user.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new client
router.post('/', adminAuth, upload.single('logo'), async (req, res) => {
  try {
    const {
      name,
      password,
      contact,
      settings
    } = req.body;

    console.log('📝 Creating client with data:', { name, contact, settings });

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    let parsedContact, parsedSettings;
    
    // Handle contact - make it optional with defaults
    try {
      if (contact && contact !== 'undefined') {
        parsedContact = JSON.parse(contact);
      } else {
        parsedContact = {
          email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
          phone: '',
          company: ''
        };
      }
    } catch (e) {
      console.error('❌ Error parsing contact:', e.message);
      parsedContact = {
        email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        phone: '',
        company: ''
      };
    }
    
    // Handle settings - make it optional with defaults
    try {
      if (settings && settings !== 'undefined') {
        parsedSettings = JSON.parse(settings);
      } else {
        parsedSettings = {
          industry: '',
          businessType: '',
          targetAudience: '',
          website: '',
          description: ''
        };
      }
    } catch (e) {
      console.error('❌ Error parsing settings:', e.message);
      parsedSettings = {
        industry: '',
        businessType: '',
        targetAudience: '',
        website: '',
        description: ''
      };
    }

    const clientData = {
      name,
      contact: parsedContact,
      settings: parsedSettings,
    };

    if (req.file) {
      clientData.logo = `/uploads/logos/${req.file.filename}`;
    }

    console.log('✅ Creating client with parsed data:', clientData);

    const client = new Client(clientData);
    await client.save();

    // Create a user account for the client
    try {
      const User = require('../models/User');
      const clientEmail = parsedContact.email || `${name.toLowerCase().replace(/\s+/g, '')}@example.com`;
      const clientPassword = password || 'client123'; // Use provided password or fallback to default
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: clientEmail });
      if (!existingUser) {
        const user = new User({
          email: clientEmail,
          password: clientPassword,
          role: 'client',
          clientId: client._id,
          isActive: true
        });
        
        await user.save();
        console.log('✅ Created user account for client:', {
          email: user.email,
          clientId: user.clientId,
          clientName: client.name
        });
      } else {
        console.log('⚠️ User already exists for this email:', clientEmail);
      }
    } catch (userError) {
      console.error('❌ Error creating user account:', userError.message);
      // Don't fail client creation if user creation fails
    }

    console.log('✅ Client created successfully:', client._id);
    res.status(201).json({ message: 'Client created successfully', client });
  } catch (error) {
    console.error('❌ Client creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update client
router.put('/:id', adminAuth, upload.single('logo'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const {
      name,
      subscription,
      contact,
      settings
    } = req.body;

    if (name) client.name = name;
    if (subscription) client.subscription = JSON.parse(subscription);
    if (contact) client.contact = JSON.parse(contact);
    if (settings) client.settings = JSON.parse(settings);

    if (req.file) {
      // Delete old logo if exists
      if (client.logo) {
        try {
          await fs.unlink(path.join(__dirname, '../', client.logo));
        } catch (error) {
          console.log('Old logo file not found or already deleted');
        }
      }
      client.logo = `/uploads/logos/${req.file.filename}`;
    }

    await client.save();
    res.json({ message: 'Client updated successfully', client });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete client
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Delete logo file if exists
    if (client.logo) {
      try {
        await fs.unlink(path.join(__dirname, '../', client.logo));
      } catch (error) {
        console.log('Logo file not found or already deleted');
      }
    }

    // Delete associated users
    await User.deleteMany({ clientId: client._id });

    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get client statistics
router.get('/:id/stats', adminAuth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Get basic stats (you can expand this with more detailed analytics)
    const stats = {
      totalKeywords: await require('../models/Keyword').countDocuments({ clientId: client._id }),
      activeKeywords: await require('../models/Keyword').countDocuments({ clientId: client._id, status: 'active' }),
      totalScans: await require('../models/Scan').countDocuments({ clientId: client._id }),
      totalReports: await require('../models/Report').countDocuments({ clientId: client._id }),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



