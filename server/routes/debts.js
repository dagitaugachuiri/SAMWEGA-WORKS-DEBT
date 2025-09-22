const express = require('express');
const { collection, addDoc, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, updateDoc, setDoc, getFirestore, arrayUnion } = require('firebase/firestore');
const { getFirestoreApp } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const smsService = require('../services/sms');

const router = express.Router();

// Generate unique debt code
const generateDebtCode = async () => {
  const db = getFirestoreApp();
  let code;
  let isUnique = false;
  const maxAttempts = 10;
  let attempts = 0;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const q = query(collection(db, 'debts'), where('debtCode', '==', code), limit(1));
    const querySnapshot = await getDocs(q);
    isUnique = querySnapshot.empty;
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique debt code');
  }

  return code;
};

// POST /debts - Create debt and update/create customer records
router.post('/', authenticate, validate(schemas.debt), async (req, res) => {
  try {
    console.log('POST /debts request body:', JSON.stringify(req.body, null, 2));
    const db = getFirestore();
    const userId = req.user.uid;

    // Normalize phone number if storeOwner is provided
    let normalizedPhoneNumber;
    if (req.body.storeOwner && req.body.storeOwner.phoneNumber) {
      normalizedPhoneNumber = req.body.storeOwner.phoneNumber.replace(/\s/g, '');
    }

    // Generate unique debt code
    const debtCode = await generateDebtCode();

    // Create debt record, preserving original flexibility with req.body
    const debtData = {
      ...req.body,
      userId,
      debtCode,
      status: 'pending',
      paidAmount: 0,
      remainingAmount: Number(req.body.amount),
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      manualPaymentRequested: false,
      ...(req.body.storeOwner && normalizedPhoneNumber
        ? { storeOwner: { ...req.body.storeOwner, phoneNumber: normalizedPhoneNumber } }
        : {}),
    };
    console.log('Debt data to save:', JSON.stringify(debtData, null, 2));

    const debtRef = await addDoc(collection(db, 'debts'), debtData);
    const debtId = debtRef.id;
    console.log('Debt created with ID:', debtId);

      // Create or update customer record if storeOwner and store are provided
    let customerData = null;
    if (req.body.storeOwner && normalizedPhoneNumber && req.body.store) {
      const { name } = req.body.storeOwner;
      const { name: shopName, location } = req.body.store;
      const customerRef = doc(db, 'customers', normalizedPhoneNumber);
      const customerSnap = await getDoc(customerRef);

      if (customerSnap.exists()) {
        // Update existing customer: only append debtCode and update lastUpdatedAt
        await updateDoc(customerRef, {
          debtIds: arrayUnion(debtCode),
          lastUpdatedAt: new Date(),
        });
        console.log('Customer debtIds updated for ID:', normalizedPhoneNumber);
        // Fetch updated customer data for response
        const updatedCustomerSnap = await getDoc(customerRef);
        customerData = {
          phoneNumber: normalizedPhoneNumber,
          ...updatedCustomerSnap.data(),
        };
      } else {
        // Create new customer 
        customerData = {
          phoneNumber: normalizedPhoneNumber,
          name,
          shopName,
          location,
          debtIds: [debtCode],
          createdBy: userId,
          createdAt: new Date(),
          lastUpdatedAt: new Date(),
        };
        // Remove undefined fields to prevent Firebase error
        Object.keys(customerData).forEach(key => customerData[key] === undefined && delete customerData[key]);
        console.log('Customer data to save:', JSON.stringify(customerData, null, 2));
        await setDoc(customerRef, customerData);
        console.log('Customer record created with ID:', normalizedPhoneNumber);
      }
    }

    // Send SMS notification if storeOwner phoneNumber is available
    let smsResult = { data: null };
    if (normalizedPhoneNumber) {
      const smsMessage = smsService.generateInvoiceSMS(debtData);
      console.log('SMS message:', smsMessage);
      smsResult = await smsService.sendSMS(
        normalizedPhoneNumber,
        smsMessage,
        userId,
        debtId
      );
      console.log('SMS result:', JSON.stringify(smsResult, null, 2));
    }

    res.status(201).json({
      success: true,
      data: { id: debtId, ...debtData },
      ...(customerData ? { customer: { id: normalizedPhoneNumber, ...customerData } } : {}),
      sms: smsResult.data,
    });
  } catch (error) {
    console.error('Create debt/customer error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create debt or customer record',
    });
  }
});
// Get all debts for authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const userId = req.user.uid;

    // Query parameters for filtering and pagination
    const { status, limit: limitParam = '50', offset = '0', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Get current timestamp in seconds for overdue comparison
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Base query for user's debts
    let q = query(collection(db, 'debts'), where('userId', '==', userId));

    // Apply status filter if provided (excluding overdue)
    if (status && ['pending', 'paid', 'partially_paid'].includes(status)) {
      q = query(q, where('status', '==', status));
    }

    // Apply sorting
    q = query(q, orderBy(sortBy, sortOrder));

    // Apply pagination
    const limitNum = parseInt(limitParam, 10);
    const offsetNum = parseInt(offset, 10);
    q = query(q, limit(limitNum));

    if (offsetNum > 0) {
      const offsetQuery = query(collection(db, 'debts'), where('userId', '==', userId), orderBy(sortBy, sortOrder));
      const offsetSnapshot = await getDocs(offsetQuery);
      const lastVisible = offsetSnapshot.docs[offsetNum - 1];
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }
    }

    // Fetch debts
    const snapshot = await getDocs(q);
    const debts = snapshot.docs.map(doc => {
      const data = doc.data();
      const isOverdue = data.dueDate && data.dueDate.seconds && data.dueDate.seconds < currentTimestamp && (data.remainingAmount || 0) > 0;
      return {
        id: doc.id,
        ...data,
        status: isOverdue ? 'overdue' : data.status,
        createdAt: data.createdAt,
        lastUpdatedAt: data.lastUpdatedAt,
        lastPaymentDate: data.lastPaymentDate || null,
      };
    });

    // Filter debts for overdue status if requested
    const filteredDebts = status === 'overdue' ? debts.filter(debt => debt.status === 'overdue') : debts;

    // Get total count for pagination info
    const totalQuery = query(collection(db, 'debts'), where('userId', '==', userId));
    const totalSnapshot = await getDocs(totalQuery);
    let total;
    if (status === 'overdue') {
      total = totalSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.dueDate && data.dueDate.seconds && data.dueDate.seconds < currentTimestamp && (data.remainingAmount || 0) > 0;
      }).length;
    } else {
      total = totalSnapshot.size;
    }

    res.json({
      success: true,
      data: filteredDebts,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + filteredDebts.length < total,
      },
    });
  } catch (error) {
    console.error('Get debts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve debts',
    });
  }
});

// Get specific debt by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { id } = req.params;
    const userId = req.user.uid;

    const docRef = doc(db, 'debts', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found',
      });
    }

    const debt = docSnap.data();

    if (debt.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: {
        id: docSnap.id,
        ...debt,
        createdAt: debt.createdAt,
        lastUpdatedAt: debt.lastUpdatedAt,
        lastPaymentDate: debt.lastPaymentDate || null,
      },
    });
  } catch (error) {
    console.error('Get debt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve debt',
    });
  }
});

// Process manual payment for debt (SMS-based system)
router.post('/:id/payment', authenticate, validate(schemas.payment), async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { id } = req.params;
    const userId = req.user.uid;
    const { amount, paymentMethod, phoneNumber, chequeNumber, bankName, chequeDate, createdBy, transactionCode } = req.body;

    const debtDoc = doc(db, 'debts', id);
    const debtSnapshot = await getDoc(debtDoc);

    if (!debtSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found',
      });
    }

    const debt = debtSnapshot.data();

    if (debt.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (debt.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Debt is already fully paid',
      });
    }

    if (!debt.manualPaymentRequested) {
      return res.status(400).json({
        success: false,
        error: 'Manual payment request required before processing payment',
      });
    }

    // Process payment directly (no external payment service needed)
    const newPaidAmount = (debt.paidAmount || 0) + amount;
    const newRemainingAmount = Math.max(0, debt.amount - newPaidAmount);
    const newStatus = newRemainingAmount === 0 ? 'paid' : 'partially_paid';

    // Use 'manual mpesa' for mpesa payment method in debt record
    const effectivePaymentMethod = paymentMethod === 'mpesa' ? 'manual_mpesa' : paymentMethod;

    await updateDoc(debtDoc, {
      status: newStatus,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentMethod: effectivePaymentMethod,
      paidPaymentMethod: effectivePaymentMethod, // Store effective method
      lastPaymentDate: new Date(),
      lastUpdatedAt: new Date(),
      manualPaymentRequested: false, // Reset the request flag
    });

    // Log the payment with original paymentMethod
    const paymentLogData = {
      debtId: id,
      amount: amount,
      paymentMethod: paymentMethod,
      reference: debt.debtCode,
      success: true,
      phoneNumber: phoneNumber,
      accountNumber: debt.debtCode,
      processedAt: new Date(),
      manualProcessed: true,
      createdBy: createdBy
    };

    // Conditionally add fields based on payment method
    if (paymentMethod === 'cheque') {
      paymentLogData.chequeNumber = chequeNumber;
      paymentLogData.bankName = bankName;
      paymentLogData.chequeDate = chequeDate;
    } else if (paymentMethod === 'bank') {
      paymentLogData.bankName = bankName;
      paymentLogData.transactionCode = transactionCode;
    }else if (paymentMethod === 'mpesa') {
      paymentLogData.transactionCode = transactionCode; // For mpesa, use transactionCode as transactionId
    }

    await addDoc(collection(db, 'payment_logs'), paymentLogData);

    // Send SMS confirmation to store owner
    const confirmationMessage = smsService.generatePaymentConfirmationSMS(debt, amount);
    const smsResult = await smsService.sendSMS(
      debt.storeOwner.phoneNumber,
      confirmationMessage,
      userId,
      id,
    );

    const updatedDebt = {
      id,
      ...debt,
      status: newStatus,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentMethod: effectivePaymentMethod,
      lastPaymentDate: new Date(),
      lastUpdatedAt: new Date(),
    };

    res.json({
      success: true,
      data: updatedDebt,
      payment: {
        success: true,
        amount: amount,
        method: paymentMethod, // Use original paymentMethod in response
        status: newStatus
      },
      sms: smsResult.data,
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process payment',
    });
  }
});

// Request manual payment
router.post('/:debtId/manual-request', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { debtId } = req.params;
    const userId = req.user.uid;

    const debtRef = doc(db, 'debts', debtId);
    const debtDoc = await getDoc(debtRef);

    if (!debtDoc.exists()) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    const debt = debtDoc.data();

    if (debt.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (debt.status === 'paid') {
      return res.status(400).json({ success: false, error: 'Debt is already fully paid' });
    }

    if (debt.manualPaymentRequested) {
      return res.status(400).json({ success: false, error: 'Manual payment already requested' });
    }

    const smsMessage = `Manual payment requested for debt #${debt.debtCode}. Store: ${debt.store.name}, Owner: ${debt.storeOwner.name}, Amount: KES ${debt.amount}, Due: ${new Date(debt.dueDate).toLocaleDateString('en-GB')}. Please approve.`;
    await smsService.sendSMS('+254715046894', smsMessage, userId, debtId);
  
    await updateDoc(debtRef, { manualPaymentRequested: true });

    res.json({ success: true, data: { manualPaymentRequested: true } });
  } catch (error) {
    console.error('Error requesting manual payment:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update debt status (for manual updates like cheque clearance)
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.uid;

    if (!['pending', 'paid', 'partially_paid', 'overdue'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const debtDoc = doc(db, 'debts', id);
    const debtSnapshot = await getDoc(debtDoc);

    if (!debtSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found',
      });
    }

    const debt = debtSnapshot.data();

    if (debt.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    await updateDoc(debtDoc, {
      status,
      notes: notes || debt.notes || '',
      lastUpdatedAt: new Date(),
    });

    res.json({
      success: true,
      data: {
        id,
        ...debt,
        status,
        notes: notes || debt.notes || '',
        lastUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Update debt status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update debt status',
    });
  }
});

// Delete debt record (soft delete)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { id } = req.params;
    const userId = req.user.uid;

    const debtDoc = doc(db, 'debts', id);
    const debtSnapshot = await getDoc(debtDoc);

    if (!debtSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found',
      });
    }

    const debt = debtSnapshot.data();

    if (debt.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (debt.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete debt with payments',
      });
    }

    await updateDoc(debtDoc, {
      status: 'deleted',
      deletedAt: new Date(),
      lastUpdatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Debt record deleted successfully',
    });
  } catch (error) {
    console.error('Delete debt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete debt',
    });
  }
});

// Add this new route to handle resending invoice SMS
router.post('/:id/resend-invoice-sms', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const { id } = req.params;
    const userId = req.user.uid;

    // Get the debt document
    const debtDoc = doc(db, 'debts', id);
    const debtSnapshot = await getDoc(debtDoc);

    if (!debtSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Debt not found'
      });
    }

    const debt = { 
      id: debtSnapshot.id, 
      ...debtSnapshot.data(),
      // Ensure remainingAmount is properly set
      remainingAmount: debtSnapshot.data().remainingAmount || 
                      (debtSnapshot.data().amount - (debtSnapshot.data().paidAmount || 0))
    };

    // Check ownership
    if (debt.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (debt.remainingAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Debt is already fully paid'
      });
    }

    // Generate and send invoice SMS with remaining amount
    const smsMessage = smsService.generateInvoiceSMS(debt);
    const smsResult = await smsService.sendSMS(
      debt.storeOwner.phoneNumber,
      smsMessage,
      userId,
      id
    );

    // Update last SMS sent timestamp
    await updateDoc(debtDoc, {
      lastInvoiceSMSSent: new Date(),
      lastUpdatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Invoice SMS resent successfully',
      sms: smsResult
    });

  } catch (error) {
    console.error('Resend invoice SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resend invoice SMS'
    });
  }
});
// New reconciliation endpoint
router.post('/reconcile', authenticate, async (req, res) => {
  try {
    const db = getFirestoreApp();
    const userId = req.user.uid;

    // Fetch all payment logs (global scope)
    const paymentLogsRef = collection(db, 'payment_logs');
    const paymentLogsSnapshot = await getDocs(query(paymentLogsRef, orderBy('createdAt', 'asc')));
    const paymentLogs = paymentLogsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Group payments by transactionId (primary) or reference (fallback)
    const paymentGroups = {};
    for (const log of paymentLogs) {
      const key = log.transactionId || log.reference || `no-id-${log.id}`;
      if (!paymentGroups[key]) {
        paymentGroups[key] = [];
      }
      paymentGroups[key].push(log);
    }

    const duplicates = [];
    const debtUpdates = {};
    const reconciliationLog = {
      userId,
      reconciledAt: new Date(),
      totalDuplicatesFound: 0,
      totalAmountCorrected: 0,
      debtsUpdated: [],
      duplicatePayments: []
    };

    // Process duplicates
    for (const key of Object.keys(paymentGroups)) {
      const group = paymentGroups[key];
      if (group.length > 1) { // Duplicates found
        const primaryPayment = group[0]; // Keep first payment as valid
        const duplicatePayments = group.slice(1); // Mark rest as duplicates
        for (const dup of duplicatePayments) {
          if (dup.isDuplicate) {
            // Skip already reconciled duplicates
            continue;
          }
          // Mark payment as duplicate
          await updateDoc(doc(db, 'payment_logs', dup.id), {
            isDuplicate: true,
            reconciledAt: new Date()
          });

          // Track duplicate for response and logging
          duplicates.push({
            paymentId: dup.id,
            debtId: dup.debtId,
            amount: dup.amount,
            transactionId: dup.transactionId,
            reference: dup.reference
          });
          reconciliationLog.duplicatePayments.push({
            paymentId: dup.id,
            debtId: dup.debtId,
            amount: dup.amount,
            transactionId: dup.transactionId,
            reference: dup.reference
          });
          reconciliationLog.totalDuplicatesFound += 1;
          reconciliationLog.totalAmountCorrected += dup.amount;

          // Accumulate debt updates
          if (dup.debtId) {
            if (!debtUpdates[dup.debtId]) {
              debtUpdates[dup.debtId] = { totalDeduction: 0, paymentIds: [] };
            }
            debtUpdates[dup.debtId].totalDeduction += dup.amount;
            debtUpdates[dup.debtId].paymentIds.push(dup.id);
          }
        }
      }
    }

    // Update affected debts
    for (const debtId of Object.keys(debtUpdates)) {
      const debtRef = doc(db, 'debts', debtId);
      const debtSnapshot = await getDoc(debtRef);

      if (debtSnapshot.exists()) {
        const debt = debtSnapshot.data();
        const deduction = debtUpdates[debtId].totalDeduction;
        const newPaidAmount = Math.max(0, (debt.paidAmount || 0) - deduction);
        const newRemainingAmount = Math.max(0, debt.amount - newPaidAmount);
        let newStatus = debt.status;

        if (newRemainingAmount === 0 && newPaidAmount >= debt.amount) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partially_paid';
        } else {
          newStatus = 'pending';
        }

        // Update debt
        await updateDoc(debtRef, {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
          lastUpdatedAt: new Date()
        });

        reconciliationLog.debtsUpdated.push({
          debtId,
          amountDeducted: deduction,
          newPaidAmount,
          newRemainingAmount,
          newStatus,
          paymentIds: debtUpdates[debtId].paymentIds
        });
      }
    }

    // Log reconciliation action
    if (reconciliationLog.totalDuplicatesFound > 0) {
      await addDoc(collection(db, 'reconciliation_logs'), reconciliationLog);
    }

    // Send SMS notification to admin numbers if duplicates were found
    if (reconciliationLog.totalDuplicatesFound > 0) {
      const smsMessage = `Reconciliation completed: ${reconciliationLog.totalDuplicatesFound} duplicate payments found, KES ${reconciliationLog.totalAmountCorrected}. Please review the debt details.`;
      await Promise.all([
        smsService.sendSMS('+254715046894', smsMessage, userId, 'reconciliation'),
        smsService.sendSMS('+254743466032', smsMessage, userId, 'reconciliation')
      ]);
    }

    res.json({
      success: true,
      message: reconciliationLog.totalDuplicatesFound > 0
        ? `Reconciliation completed: ${reconciliationLog.totalDuplicatesFound} duplicates found and corrected`
        : 'No duplicate payments found',
      data: {
        totalDuplicates: reconciliationLog.totalDuplicatesFound,
        totalAmountCorrected: reconciliationLog.totalAmountCorrected,
        debtsUpdated: reconciliationLog.debtsUpdated,
        duplicatePayments: duplicates
      }
    });

  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform reconciliation'
    });
  }
});

module.exports = router;