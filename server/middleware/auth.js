const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId).populate('clientId');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    });
  } catch (error) {
    res.status(401).json({ message: 'Authorization failed' });
  }
};

const clientAuth = async (req, res, next) => {
  console.log('🔐 [CLIENT AUTH] Request:', req.method, req.path);
  console.log('🔐 [CLIENT AUTH] Headers:', {
    authorization: req.header('Authorization') ? 'Present' : 'Missing',
    authHeaderLength: req.header('Authorization')?.length || 0,
    authHeaderPreview: req.header('Authorization')?.substring(0, 20) || 'N/A'
  });
  try {
    const authHeader = req.header('Authorization');
    console.log('🔐 [CLIENT AUTH] Full auth header:', authHeader ? `"${authHeader.substring(0, 50)}..."` : 'MISSING');
    
    const token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
    
    if (!token) {
      console.log('❌ [CLIENT AUTH] No token provided');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('🔐 [CLIENT AUTH] Token extracted, length:', token.length);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId).populate('clientId');
    
    if (!user || !user.isActive) {
      console.log('❌ [CLIENT AUTH] Invalid token or inactive user');
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    console.log('🔐 [CLIENT AUTH] User:', { role: req.user.role, clientId: req.user.clientId?.toString() });
    
    if (req.user.role !== 'client') {
      console.log('❌ [CLIENT AUTH] Role check failed:', req.user.role);
      return res.status(403).json({ message: 'Client access required' });
    }
    
    console.log('✅ [CLIENT AUTH] Authentication passed');
    next();
  } catch (error) {
    console.log('❌ [CLIENT AUTH] Error:', error.message);
    console.log('❌ [CLIENT AUTH] Error type:', error.name);
    console.log('❌ [CLIENT AUTH] Error stack:', error.stack?.substring(0, 200));
    res.status(401).json({ message: 'Authorization failed', error: error.message });
  }
};

module.exports = { auth, adminAuth, clientAuth };



