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
  return {
          success: true,
          messageId: result.responses[0].messageid,
          data: result.responses[0]
        };
      // Log attempt regardless of outcome
  

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
    
    const { debtCode, paymentMethod, dueDate, remainingAmount } = debt;
    
    // Format phone number: replace +254 with 0
    const formattedPhoneNumber = phoneNumber.replace(/^\+254/, '0');
    
    // Use remaining amount instead of original amount
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(remainingAmount || debt.amount); // Fallback to original amount if remaining not set

    // Format date in shorter format
    console.log(`   - Due Date: ${dueDate}`);
    const formattedDate = new Date(dueDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });

    // Create payment instructions using formatted phone number
    const paymentInfo = paymentMethod === 'mpesa' 
      ? `Paybill ${process.env.SAMWEGA_PAYBILL}, Acc ${formattedPhoneNumber}`
      : `Ref: ${formattedPhoneNumber}`;

    // Construct message with remaining amount
    const message = `Dear ${debt.storeOwner.name}, Outstanding Ksh${formattedAmount}. ${paymentInfo}. Pay by ${formattedDate} for inquiries call 0113689071.`;

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
   
    const smsMessage = `Dear ${debt.storeOwner.name}, Payment of ${paymentAmount} received for debt #${debtCode}. balance ${debt.remainingAmount - paymentAmount} for inquiries call 0113689071 Thank you.`;

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

  // Method to check message status (not supported by textsms API based on provided info)
  async getMessageStatus(messageId) {
    console.warn('⚠️ Message status checking not supported by TextSMS API');
    return {
      success: false,
      error: 'Message status checking not supported by TextSMS API'
    };
  }
}

module.exports = new SMSService();