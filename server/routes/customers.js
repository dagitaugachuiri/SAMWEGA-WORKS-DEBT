const express = require('express');
const { getFirestore, collection, getDocs, doc,query,where, getDoc, setDoc, updateDoc, arrayUnion, writeBatch } = require('firebase/firestore');
const router = express.Router();
const db = getFirestore();
const { authenticate } = require('../middleware/auth'); // Assuming auth middleware exists
const { sendSMS } = require('../services/sms');
const smsService = require('../services/sms');

// Normalize phone number (mirrors POST /debts endpoint logic)
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
    const customersRef = collection(db, 'customers');
    const querySnapshot = await getDocs(customersRef);
    const customers = querySnapshot.docs.map(doc => ({
      phoneNumber: doc.id,
      ...doc.data(),
    }));

    // Apply limit if provided
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
    const customerRef = doc(db, 'customers', phoneNumber);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
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

    // Validate required fields
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ success: false, error: 'phoneNumber is required and must be a string' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'name is required and must be a non-empty string' });
    }

    // Normalize phone number
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhoneNumber) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    // Validate debtIds if provided
    let validatedDebtIds = [];
    if (debtIds) {
      if (!Array.isArray(debtIds)) {
        return res.status(400).json({ success: false, error: 'debtIds must be an array' });
      }
      // Check if all debtIds exist
      const debtPromises = debtIds.map(id => getDoc(doc(db, 'debts', id)));
      const debtDocs = await Promise.all(debtPromises);
      validatedDebtIds = debtIds.filter((id, index) => debtDocs[index].exists());
      if (validatedDebtIds.length !== debtIds.length) {
        return res.status(400).json({ success: false, error: 'One or more debtIds do not exist' });
      }
    }

    // Check if customer already exists
    const customerRef = doc(db, 'customers', normalizedPhoneNumber);
    const customerSnap = await getDoc(customerRef);

    if (customerSnap.exists()) {
      return res.status(409).json({ success: false, error: 'Customer with this phone number already exists' });
    }

    // Prepare customer data (matches /debts endpoint structure)
    const customerData = {
      phoneNumber: normalizedPhoneNumber,
      name: name.trim(),
      shopName: shopName || '',
      location: location || '',
      debtIds: validatedDebtIds || [],
      createdBy: req.user.uid,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    // Remove undefined fields
    Object.keys(customerData).forEach(key => customerData[key] === undefined && delete customerData[key]);

    // Create customer
    await setDoc(customerRef, customerData);
    console.log(`Created customer ${normalizedPhoneNumber}`);

    res.status(201).json({
      success: true,
      data: { phoneNumber: normalizedPhoneNumber, ...customerData },
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/migrate', authenticate, async (req, res) => {
  const db = getFirestore();
  let batch = writeBatch(db); // Initialize Firestore batch using writeBatch
  const BATCH_LIMIT = 10000; // Firestore batch limit for writes
  let operationCount = 0;

  try {
    console.log('Starting debt-to-customer migration...');
    const userId = req.user.uid;
    console.log(`Authenticated as user: ${userId}`);

    // Fetch all debts
    const debtsSnapshot = await getDocs(collection(db, 'debts'));
    console.log(`Found ${debtsSnapshot.size} debt documents`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const debtDoc of debtsSnapshot.docs) {
      const debtData = debtDoc.data();
      const debtCode = debtData.debtCode;

      // Validate required fields, including debtCode
      if (!debtCode || typeof debtCode !== 'string' || debtCode.trim() === '') {
        console.log(`Skipping debt with doc ID ${debtDoc.id}: Missing or invalid debtCode`, {
          debtDocId: debtDoc.id,
          debtData: JSON.stringify(debtData, null, 2),
          reason: 'Missing or invalid debtCode',
        });
        skippedCount++;
        errors.push(`Debt with doc ID ${debtDoc.id}: Missing or invalid debtCode`);
        continue;
      }

      if (!debtData.storeOwner || !debtData.storeOwner.phoneNumber || !debtData.store) {
        console.log(`Skipping debt ${debtCode}: Missing storeOwner or store data`, {
          debtCode,
          debtData: JSON.stringify(debtData, null, 2),
          reason: 'Missing storeOwner or store data',
        });
        skippedCount++;
        errors.push(`Debt ${debtCode}: Missing storeOwner or store data`);
        continue;
      }

      // Normalize phone number
      const normalizedPhoneNumber = normalizePhoneNumber(debtData.storeOwner.phoneNumber);
      if (!normalizedPhoneNumber) {
        console.log(`Skipping debt ${debtCode}: Invalid phone number`, {
          debtCode,
          debtData: JSON.stringify(debtData, null, 2),
          reason: 'Invalid phone number',
        });
        skippedCount++;
        errors.push(`Debt ${debtCode}: Invalid phone number`);
        continue;
      }

      // Prepare customer data
      const customerData = {
        phoneNumber: normalizedPhoneNumber,
        name: debtData.storeOwner.name || '',
        shopName: debtData.store.name || '',
        location: debtData.store.location || '',
        debtIds: [debtCode], // Initialize with current debtCode
        createdBy: debtData.userId || userId,
        createdAt: debtData.createdAt || new Date(),
        lastUpdatedAt: new Date(),
      };

      // Remove undefined fields
      Object.keys(customerData).forEach(key => customerData[key] === undefined && delete customerData[key]);

      // Check if customer exists
      const customerRef = doc(db, 'customers', normalizedPhoneNumber);
      const customerSnap = await getDoc(customerRef);

      try {
        if (customerSnap.exists()) {
          const existingData = customerSnap.data();
          const currentDebtIds = Array.isArray(existingData.debtIds) ? existingData.debtIds : [];
          if (!currentDebtIds.includes(debtCode)) {
            batch.update(customerRef, {
              debtIds: arrayUnion(debtCode),
              lastUpdatedAt: new Date(),
            });
            console.log(`Queued update for customer ${normalizedPhoneNumber}: Added debtCode ${debtCode}`);
            updatedCount++;
          } else {
            console.log(`Customer ${normalizedPhoneNumber} already has debtCode ${debtCode}, skipping update`, {
              debtCode,
              debtData: JSON.stringify(debtData, null, 2),
              reason: 'Debt code already exists in customer record',
            });
            skippedCount++;
            continue;
          }
        } else {
          batch.set(customerRef, customerData);
          console.log(`Queued creation for customer ${normalizedPhoneNumber} with debtCode ${debtCode}`);
          createdCount++;
        }

        // Commit batch if approaching limit
        operationCount++;
        if (operationCount >= BATCH_LIMIT) {
          console.log(`Committing batch of ${operationCount} operations...`);
          await batch.commit();
          batch = writeBatch(db); // Reset batch using writeBatch
          operationCount = 0;
        }
      } catch (error) {
        console.error(`Error queuing debt ${debtCode} for customer ${normalizedPhoneNumber}:`, {
          debtCode,
          debtData: JSON.stringify(debtData, null, 2),
          error: error.message,
        });
        skippedCount++;
        errors.push(`Debt ${debtCode}: ${error.message}`);
      }
    }

    // Commit any remaining operations
    if (operationCount > 0) {
      console.log(`Committing final batch of ${operationCount} operations...`);
      await batch.commit();
    }

    console.log(`Migration complete:
      - Created ${createdCount} new customers
      - Updated ${updatedCount} existing customers
      - Skipped ${skippedCount} debts`);

    res.status(200).json({
      success: true,
      data: {
        createdCount,
        updatedCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error during migration:', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete migration',
    });
  }
});
// Send custom message to multiple customers
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const { phoneNumbers, message, userId, type } = req.body;

    // Validate required fields
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'phoneNumbers array is required and must not be empty' });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'message is required and must be a non-empty string' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (!type || !['custom', 'reminder', 'update'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type is required and must be one of: custom, reminder, update' });
    }

    // Verify user exists and is not disabled
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (userSnap.data().disabled) {
      return res.status(403).json({ success: false, error: 'User account is disabled' });
    }

    // Process messages for each valid phone number
    const smsPromises = [];
    const validPhoneNumbers = [];

    for (const phoneNumber of phoneNumbers) {
      const customerRef = doc(db, 'customers', phoneNumber);
      const customerSnap = await getDoc(customerRef);
      if (!customerSnap.exists()) {
        continue; // Skip invalid phone numbers
      }

      validPhoneNumbers.push(phoneNumber);
      let finalMessage = message;

      if (type === 'reminder') {
        const customerData = customerSnap.data();
        const { name, debtIds } = customerData;
console.log(customerData);

        // Fetch debt details using debtIds
        let debtIdsList = 'N/A';
        let totalDebt = 0;
        if (debtIds && debtIds.length > 0) {
          const debtPromises = debtIds.map(code => 
            getDocs(query(collection(db, 'debts'), where('debtCode', '==', code)))
          );
          const debtQuerySnapshots = await Promise.all(debtPromises);
          const debtDocs = debtQuerySnapshots.flatMap(snapshot => snapshot.docs);
          debtIdsList = debtDocs
            .filter(doc => doc.exists())
            .map(doc => doc.data().debtCode || doc.id)
            .join(',');
          totalDebt = debtDocs
            .filter(doc => doc.exists())
            .reduce((sum, doc) => sum + (doc.data().remainingAmount || 0), 0);
        }

        // Transform phone number for account number (replace +254 with 0)
        const accountNumber = phoneNumber.startsWith('+254') ? `0${phoneNumber.slice(4)}` : phoneNumber;

        // Replace placeholders
        finalMessage = message
          .replace('[NAME]', name || 'Customer')
          .replace('[DEBTCODES]', debtIdsList)
          .replace('[TOTALDEBT]', `KES ${totalDebt.toLocaleString('en-KE')}`)
          .replace('[PHONENUMBER]', accountNumber);

        // Validate message length after substitution
        if (finalMessage.length > 350) {
          return res.status(400).json({
            success: false,
            error: `Message for ${phoneNumber} exceeds 350 characters after placeholder substitution`
          });
        }
      }

      // Send SMS using original phone number
      smsPromises.push(smsService.sendSMS(phoneNumber, finalMessage, userId, type));
    }

    if (validPhoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid customer phone numbers provided' });
    }

    // Execute SMS sending
    const results = await Promise.allSettled(smsPromises);
    const sentCount = results.filter(result => result.status === 'fulfilled' && result.value.success).length;

    // Handle partial failures
    const errors = results
      .map((result, index) => result.status === 'rejected' ? ({
        phoneNumber: validPhoneNumbers[index],
        error: result.reason.message || 'Failed to send SMS'
      }) : null)
      .filter(Boolean);

    res.status(200).json({
      success: true,
      sentCount,
      data: { message, recipients: validPhoneNumbers },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending custom messages:', error);
    if (error.response && error.response.status === 422) {
      return res.status(422).json({
        success: false,
        error: 'SMS service validation error',
        details: error.response.data
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});
// Delete all customers
router.delete('/', authenticate, async (req, res) => {
  try {
    console.log('Starting deletion of customers collection...');
    const userId = req.user.uid;
    console.log(`Authenticated as user: ${userId}`);

    const customersSnapshot = await getDocs(collection(db, 'customers'));
    console.log(`Found ${customersSnapshot.size} customer documents`);

    let deletedCount = 0;
    const batch = writeBatch(db);

    for (const customerDoc of customersSnapshot.docs) {
      const customerId = customerDoc.id;
      batch.delete(doc(db, 'customers', customerId));
      console.log(`Scheduled deletion of customer ${customerId}`);
      deletedCount++;
    }

    await batch.commit();
    console.log(`Deletion complete: Deleted ${deletedCount} customers`);

    res.status(200).json({
      success: true,
      data: { deletedCount },
    });
  } catch (error) {
    console.error('Error deleting customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
module.exports = router;