const express = require('express');
const router = express.Router();
const admin = require('../services/firebase-admin');
const { authenticate } = require('../middleware/auth');

const db = admin.firestore();

// Admin-only middleware
const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.admin === true)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
};

// Resolve email from identifier (name or email)
// Public endpoint for login assistance
router.get('/resolve/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const lowerIdentifier = identifier.toLowerCase();

    // 1. Try by email
    const emailQuery = await db.collection('users').where('email', '==', lowerIdentifier).get();
    if (!emailQuery.empty) {
      return res.status(200).json({ success: true, email: emailQuery.docs[0].data().email });
    }

    // 2. Try by name (case-insensitive search in Firestore is hard without indexes, but for small user sets we can do this)
    // For now, let's just fetch all and find (matching the previous client-side logic)
    const allUsers = await db.collection('users').get();
    const userByName = allUsers.docs.find(doc => 
      (doc.data().name || '').toLowerCase() === lowerIdentifier
    );

    if (userByName) {
      return res.status(200).json({ success: true, email: userByName.data().email });
    }

    res.status(404).json({ success: false, error: 'User not found' });
  } catch (error) {
    console.error('Error resolving user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all users (Admin only)
router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user data
router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found in database' });
    }
    res.status(200).json({ success: true, data: { id: userDoc.id, ...userDoc.data() } });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID (Admin only)
router.get('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: { id: userDoc.id, ...userDoc.data() } });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user (Admin only)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { email, password, name, role, phoneNumber, createdByName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phoneNumber || undefined
    });

    // 2. Store additional data in Firestore
    const userData = {
      email,
      name: name || '',
      role: role || 'user',
      phoneNumber: phoneNumber || '',
      disabled: false,
      createdAt: new Date().toISOString(),
      createdBy: req.user.uid,
      createdByName: createdByName || 'Admin'
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    res.status(201).json({ 
      success: true, 
      data: { id: userRecord.uid, ...userData } 
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user (Admin or self for certain fields)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.uid === id;
    const adminUser = req.user.role === 'admin' || req.user.admin === true;

    if (!isSelf && !adminUser) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { name, role, disabled, phoneNumber } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    
    // Only admins can change role or disabled status
    if (adminUser) {
      if (role !== undefined) updates.role = role;
      if (disabled !== undefined) {
        updates.disabled = disabled;
        // Also update Firebase Auth disabled status
        await admin.auth().updateUser(id, { disabled });
      }
    }

    await db.collection('users').doc(id).update(updates);

    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update password
router.put('/:id/password', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const isSelf = req.user.uid === id;
    const adminUser = req.user.role === 'admin' || req.user.admin === true;

    if (!isSelf && !adminUser) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Update in Firebase Auth
    await admin.auth().updateUser(id, { password });

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
