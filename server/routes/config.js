const express = require('express');
const router = express.Router();
const admin = require('../services/firebase-admin');
const { authenticate } = require('../middleware/auth');

const db = admin.firestore();

// Get fingerprints
router.get('/fingerprints', async (req, res) => {
  try {
    const doc = await db.collection('config').doc('allowed_devices').get();
    if (!doc.exists) {
      return res.status(200).json({ success: true, data: [] });
    }
    res.status(200).json({ success: true, data: doc.data().fingerprints || [] });
  } catch (error) {
    console.error('Error fetching fingerprints:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shift times
router.get('/shift-times', async (req, res) => {
  try {
    const doc = await db.collection('config').doc('shift_times').get();
    if (!doc.exists) {
      return res.status(200).json({ 
        success: true, 
        data: {
          timeoutHour: 12,
          timeoutMinute: 40,
          timeInHour: 8,
          timeInMinute: 0,
          lastResetDate: ''
        } 
      });
    }
    res.status(200).json({ success: true, data: doc.data() });
  } catch (error) {
    console.error('Error fetching shift times:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get authorized vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('vehicles').get();
    const vehicles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json({ success: true, data: vehicles });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sales reps
router.get('/salesReps', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('salesReps').get();
    const reps = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json({ success: true, data: reps });
  } catch (error) {
    console.error('Error fetching sales reps:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add vehicle
router.post('/vehicles', authenticate, async (req, res) => {
  try {
    const { plateNumber } = req.body;
    if (!plateNumber) return res.status(400).json({ success: false, error: 'Plate number required' });
    const docRef = await db.collection('vehicles').add({ plateNumber });
    res.status(201).json({ success: true, data: { id: docRef.id, plateNumber } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete vehicle
router.delete('/vehicles/:id', authenticate, async (req, res) => {
  try {
    await db.collection('vehicles').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add sales rep
router.post('/salesReps', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name required' });
    const docRef = await db.collection('salesReps').add({ name });
    res.status(201).json({ success: true, data: { id: docRef.id, name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete sales rep
router.delete('/salesReps/:id', authenticate, async (req, res) => {
  try {
    await db.collection('salesReps').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
