const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsService = require('../services/sms');
const { getFirestore } = require('../services/firebase');

const router = express.Router();

// Test SMS functionality
router.post('/sms', authenticate, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    const testMessage = message || 'Test SMS from Samwega Works Ltd. debt management system.';
    const result = await smsService.sendTestSMS(phoneNumber);
    
    res.json({
      success: true,
      message: 'SMS test completed',
      result
    });
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({
      success: false,
      error: 'SMS test failed'
    });
  }
});

// Test payment simulation
router.post('/simulate-payment', authenticate, async (req, res) => {
  try {
    const { debtId, amount, paymentMethod } = req.body;
    
    if (!debtId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Debt ID and amount are required'
      });
    }
    
    // Verify debt exists and belongs to user
    const db = getFirestore();
    const debtDoc = await db.collection('debts').doc(debtId).get();
    
    if (!debtDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found'
      });
    }
    
    const debt = debtDoc.data();
    
    if (debt.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Simulate payment directly
    const newPaidAmount = (debt.paidAmount || 0) + amount;
    const newRemainingAmount = Math.max(0, debt.amount - newPaidAmount);
    const newStatus = newRemainingAmount === 0 ? 'paid' : 'partially_paid';
    
    await debtDoc.ref.update({
      status: newStatus,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      lastPaymentDate: new Date(),
      lastUpdated: new Date()
    });
    
    // Log the payment
    await db.collection('payment_logs').add({
      debtId: debtId,
      amount: amount,
      paymentMethod: paymentMethod,
      reference: debt.debtCode,
      success: true,
      phoneNumber: debt.storeOwner.phoneNumber,
      accountNumber: debt.debtCode,
      processedAt: new Date(),
      testSimulation: true
    });
    
    // Send confirmation SMS
    const confirmationMessage = smsService.generatePaymentConfirmationSMS(debt, amount);
    const smsResult = await smsService.sendSMS(
      debt.storeOwner.phoneNumber,
      confirmationMessage,
      req.user.uid,
      debtId
    );
    
    res.json({
      success: true,
      message: 'Payment simulation completed',
      data: {
        debt: {
          id: debtId,
          ...debt,
          status: newStatus,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount
        },
        payment: {
          success: true,
          amount: amount,
          method: paymentMethod,
          status: newStatus
        },
        sms: smsResult
      }
    });
  } catch (error) {
    console.error('Payment simulation error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment simulation failed'
    });
  }
});

// Test complete workflow
router.post('/workflow', authenticate, async (req, res) => {
  try {
    const db = getFirestore();
    const userId = req.user.uid;
    
    // Step 1: Create test debt
    const testDebt = {
      storeOwner: {
        name: 'Test Store Owner',
        phoneNumber: '+254712345678',
        email: 'test@example.com'
      },
      store: {
        name: 'Test Hardware Store',
        location: 'Nairobi'
      },
      amount: 5000,
      dateIssued: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      paymentMethod: 'mpesa',
      description: 'Test debt for workflow validation'
    };
    
    // Generate unique 6-digit code
    let debtCode;
    let isUnique = false;
    
    while (!isUnique) {
      debtCode = Math.floor(100000 + Math.random() * 900000).toString();
      const existingDebt = await db.collection('debts')
        .where('debtCode', '==', debtCode)
        .limit(1)
        .get();
      isUnique = existingDebt.empty;
    }
    
    const debtData = {
      ...testDebt,
      userId,
      debtCode,
      status: 'pending',
      paidAmount: 0,
      remainingAmount: testDebt.amount,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    const debtDocRef = await db.collection('debts').add(debtData);
    const debtId = debtDocRef.id;
    
    // Step 2: Send invoice SMS
    const invoiceSMS = smsService.generateInvoiceSMS({ ...debtData, id: debtId });
    const smsResult = await smsService.sendSMS(
      testDebt.storeOwner.phoneNumber,
      invoiceSMS,
      userId,
      debtId
    );
    
    // Step 3: Simulate payment directly
    await debtDocRef.update({
      status: 'partially_paid',
      paidAmount: 2500,
      remainingAmount: 2500,
      lastPaymentDate: new Date(),
      lastUpdated: new Date()
    });
    
    // Log the payment
    await db.collection('payment_logs').add({
      debtId: debtId,
      amount: 2500,
      paymentMethod: 'mpesa',
      reference: debtCode,
      success: true,
      phoneNumber: testDebt.storeOwner.phoneNumber,
      accountNumber: debtCode,
      processedAt: new Date(),
      testSimulation: true
    });
    
    // Send payment confirmation SMS
    const confirmationSMS = smsService.generatePaymentConfirmationSMS(debtData, 2500);
    const confirmationSMSResult = await smsService.sendSMS(
      testDebt.storeOwner.phoneNumber,
      confirmationSMS,
      userId,
      debtId
    );
    
    res.json({
      success: true,
      message: 'Complete workflow test completed successfully',
      data: {
        debtId,
        debtCode,
        steps: {
          debtCreation: { success: true, id: debtId },
          invoiceSMS: smsResult,
          paymentSimulation: { success: true, amount: 2500, method: 'mpesa' },
          confirmationSMS: confirmationSMSResult
        }
      }
    });
  } catch (error) {
    console.error('Workflow test error:', error);
    res.status(500).json({
      success: false,
      error: 'Workflow test failed'
    });
  }
});

// Test system health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoints are healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      sms: '/api/test/sms',
      payment: '/api/test/simulate-payment',
      workflow: '/api/test/workflow'
    }
  });
});

module.exports = router;
