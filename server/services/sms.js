const axios = require('axios');
const { getFirestoreApp } = require('./firebase');
const { collection, addDoc } = require('firebase/firestore');

class SMSService {
  constructor() {
    console.log('🚀 Initializing SMS Service...');
    this.db = getFirestoreApp();
    
    // UMSComms Configuration
    this.config = {
      apiKey: process.env.UMSCOMMS_API_KEY,
      appId: process.env.UMSCOMMS_APP_ID,
      senderId: process.env.UMSCOMMS_SENDER_ID || 'UMS_SMS',
      apiUrl: process.env.UMSCOMMS_API_URL || 'https://comms.umeskiasoftwares.com'
    };
    
    console.log('📋 SMS Service Configuration:');
    console.log(`   - API Key: ${this.config.apiKey ? '***CONFIGURED***' : 'NOT SET'}`);
    console.log(`   - App ID: ${this.config.appId || 'NOT SET'}`);
    console.log(`   - Sender ID: ${this.config.senderId}`);
    
    if (!this.config.apiKey || !this.config.appId) {
      console.warn('⚠️ UMSComms credentials not configured');
    }
  }

  async sendSMS(to, message, userId, debtId) {
    console.log('📤 Attempting to send SMS...');
    console.log(`   - To: ${to}`);
    console.log(`   - Message Length: ${message.length}`);
    console.log(`   - Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

    try {
      // Format phone number (ensure no + prefix for UMSComms)
      const formattedPhone = to.startsWith('+') ? to.substring(1) : to;
      
      // Format message (remove any special characters that might cause issues)
      const formattedMessage = message
        .replace(/[^\w\s.,:#@\-+]/g, '') // Remove special characters except common ones
        .trim();

      // Check message length
      if (formattedMessage.length > 160) {
        console.warn('⚠️ Message length exceeds 160 characters, it may be split');
      }

      const response = await axios.post(`${this.config.apiUrl}/api/v1/sms/send`, {
        api_key: this.config.apiKey,
        app_id: this.config.appId,
        sender_id: this.config.senderId,
        message: formattedMessage,
        phone: formattedPhone
      });

      const result = response.data;
      console.log('📋 UMSComms Response:', result);

      // Log attempt regardless of outcome
      await this.logSMS({
        userId,
        debtId,
        to: formattedPhone,
        message: formattedMessage,
        originalMessage: message,
        messageLength: formattedMessage.length,
        success: result.status === 'complete',
        provider: 'umscomms',
        response: result,
        timestamp: new Date()
      });

      if (result.status === 'complete') {
        return {
          success: true,
          messageId: result.data?.[0]?.message_id,
          data: result.data?.[0]
        };
      } else {
        throw new Error(result.message || 'SMS sending failed');
      }

    } catch (error) {
      console.error('❌ SMS Service Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      await this.logSMS({
        userId,
        debtId,
        to,
        message,
        success: false,
        error: error.message,
        errorDetails: {
          status: error.response?.status,
          data: error.response?.data
        },
        timestamp: new Date()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  generateInvoiceSMS(debt) {
    console.log('📝 Generating invoice SMS...');
    console.log(`   - Debt Code: ${debt.debtCode}`);
    console.log(`   - Original Amount: ${debt.amount}`);
    console.log(`   - Remaining Amount: ${debt.remainingAmount}`);

    const { debtCode, paymentMethod, dueDate, remainingAmount } = debt;
    
    // Use remaining amount instead of original amount
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(remainingAmount || debt.amount); // Fallback to original amount if remaining not set

    // Format date in shorter format
    console.log(`   - Due Date: ${dueDate}`);
    const formattedDate = new Date(dueDate.seconds).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });

    // Create payment instructions
    const paymentInfo = paymentMethod === 'mpesa' 
      ? `Paybill ${process.env.SAMWEGA_PAYBILL}, Acc ${debtCode}`
      : `Ref: ${debtCode}`;

    // Construct message with remaining amount
    const message = `Samwega: Outstanding Ksh${formattedAmount} for #${debtCode}. ${paymentInfo}. Due by ${formattedDate}.`;

    console.log('✅ Invoice SMS generated successfully');
    console.log(`   - Message length: ${message.length} characters`);
    console.log(`   - Message preview: ${message.substring(0, 100)}...`);

    return message;
  }

  generatePaymentConfirmationSMS(debt, paymentAmount) {
    console.log('💰 Generating payment confirmation SMS...');
    console.log(`   - Debt Code: ${debt.debtCode}`);
    console.log(`   - Payment Amount: ${paymentAmount}`);

    const { debtCode } = debt;
   

    const smsMessage = `Samwega: Payment of ${paymentAmount} received for debt #${debtCode}. balance ${debt.remainingAmount - paymentAmount} Thank you.`;

    console.log('✅ Payment confirmation SMS generated successfully');
    console.log(`   - Message length: ${smsMessage.length} characters`);
    console.log(`   - Message: ${smsMessage}`);

    return smsMessage;
  }

  async logSMS(smsData) {
    console.log('💾 Logging SMS to Firestore...');
    console.log(`   - User ID: ${smsData.userId}`);
    console.log(`   - Debt ID: ${smsData.debtId}`);
    console.log(`   - To: ${smsData.to}`);
    console.log(`   - Success: ${smsData.success}`);

    try {
      const smsLogsRef = collection(this.db, 'sms_logs');
      const startTime = Date.now();
      
      const docRef = await addDoc(smsLogsRef, {
        ...smsData,
        createdAt: new Date()
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ SMS Log created successfully in ${duration}ms`);
      console.log(`   - Document ID: ${docRef.id}`);
    } catch (error) {
      console.error('❌ Error logging SMS to Firestore:', error.message);
      console.error('❌ Full error details:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
    }
  }

  // Method for testing SMS functionality
  async sendTestSMS(phoneNumber) {
    console.log('🧪 Sending test SMS...');
    console.log(`   - Phone number: ${phoneNumber}`);

    const testMessage = "Test message from Samwega Works Ltd debt management system. If you receive this, SMS is working correctly.";
    console.log(`   - Test message: ${testMessage}`);

    const result = await this.sendSMS(phoneNumber, testMessage, 'test-user', 'test-debt');
    
    console.log('🧪 Test SMS result:');
    console.log(`   - Success: ${result.success}`);
    console.log(`   - Message ID: ${result.messageId || 'N/A'}`);
    console.log(`   - Error: ${result.error || 'N/A'}`);

    return result;
  }

  // Method to check message status (useful for delivery confirmation)
  async getMessageStatus(messageId) {
    console.log('📊 Checking message status...');
    console.log(`   - Message ID: ${messageId}`);

    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const startTime = Date.now();
      const message = await this.client.messages(messageId).fetch();
      const duration = Date.now() - startTime;

      console.log(`✅ Message status retrieved in ${duration}ms`);
      console.log('📋 Message Status Details:');
      console.log(`   - Status: ${message.status}`);
      console.log(`   - Error Code: ${message.errorCode || 'None'}`);
      console.log(`   - Error Message: ${message.errorMessage || 'None'}`);
      console.log(`   - Date Created: ${message.dateCreated}`);
      console.log(`   - Date Sent: ${message.dateSent || 'N/A'}`);
      console.log(`   - Date Updated: ${message.dateUpdated || 'N/A'}`);

      return {
        success: true,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      console.error('❌ Error fetching message status:', error.message);
      console.error('❌ Full error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SMSService();