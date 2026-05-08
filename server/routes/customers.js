const express = require('express');
const router = express.Router();
const admin = require('../services/firebase-admin');
const db = admin.firestore();
const { authenticate } = require('../middleware/auth');
const smsService = require('../services/sms');

// Normalize phone number
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.replace(/\s/g, '');
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('0')) return `+254${cleaned.slice(1)}`;
  return cleaned;
}

// Get all customers
router.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    let query = db.collection('customers');
    
    const snapshot = await query.get();
    const customers = snapshot.docs.map(doc => ({
      phoneNumber: doc.id,
      ...doc.data(),
    }));

    const limitedCustomers = limit ? customers.slice(0, parseInt(limit)) : customers;
    res.status(200).json({ success: true, data: limitedCustomers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer by phoneNumber
router.get('/:phoneNumber', async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;
    const customerSnap = await db.collection('customers').doc(phoneNumber).get();

    if (customerSnap.exists) {
      res.status(200).json({
        success: true,
        data: { phoneNumber: customerSnap.id, ...customerSnap.data() },
      });
    } else {
      res.status(404).json({ success: false, error: 'Customer not found' });
    }
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new customer
router.post('/', authenticate, async (req, res) => {
  try {
    const { phoneNumber, name, shopName, location, debtIds } = req.body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'phoneNumber is required' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const customerRef = db.collection('customers').doc(normalizedPhoneNumber);
    const customerSnap = await customerRef.get();

    if (customerSnap.exists) {
      return res.status(409).json({ success: false, error: 'Customer already exists' });
    }

    const customerData = {
      phoneNumber: normalizedPhoneNumber,
      name: name.trim(),
      shopName: shopName || '',
      location: location || '',
      debtIds: debtIds || [],
      createdBy: req.user.uid,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    await customerRef.set(customerData);
    res.status(201).json({ success: true, data: { id: normalizedPhoneNumber, ...customerData } });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send custom message to multiple customers
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const { phoneNumbers, message, userId, type } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'phoneNumbers array is required' });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    const smsPromises = [];
    const validPhoneNumbers = [];

    for (const phoneNumber of phoneNumbers) {
      const customerSnap = await db.collection('customers').doc(phoneNumber).get();
      if (!customerSnap.exists) continue;

      validPhoneNumbers.push(phoneNumber);
      let finalMessage = message;

      if (type === 'reminder') {
        const customerData = customerSnap.data();
        const { name, debtIds } = customerData;

        let totalDebt = 0;
        let debtIdsList = 'N/A';

        if (debtIds && debtIds.length > 0) {
          const debtDocs = await Promise.all(
            debtIds.map(code => db.collection('debts').where('debtCode', '==', code).get())
          );
          const allDebts = debtDocs.flatMap(snap => snap.docs.map(d => d.data()));
          debtIdsList = allDebts.map(d => d.debtCode).join(',');
          totalDebt = allDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
        }

        const accountNumber = phoneNumber.startsWith('+254') ? `0${phoneNumber.slice(4)}` : phoneNumber;
        finalMessage = message
          .replace('[NAME]', name || 'Customer')
          .replace('[DEBTCODES]', debtIdsList)
          .replace('[TOTALDEBT]', `KES ${totalDebt.toLocaleString('en-KE')}`)
          .replace('[PHONENUMBER]', accountNumber);
      }

      smsPromises.push(smsService.sendSMS(phoneNumber, finalMessage, userId, type));
    }

    const results = await Promise.allSettled(smsPromises);
    const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    res.status(200).json({
      success: true,
      sentCount,
      data: { message, recipients: validPhoneNumbers }
    });
  } catch (error) {
    console.error('Error sending custom messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;