const axios = require('axios');
const { getFirestoreApp } = require('./firebase');
const { collection, addDoc } = require('firebase/firestore');

class SMSService {
  constructor() {
    console.log('🚀 Initializing SMS Service...');
    this.db = getFirestoreApp();
    
    // TextSMS Configuration
    this.config = {
      apiKey: process.env.TEXTSMS_API_KEY,
      partnerID: process.env.TEXTSMS_PARTNER_ID,
      shortcode: process.env.TEXTSMS_SENDER_ID,
      apiUrl: 'https://sms.textsms.co.ke/api/services/sendsms/'
    };
    
    console.log('📋 SMS Service Configuration:');
    console.log(`   - API Key: ${this.config.apiKey ? '***CONFIGURED***' : 'NOT SET'}`);
    console.log(`   - Partner ID: ${this.config.partnerID || 'NOT SET'}`);
    console.log(`   - Sender ID: ${this.config.shortcode}`);
    
    if (!this.config.apiKey || !this.config.partnerID) {
      console.warn('⚠️ TextSMS credentials not configured');
    }
  }

  async sendSMS(to, message, userId, debtId) {
    console.log('📤 Attempting to send SMS...');
    console.log(`   - To: ${to}`);
    console.log(`   - Message Length: ${message.length}`);
    console.log(`   - Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

    try {
      // Format phone number (ensure it starts with '254' for Kenyan numbers)
      const formattedPhone = to.startsWith('+254') ? to.replace('+254', '254') : 
                           to.startsWith('0') ? '254' + to.substring(1) : to;
      
      // Format message (remove any special characters that might cause issues, ensure GSM7 compatibility)
      const formattedMessage = encodeURIComponent(message.trim());

      // Check message length
      if (message.length > 160) {
        console.warn('⚠️ Message length exceeds 160 characters, it may be split');
      }

      const response = await axios.post(this.config.apiUrl, {
        apikey: this.config.apiKey,
        partnerID: this.config.partnerID,
        message: formattedMessage,
        shortcode: this.config.shortcode,
        mobile: formattedPhone
      });

      const result = response.data;
      console.log('📋 TextSMS Response:', result);
      
      if (result.responses && result.responses[0]) {
        return {
          success: true,
          messageId: result.responses[0].messageid,
          data: result.responses[0]
        };
      }
      
      return { success: true, data: result };

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

  generateInvoiceSMS(debt, phoneNumber) {
    console.log('📝 Generating invoice SMS...');
    console.log(`   - Debt Code: ${debt.debtCode}`);
    console.log(`   - Original Amount: ${debt.amount}`);
    console.log(`   - Remaining Amount: ${debt.remainingAmount}`);
    console.log(`   - Store Owner Name: ${debt.storeOwner.name}`);
    console.log(`   - Store Owner Phone Number: ${phoneNumber}`);
    
    const { remainingAmount } = debt;
    
    // Format phone number: replace +254 with 0 (used as M-Pesa account number)
    const formattedPhoneNumber = phoneNumber.replace(/^\+254/, '0');
    
    // Use remaining amount, fallback to original amount
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(remainingAmount || debt.amount);

    // Payment instructions: always use Samwega paybill, account = customer phone number
    const paybill = process.env.SAMWEGA_PAYBILL;
    const paymentInfo = `Paybill ${paybill}, Acc ${formattedPhoneNumber}`;

    // Construct message — no due date included
    const message = `Dear ${debt.storeOwner.name}, you have an outstanding balance of Ksh${formattedAmount}. Ref: ${debt.debtCode}. Pay via M-Pesa ${paymentInfo}. For inquiries call 0113689071.`;

    console.log('✅ Invoice SMS generated successfully');
    console.log(`   - Message length: ${message.length} characters`);
    console.log(`   - Message: ${message}`);

    return message;
  }

  generatePaymentConfirmationSMS(debt, paymentAmount) {
    console.log('💰 Generating payment confirmation SMS...');
    console.log(`   - Debt Code: ${debt.debtCode}`);
    console.log(`   - Payment Amount: ${paymentAmount}`);

    const { debtCode } = debt;
   
    const smsMessage = `Dear ${debt.storeOwner.name}, Payment of ${paymentAmount} received for debt #${debtCode}. balance ${debt.remainingAmount - paymentAmount} for inquiries call 0113689071 Thank you.`;

    console.log('✅ Payment confirmation SMS generated successfully');
    console.log(`   - Message length: ${smsMessage.length} characters`);
    console.log(`   - Message: ${smsMessage}`);

    return smsMessage;
  }

  async logSMS(smsData) {
    console.log('💾 Logging SMS to Firestore...');
    try {
      const smsLogsRef = collection(this.db, 'sms_logs');
      await addDoc(smsLogsRef, {
        ...smsData,
        createdAt: new Date()
      });
      console.log('✅ SMS Log created successfully');
    } catch (error) {
      console.error('❌ Error logging SMS to Firestore:', error.message);
    }
  }

  async sendTestSMS(phoneNumber) {
    console.log('🧪 Sending test SMS...');
    const testMessage = "Test message from Samwega Works Ltd debt management system. If you receive this, SMS is working correctly.";
    const result = await this.sendSMS(phoneNumber, testMessage, 'test-user', 'test-debt');
    return result;
  }

  async getMessageStatus(messageId) {
    return {
      success: false,
      error: 'Message status checking not supported by TextSMS API'
    };
  }
}

module.exports = new SMSService();
