const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({ 
        message: 'Account suspended', 
        suspended: true,
        suspensionReason: user.suspensionReason,
        suspendedAt: user.suspendedAt
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
      }
      next();
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'Authorization failed' });
  }
};

const sellerAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Seller access required.' });
      }
      next();
    });
  } catch (error) {
    console.error('Seller auth error:', error);
    res.status(401).json({ message: 'Authorization failed' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    
    next();
  };
};

module.exports = { auth, adminAuth, sellerAuth, requireRole };