const admin = require('../services/firebase-admin');
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

    // Try to verify client token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        
        // Fetch additional user data from Firestore (like role)
        try {
          const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            req.user.role = userData.role;
            req.user.admin = userData.role === 'admin';
            req.user.name = userData.name;
          }
        } catch (dbError) {
          console.warn('Could not fetch user role from Firestore:', dbError.message);
        }

        console.log(`✅ Authentication successful for user: ${req.user.uid} (Role: ${req.user.role || 'user'})`);
        return next();
      } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        // Fall through to server authentication if token verification fails?
        // Actually, if a token was provided but is invalid, we should probably fail.
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
    }

    // Fallback to server authentication (if no token provided)
    // Note: This might be needed for some background tasks or specific flows
    const serverUid = await initializeFirebase();
    req.user = {
      uid: serverUid,
      email: process.env.FIREBASE_SERVER_EMAIL,
      role: 'admin', // Assume server user has admin privileges
      emailVerified: true
    };
    console.log('⚠️ Authentication falling back to server user:', req.user.uid);
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed. Please check server configuration.' 
    });
  }
};

module.exports = { authenticate };