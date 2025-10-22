const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Simple in-memory storage for demo
const users = [
  {
    id: 1,
    email: 'admin@acetrack.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    email: 'client@acetrack.com',
    password: 'client123',
    role: 'client',
    clientId: 'demo-client-1'
  }
];

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      userId: user.id,
      role: user.role,
      clientId: user.clientId,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId,
        clientName: user.role === 'client' ? 'Demo Client' : null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      clientName: user.role === 'client' ? 'Demo Client' : null,
    });
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
});

module.exports = router;



