const { getFirestoreApp } = require('./firebase');
const {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  orderBy,
  getDoc,
  writeBatch,
} = require('firebase/firestore');
const smsService = require('./sms');

class SMSProcessor {
  constructor() {
    this.db = getFirestoreApp();
  }

  // --- Parse M-Pesa SMS message
  parseMpesaSMS(smsMessage) {
    try {
      console.log('Parsing SMS message:', smsMessage);
      if (!smsMessage || typeof smsMessage !== 'string') {
        throw new Error('No SMS message provided or invalid format');
      }

      const patterns = {
        payment: {
          transactionId: /^([A-Z0-9]+)\s+Confirmed/,
          amount: /Ksh([\d,]+\.?\d*)\s+received/,
          accountNumber: /Account Number\s+(\d+)/,
          phoneNumber: /(\d{12})/,
          datetime: /on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s+(?:AM|PM))/,
          senderName: /received from\s+([A-Z\s]+)\s+\d{12}/,
          newBalance: /New Utility balance is\s+Ksh([\d,]+\.?\d*)/,
        },
      };

      const pattern = patterns.payment;

      const transactionIdMatch = smsMessage.match(pattern.transactionId);
      const amountMatch = smsMessage.match(pattern.amount);
      const accountMatch = smsMessage.match(pattern.accountNumber);
      const phoneMatch = smsMessage.match(pattern.phoneNumber);
      const dateTimeMatch = smsMessage.match(pattern.datetime);
      const senderMatch = smsMessage.match(pattern.senderName);
      const balanceMatch = smsMessage.match(pattern.newBalance);

      if (!transactionIdMatch || !amountMatch || !accountMatch) {
        throw new Error('Message does not match payment format');
      }

      let transactionDate = null;
      if (dateTimeMatch) {
        const [_, date, time] = dateTimeMatch;
        const [day, month, year] = date.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        transactionDate = new Date(
          `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}`,
        );
      }

      const parsedData = {
        messageType: 'payment',
        transactionId: transactionIdMatch ? transactionIdMatch[1] : null,
        amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
        accountNumber: accountMatch ? accountMatch[1] : null,
        phoneNumber: phoneMatch ? phoneMatch[1] : null,
        transactionDate,
        senderName: senderMatch ? senderMatch[1].trim() : null,
        newBalance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : null,
        originalMessage: smsMessage,
      };

      console.log('Parsed payment SMS data:', parsedData);

      if (!parsedData.amount || !parsedData.accountNumber) {
        throw new Error('Missing required fields: amount or account number');
      }

      return { success: true, data: parsedData };
    } catch (error) {
      console.error('Error parsing SMS message:', error);
      return { success: false, error: error.message, originalMessage: smsMessage };
    }
  }

  // --- Parse webhook wrapper
  parseMpesaWebhook(webhookData) {
    try {
      console.log('Received webhook data:', webhookData);
      const rawMessage = webhookData?.from && webhookData?.body ? webhookData.body : null;
      if (!rawMessage || typeof rawMessage !== 'string') {
        throw new Error('No SMS message provided in request body or invalid format');
      }
      const smsMessage = rawMessage.replace(/^From\s*:\s*MPESA\(\)\n?/, '').trim();
      return this.parseMpesaSMS(smsMessage);
    } catch (error) {
      console.error('Error parsing webhook SMS message:', error);
      return { success: false, error: error.message, originalMessage: webhookData?.body || null };
    }
  }

  // --- Entry point: decide debtCode vs phone
  async processSMSPayment(smsData) {
    try {
      console.log('Processing SMS payment:', smsData);

      const isPhoneNumber = (accountNumber) =>
        /^0\d{9}$/.test(accountNumber) || /^254\d{9}$/.test(accountNumber);

      if (isPhoneNumber(smsData.accountNumber)) {
        return this.processPaymentByPhoneNumber(smsData);
      } else {
        return this.processPaymentByDebtCode(smsData);
      }
    } catch (error) {
      console.error('Error processing SMS payment:', error);
      await this.logPayment({
        debtId: null,
        amount: smsData.amount,
        paymentMethod: 'mpesa_paybill',
        reference: smsData.transactionId || `SMS_${Date.now()}`,
        phoneNumber: smsData.phoneNumber,
        accountNumber: smsData.accountNumber,
        success: false,
        error: error.message,
        smsData,
        createdAt: new Date(),
      });
      return { success: false, error: error.message };
    }
  }

// Fix for processPaymentByDebtCode function
async processPaymentByDebtCode(smsData) {
  try {
    console.log('Processing payment by debtCode:', smsData);
    const { accountNumber, amount, phoneNumber, transactionDate, transactionId, senderName } =
      smsData;

    const debtsRef = collection(this.db, 'debts');
    const debtQuery = query(debtsRef, where('debtCode', '==', accountNumber), limit(1));
    const debtSnapshot = await getDocs(debtQuery);

    if (debtSnapshot.empty) {
      console.error('No debt found for debtCode:', accountNumber);
      await this.logUnmatchedTransaction(smsData, 'No matching debt found');
      return { success: false, error: 'No debt found for this debtCode', accountNumber };
    }

    const debtDoc = debtSnapshot.docs[0];
    const debt = { id: debtDoc.id, ...debtDoc.data() };

    const currentPaidAmount = debt.paidAmount || 0;
    const newPaidAmount = currentPaidAmount + amount;
    const newRemainingAmount = Math.max(0, debt.amount - newPaidAmount);
    let newStatus = newRemainingAmount === 0 ? 'paid' : 'partially_paid';

    const updateData = {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status: newStatus,
      lastPaymentDate: transactionDate || new Date(),
      lastUpdatedAt: new Date(),
    };

    const debtRef = doc(this.db, 'debts', debt.id);
    await updateDoc(debtRef, updateData);

    await this.logPayment({
      debtId: debt.id,
      debtCode: debt.debtCode,
      amount,
      paymentMethod: 'mpesa_paybill',
      reference: transactionId || `SMS_${Date.now()}`,
      phoneNumber,
      accountNumber,
      senderName,
      transactionDate: transactionDate || new Date(),
      success: true,
      transactionId,
      smsData,
      createdAt: new Date(),
    });

    // ✅ FIXED: Send SMS confirmation with proper validation
    if (phoneNumber) {
      try {
        // Validate and provide fallback values
        const customerName = debt.storeOwner?.name || debt.store?.name || senderName || 'Customer';
        const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
        const validRemainingAmount = typeof newRemainingAmount === 'number' && !isNaN(newRemainingAmount) ? newRemainingAmount : 0;
        const validDebtCode = debt.debtCode || accountNumber || 'N/A';

        console.log('Sending confirmation with values:', {
          customerName,
          validAmount,
          validDebtCode,
          validRemainingAmount,
          phoneNumber,
          storeOwnerPhone: debt.storeOwner?.phoneNumber
        });

        const confirmationMessage = smsService.generatePaymentConfirmationSMS(
          {
            debtCode: validDebtCode,
            storeOwner: { 
              name: customerName, 
              phoneNumber: debt.storeOwner?.phoneNumber || phoneNumber 
            },
            remainingAmount: validRemainingAmount + validAmount  // Original remaining amount before this payment
          },
          validAmount  // Payment amount as second parameter
        );

        await smsService.sendSMS(phoneNumber, confirmationMessage, debt.userId, 'payment_confirmation');
        console.log('✅ Payment confirmation SMS sent to:', phoneNumber);
      } catch (smsError) {
        console.error('❌ Error sending confirmation SMS:', smsError);
        // Log the actual values that caused the error
        console.error('SMS Error - Debug values:', {
          debt: debt,
          amount: amount,
          newRemainingAmount: newRemainingAmount,
          phoneNumber: phoneNumber
        });
      }
    }

    return {
      success: true,
      message: 'Payment processed successfully',
      debt: {
        id: debt.id,
        debtCode: debt.debtCode,
        originalAmount: debt.amount,
        previousPaidAmount: currentPaidAmount,
        newPaidAmount,
        newRemainingAmount,
        newStatus,
      },
    };
  } catch (error) {
    console.error('Error processing payment by debtCode:', error);
    await this.logPayment({
      debtId: null,
      amount: smsData.amount,
      paymentMethod: 'mpesa_paybill',
      reference: smsData.transactionId || `SMS_${Date.now()}`,
      phoneNumber: smsData.phoneNumber,
      accountNumber: smsData.accountNumber,
      success: false,
      error: error.message,
      smsData,
      createdAt: new Date(),
    });
    return { success: false, error: error.message };
  }
}

// Fix for processPaymentByPhoneNumber function
async processPaymentByPhoneNumber(smsData) {
  try {
    const { accountNumber, amount, phoneNumber, transactionDate, transactionId, senderName } = smsData;

    const normalizedPhone =
      accountNumber.startsWith('0')
        ? '+254' + accountNumber.substring(1)
        : accountNumber.startsWith('254')
        ? '+' + accountNumber
        : accountNumber;

    const customerRef = doc(collection(this.db, 'customers'), normalizedPhone);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      await this.logPayment({
        ...smsData,
        accountNumber,
        phoneNumber,
        amount,
        success: false,
        error: 'Customer not found',
        createdAt: new Date(),
      });
      return { success: false, message: 'Customer not found' };
    }

    const customer = customerSnap.data();
    if (!customer.debtIds || customer.debtIds.length === 0) {
      await this.logPayment({
        ...smsData,
        customerId: customerRef.id,
        success: false,
        error: 'No debts associated with customer',
        createdAt: new Date(),
      });
      return { success: false, message: 'No debts associated with customer' };
    }

    // Query debts using the debtIds array from customer
    const debtPromises = customer.debtIds.map(async (debtCode) => {
      const debtQuery = query(collection(this.db, 'debts'), where('debtCode', '==', debtCode), limit(1));
      const debtSnapshot = await getDocs(debtQuery);
      return debtSnapshot.empty ? null : { id: debtSnapshot.docs[0].id, ...debtSnapshot.docs[0].data() };
    });

    const debtResults = await Promise.all(debtPromises);
    const debtDocs = debtResults.filter(debt => debt !== null);
    let debts = debtDocs.filter((debt) => (debt.remainingAmount ?? debt.amount) > 0);

    if (!debts.length) {
      await this.logPayment({
        ...smsData,
        customerId: customerRef.id,
        success: false,
        error: 'No outstanding debts',
        createdAt: new Date(),
      });
      return { success: false, message: 'No outstanding debts to apply payment' };
    }

    debts.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());

    let remainingPayment = amount;
    const batch = writeBatch(this.db);
    const updatedDebts = [];

    for (let debt of debts) {
      if (remainingPayment <= 0) break;

      const outstanding = debt.remainingAmount ?? debt.amount;
      const paymentApplied = Math.min(outstanding, remainingPayment);

      const newPaidAmount = (debt.paidAmount ?? 0) + paymentApplied;
      const newRemainingAmount = outstanding - paymentApplied;
      const newStatus = newRemainingAmount === 0 ? 'paid' : 'partially_paid';

      batch.update(doc(this.db, 'debts', debt.id), {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        lastPaymentDate: transactionDate || new Date(),
        lastUpdatedAt: new Date(),
      });

      updatedDebts.push({
        debtId: debt.id,
        debtCode: debt.debtCode,
        originalAmount: debt.amount,
        previousPaidAmount: debt.paidAmount ?? 0,
        paymentApplied,
        newPaidAmount,
        newRemainingAmount,
        newStatus,
      });

      remainingPayment -= paymentApplied;
    }

    await batch.commit();

    for (let upd of updatedDebts) {
      await this.logPayment({
        ...smsData,
        customerId: customerRef.id,
        debtId: upd.debtId,
        debtCode: upd.debtCode,
        amount: upd.paymentApplied,
        paymentMethod: 'mpesa_paybill',
        reference: transactionId || `SMS_${Date.now()}`,
        transactionDate: transactionDate || new Date(),
        success: true,
        createdAt: new Date(),
      });
    }

    // ✅ FIXED: Send confirmation SMS with proper validation
    try {
      // Validate and provide fallback values
      const customerName = customer.name || senderName || 'Customer';
      const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
      
      // Calculate total remaining amount safely
      const totalRemainingAmount = updatedDebts
        .filter(d => typeof d.newRemainingAmount === 'number' && !isNaN(d.newRemainingAmount))
        .reduce((sum, d) => sum + d.newRemainingAmount, 0);
      
      const debtCodeDisplay = updatedDebts.length > 1 
        ? 'Multiple Debts' 
        : (updatedDebts[0]?.debtCode || 'N/A');

      console.log('Sending confirmation with values:', {
        customerName,
        validAmount,
        debtCodeDisplay,
        totalRemainingAmount,
        normalizedPhone
      });

      const confirmationMessage = smsService.generatePaymentConfirmationSMS(
        {
          debtCode: debtCodeDisplay,
          storeOwner: { name: customerName, phoneNumber: normalizedPhone },
          remainingAmount: totalRemainingAmount + validAmount  // Original remaining amount before this payment
        },
        validAmount  // Payment amount as second parameter
      );

      await smsService.sendSMS(normalizedPhone, confirmationMessage, customerRef.id, 'payment_confirmation');
      console.log('✅ Payment confirmation SMS sent to:', normalizedPhone);
    } catch (smsError) {
      console.error('❌ Error sending confirmation SMS:', smsError);
      // Log the actual values that caused the error
      console.error('SMS Error - Debug values:', {
        customer: customer,
        amount: amount,
        updatedDebts: updatedDebts,
        normalizedPhone: normalizedPhone
      });
    }

    return {
      success: true,
      message: 'Payment processed successfully',
      customer: { name: customer.name, phoneNumber: normalizedPhone },
      debts: updatedDebts,
      payment: { amount, transactionId, phoneNumber, senderName, appliedToDebts: updatedDebts.length, remainingPayment },
    };
  } catch (error) {
    console.error('Error processing payment by phone number:', error);
    await this.logPayment({
      ...smsData,
      success: false,
      error: error.message,
      createdAt: new Date(),
    });
    return { success: false, error: error.message };
  }
}
  // --- Log payment
  async logPayment(paymentData) {
    try {
      await addDoc(collection(this.db, 'payment_logs'), paymentData);
      console.log('Payment logged successfully');
    } catch (error) {
      console.error('Error logging payment:', error);
    }
  }

  // --- Log unmatched
  async logUnmatchedTransaction(smsData, reason) {
    try {
      await addDoc(collection(this.db, 'unmatched_transactions'), {
        ...smsData,
        reason,
        needsReview: true,
        createdAt: new Date(),
      });
      console.log('Unmatched transaction logged');
    } catch (error) {
      console.error('Error logging unmatched transaction:', error);
    }
  }

  // --- Get payment summary
  async getPaymentSummary(debtId) {
    try {
      const paymentLogsRef = collection(this.db, 'payment_logs');
      const paymentsQuery = query(
        paymentLogsRef,
        where('debtId', '==', debtId),
        where('success', '==', true),
        orderBy('createdAt', 'desc'),
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const payments = paymentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      return {
        success: true,
        summary: { totalPaid, paymentCount: payments.length, payments, lastPayment: payments[0] || null },
      };
    } catch (error) {
      console.error('Error getting payment summary:', error);
      return { success: false, error: error.message };
    }
  }

  // --- Get unmatched transactions
  async getUnmatchedTransactions() {
    try {
      const unmatchedRef = collection(this.db, 'unmatched_transactions');
      const unmatchedQuery = query(
        unmatchedRef,
        where('needsReview', '==', true),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const unmatchedSnapshot = await getDocs(unmatchedQuery);

      const transactions = unmatchedSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return { success: true, transactions };
    } catch (error) {
      console.error('Error getting unmatched transactions:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SMSProcessor();
