const express = require('express');
const router = express.Router();
const admin = require('../services/firebase-admin');
const db = admin.firestore();
const { authenticate } = require('../middleware/auth');

// Get all supplier debts
router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('supplierDebts');
    
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    const debts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: debts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create supplier debt
router.post('/', authenticate, async (req, res) => {
  try {
    const { supplierName, amount, description, dueDate } = req.body;
    const newDebt = {
      supplierName,
      amount: parseFloat(amount),
      description,
      dueDate: { seconds: new Date(dueDate).getTime() / 1000 },
      status: 'pending',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      userId: req.user.uid
    };
    const docRef = await db.collection('supplierDebts').add(newDebt);
    res.status(201).json({ success: true, data: { id: docRef.id, ...newDebt } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark as paid
router.patch('/:id/paid', authenticate, async (req, res) => {
  try {
    const debtRef = db.collection('supplierDebts').doc(req.params.id);
    await debtRef.update({
      status: 'paid',
      lastUpdatedAt: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
