const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsService = require('../services/sms');
const { getFirestore } = require('../services/firebase');

const router = express.Router();

// Approve manual payment (admin only - can be called via special endpoint)
router.post('/manual-approve/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { approvalCode } = req.body;
    
    // Simple approval code check (in production, use proper admin authentication)
    if (approvalCode !== 'SAMWEGA2024') {
      return res.status(401).json({ success: false, error: 'Invalid approval code' });
    }

    const db = getFirestore();
    const debtDoc = await db.collection('debts').doc(debtId).get();

    if (!debtDoc.exists) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    await debtDoc.ref.update({ 
      manualPaymentApproved: true,
      manualRequestPending: false,
      approvedAt: new Date()
    });

    res.json({ success: true, message: 'Manual payment approved' });
  } catch (error) {
    console.error('Manual payment approval error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve manual payment' });
  }
});

// Request manual payment approval
router.post('/manual-request', authenticate, async (req, res) => {
  try {
    const { debtId } = req.body;
    const db = getFirestore();
    const debtDoc = await db.collection('debts').doc(debtId).get();

    if (!debtDoc.exists) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    const debt = debtDoc.data();

    if (debt.manualRequestPending) {
      return res.status(400).json({ success: false, error: 'Manual approval already requested' });
    }

    // Send SMS alert with debt details
    const formatCurrency = (amount) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    const smsMessage = `🔴 MANUAL PAYMENT REQUEST\n\nDebt: #${debt.debtCode}\nStore: ${debt.store.name}\nOwner: ${debt.storeOwner.name}\nPhone: ${debt.storeOwner.phoneNumber}\nAmount: ${formatCurrency(debt.amount)}\nOutstanding: ${formatCurrency(debt.remainingAmount || debt.amount)}\n\nUser requesting manual payment processing.`;
    
    await smsService.sendSMS('+254743466032', smsMessage, req.user.uid, debtId);

    // Update debt document
    await debtDoc.ref.update({ manualRequestPending: true });

    res.json({ success: true, message: 'Manual payment request sent' });
  } catch (error) {
    console.error('Manual payment request error:', error);
    res.status(500).json({ success: false, error: 'Failed to request manual approval' });
  }
});

// Get payment instructions for a debt
router.get('/instructions/:debtCode', authenticate, async (req, res) => {
  try {
    const { debtCode } = req.params;
    
    // Get debt details
    const db = getFirestore();
    const debtQuery = await db.collection('debts')
      .where('debtCode', '==', debtCode)
      .limit(1)
      .get();

    if (debtQuery.empty) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    const debt = debtQuery.docs[0].data();
    const remainingAmount = debt.remainingAmount || debt.amount;

    // Generate payment instructions
    const instructions = {
      paybill: {
        number: '123456', // Default paybill number
        accountNumber: debtCode,
        amount: remainingAmount,
        instructions: [
          `Go to M-Pesa on your phone`,
          `Select "Lipa na M-Pesa"`,
          `Select "Pay Bill"`,
          `Enter Business Number: 123456`,
          `Enter Account Number: ${debtCode}`,
          `Enter Amount: ${remainingAmount}`,
          `Enter your M-Pesa PIN to complete`
        ]
      },
      message: `To pay: Go to M-Pesa > Lipa na M-Pesa > Pay Bill > Business No: 123456 > Account: ${debtCode} > Amount: KES ${remainingAmount}`
    };

    res.json({
      success: true,
      data: {
        debt: debt,
        instructions: instructions
      }
    });
  } catch (error) {
    console.error('Error getting payment instructions:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment instructions' });
  }
});

module.exports = router;
