const { initializeFirebase } = require('../services/firebase');

const authenticate = async (req, res, next) => {
  try {
    // Demo mode - skip authentication
    if (process.env.DEMO_MODE === 'true') {
      req.user = {
        uid: 'demo-user-123',
        email: 'demo@samwega.com',
        emailVerified: true
      };
      console.log('✅ Authentication successful for demo user:', req.user.uid);
      return next();
    }

    // Use server authentication (demo@samwega.com)
    const serverUid = await initializeFirebase();
    req.user = {
      uid: serverUid,
      email: process.env.FIREBASE_SERVER_EMAIL,
      emailVerified: true
    };
    console.log('✅ Authentication successful for server user:', req.user.uid);
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed. Please check server configuration.' 
    });
  }
};

module.exports = { authenticate };