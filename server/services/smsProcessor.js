
const { getFirestoreApp } = require('./firebase');
const { collection, query, where, limit, getDocs, doc, updateDoc, addDoc, orderBy, getDoc, setDoc } = require('firebase/firestore');
const smsService = require('./sms');

class SMSProcessor {
  constructor() {
    this.db = getFirestoreApp();
  }

  // Parse M-Pesa SMS message to extract payment details
  parseMpesaSMS(smsMessage) {
    try {
      console.log('Parsing SMS message:', smsMessage);

      // Handle empty or invalid message
      if (!smsMessage || typeof smsMessage !== 'string') {
        throw new Error('No SMS message provided or invalid format');
      }

      // Patterns for payment type
      const patterns = {
        payment: {
          transactionId: /^([A-Z0-9]+)\s+Confirmed/,
          amount: /Ksh([\d,]+\.?\d*)\s+received/,
          accountNumber: /Account Number\s+(\d+)/,
          phoneNumber: /(\d{12})/,
          datetime: /on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s+(?:AM|PM))/,
          senderName: /received from\s+([A-Z\s]+)\s+\d{12}/,
          newBalance: /New Utility balance is\s+Ksh([\d,]+\.?\d*)/
        }
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
        transactionDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}`);
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
        originalMessage: smsMessage
      };

      console.log('Parsed payment SMS data:', parsedData);

      // Validate required fields
      if (!parsedData.amount || !parsedData.accountNumber) {
        throw new Error('Missing required fields: amount or account number');
      }

      return {
        success: true,
        data: parsedData
      };

    } catch (error) {
      console.error('Error parsing SMS message:', error);
      return {
        success: false,
        error: error.message,
        originalMessage: smsMessage
      };
    }
  }

  // Parse M-Pesa webhook data to extract payment details
  parseMpesaWebhook(webhookData) {
    try {
      console.log('Received webhook data:', webhookData);

      // Extract message body from webhook object
      const rawMessage = webhookData?.from && webhookData?.body ? webhookData.body : null;

      // Check if rawMessage exists
      if (!rawMessage || typeof rawMessage !== 'string') {
        throw new Error('No SMS message provided in request body or invalid format');
      }

      // Clean the message (remove leading/trailing whitespace and any specific prefixes)
      const smsMessage = rawMessage.replace(/^From\s*:\s*MPESA\(\)\n?/, '').trim();

      // Use the existing parseMpesaSMS logic for consistency
      return this.parseMpesaSMS(smsMessage);

    } catch (error) {
      console.error('Error parsing webhook SMS message:', error);
      return {
        success: false,
        error: error.message,
        originalMessage: webhookData?.body || null
      };
    }
  }

  // Process SMS payment and update debt record
  async processSMSPayment(smsData) {
    try {
      console.log('Processing SMS payment:', smsData);

      const { accountNumber, amount, phoneNumber, transactionDate, transactionId, senderName } = smsData;

      // Check if transaction already processed
      if (transactionId) {
        const transactionRef = doc(this.db, 'processedTransactions', transactionId);
        const transactionSnap = await getDoc(transactionRef);

        if (transactionSnap.exists()) {
          console.log('Transaction already processed:', transactionId);
          return {
            success: false,
            error: 'Transaction already processed'
          };
        }
      } else {
        console.warn('No transaction ID found, skipping duplicate check');
      }

      // Check if we're in demo mode
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 Demo mode: Simulating payment processing');
        
        // Simulate successful payment processing
        const mockDebt = {
          id: 'demo-debt-' + Date.now(),
          debtCode: accountNumber,
          amount: 1000,
          paidAmount: 0,
          status: 'pending'
        };

        const newPaidAmount = mockDebt.paidAmount + amount;
        const newRemainingAmount = Math.max(0, mockDebt.amount - newPaidAmount);
        const newStatus = newRemainingAmount === 0 ? 'paid' : 'partially_paid';

        // Log the payment
        await this.logPayment({
          debtId: mockDebt.id,
          debtCode: mockDebt.debtCode,
          amount: amount,
          paymentMethod: 'mpesa_paybill',
          reference: transactionId || `SMS_${Date.now()}`,
          phoneNumber: phoneNumber,
          accountNumber: accountNumber,
          senderName: senderName,
          transactionDate: transactionDate || new Date(),
          success: true,
          transactionId: transactionId,
          smsData: smsData,
          createdAt: new Date()
        });

        return {
          success: true,
          message: 'Payment processed successfully (Demo Mode)',
          debt: {
            id: mockDebt.id,
            debtCode: mockDebt.debtCode,
            originalAmount: mockDebt.amount,
            previousPaidAmount: mockDebt.paidAmount,
            newPaidAmount: newPaidAmount,
            newRemainingAmount: newRemainingAmount,
            newStatus: newStatus
          },
          payment: {
            amount: amount,
            transactionId: transactionId,
            phoneNumber: phoneNumber,
            senderName: senderName
          }
        };
      }

      // Find debt by account number (debtCode)
      const debtsRef = collection(this.db, 'debts');
      const debtQuery = query(debtsRef, where('debtCode', '==', accountNumber), limit(1));
      const debtSnapshot = await getDocs(debtQuery);

      if (debtSnapshot.empty) {
        console.error('No debt found for account number:', accountNumber);
        
        // Log unmatched transaction
        await this.logUnmatchedTransaction(smsData, 'No matching debt found');
        
        return {
          success: false,
          error: 'No debt found for this account number',
          accountNumber
        };
      }

      const debtDoc = debtSnapshot.docs[0];
      const debt = { id: debtDoc.id, ...debtDoc.data() };

      console.log('Found debt:', { id: debt.id, debtCode: debt.debtCode, amount: debt.amount, paidAmount: debt.paidAmount });

      // Calculate new payment amounts
      const currentPaidAmount = debt.paidAmount || 0;
      const newPaidAmount = currentPaidAmount + amount;
      const newRemainingAmount = Math.max(0, debt.amount - newPaidAmount);
      
      // Determine new status
      let newStatus = debt.status;
      if (newRemainingAmount === 0) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }

      // Update debt record
      const updateData = {
        paidAmount: newPaidAmount,
        paidPaymentMethod: 'mpesa_paybill',
        remainingAmount: newRemainingAmount,
        status: newStatus,
        lastPaymentDate: transactionDate || new Date(),
        lastUpdatedAt: new Date()
      };

      const debtRef = doc(this.db, 'debts', debt.id);
      await updateDoc(debtRef, updateData);

      console.log('Updated debt:', { 
        id: debt.id, 
        newPaidAmount, 
        newRemainingAmount, 
        newStatus 
      });

      // Log the payment
      const paymentLog = {
        debtId: debt.id,
        debtCode: debt.debtCode,
        amount: amount,
        paymentMethod: 'mpesa_paybill',
        reference: transactionId || `SMS_${Date.now()}`,
        phoneNumber: phoneNumber,
        accountNumber: accountNumber,
        senderName: senderName,
        transactionDate: transactionDate || new Date(),
        success: true,
        transactionId: transactionId,
        smsData: smsData,
        createdAt: new Date()
      };

      await this.logPayment(paymentLog);

      // After successful payment processing and debt update
      if (debt.storeOwner?.phoneNumber) {
        try {
          // Generate and send confirmation SMS
          const confirmationMessage = smsService.generatePaymentConfirmationSMS(
            debt,
            amount
          );

          await smsService.sendSMS(
            debt.storeOwner.phoneNumber,
            confirmationMessage,
            debt.userId,
            debt.id
          );

          console.log('✅ Payment confirmation SMS sent to:', debt.storeOwner.phoneNumber);
        } catch (smsError) {
          console.error('❌ Error sending confirmation SMS:', smsError);
          // Don't throw error - payment was still successful
        }
      }

      // Add to processed transactions if transactionId exists
      if (transactionId) {
        const transactionRef = doc(this.db, 'processedTransactions', transactionId);
        await setDoc(transactionRef, {
          transactionId: transactionId,
          processedAt: new Date(),
          debtId: debt.id,
          amount: amount,
          smsData: smsData
        });
        console.log('Transaction marked as processed in Firestore:', transactionId);
      }

      return {
        success: true,
        message: 'Payment processed successfully',
        debt: {
          id: debt.id,
          debtCode: debt.debtCode,
          originalAmount: debt.amount,
          previousPaidAmount: currentPaidAmount,
          newPaidAmount: newPaidAmount,
          newRemainingAmount: newRemainingAmount,
          newStatus: newStatus
        },
        payment: {
          amount: amount,
          transactionId: transactionId,
          phoneNumber: phoneNumber,
          senderName: senderName
        },
        confirmationSent: true
      };

    } catch (error) {
      console.error('Error processing SMS payment:', error);
      
      // Log the error
      await this.logPayment({
        debtId: null,
        amount: smsData.amount,
        paymentMethod: 'mpesa_paybill',
        reference: smsData.transactionId || `SMS_${Date.now()}`,
        phoneNumber: smsData.phoneNumber,
        accountNumber: smsData.accountNumber,
        success: false,
        error: error.message,
        smsData: smsData,
        createdAt: new Date()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Log payment to Firestore
  async logPayment(paymentData) {
    try {
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 Demo mode: Payment logged (simulated)');
        return;
      }
      
      const paymentLogsRef = collection(this.db, 'payment_logs');
      await addDoc(paymentLogsRef, paymentData);
      console.log('Payment logged successfully');
    } catch (error) {
      console.error('Error logging payment:', error);
    }
  }

  // Log unmatched transactions
  async logUnmatchedTransaction(smsData, reason) {
    try {
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 Demo mode: Unmatched transaction logged (simulated)');
        return;
      }
      
      const unmatchedRef = collection(this.db, 'unmatched_transactions');
      await addDoc(unmatchedRef, {
        ...smsData,
        reason: reason,
        needsReview: true,
        createdAt: new Date()
      });
      console.log('Unmatched transaction logged');
    } catch (error) {
      console.error('Error logging unmatched transaction:', error);
    }
  }

  // Get payment summary for a debt
  async getPaymentSummary(debtId) {
    try {
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 Demo mode: Returning mock payment summary');
        return {
          success: true,
          summary: {
            totalPaid: 500,
            paymentCount: 1,
            payments: [{
              id: 'demo-payment-1',
              amount: 500,
              createdAt: new Date(),
              success: true
            }],
            lastPayment: {
              id: 'demo-payment-1',
              amount: 500,
              createdAt: new Date(),
              success: true
            }
          }
        };
      }
      
      const paymentLogsRef = collection(this.db, 'payment_logs');
      const paymentsQuery = query(
        paymentLogsRef,
        where('debtId', '==', debtId),
        where('success', '==', true),
        orderBy('createdAt', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const payments = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const paymentCount = payments.length;

      return {
        success: true,
        summary: {
          totalPaid,
          paymentCount,
          payments: payments,
          lastPayment: payments[0] || null
        }
      };
    } catch (error) {
      console.error('Error getting payment summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get unmatched transactions
  async getUnmatchedTransactions() {
    try {
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 Demo mode: Returning mock unmatched transactions');
        return {
          success: true,
          transactions: [{
            id: 'demo-unmatched-1',
            accountNumber: '99999',
            amount: 500,
            phoneNumber: '254722123456',
            reason: 'No matching debt found',
            needsReview: true,
            createdAt: new Date()
          }]
        };
      }
      
      const unmatchedRef = collection(this.db, 'unmatched_transactions');
      const unmatchedQuery = query(
        unmatchedRef,
        where('needsReview', '==', true),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const unmatchedSnapshot = await getDocs(unmatchedQuery);

      const transactions = unmatchedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        transactions: transactions
      };
    } catch (error) {
      console.error('Error getting unmatched transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SMSProcessor();
