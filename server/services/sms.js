const axios = require('axios');
const { getFirestore } = require('./firebase');

class SMSService {
  constructor() {
    this.apiKey = '5be7918feb2ede397a2094fe7262d085-9b8182d4-73f7-40af-98c9-75cd182c0416';
    this.baseURL = process.env.INFOBIP_BASE_URL || 'https://api.infobip.com';
    this.from = process.env.INFOBIP_SENDER_ID || 'SAMWEGA';
    
    if (!this.apiKey) {
      console.warn('⚠️ Infobip SMS credentials not configured');
    }
  }

  async sendSMS(to, message, userId, debtId) {
    try {
      // Prepare the request payload for Infobip
      const payload = {
        messages: [
          {
            from: this.from,
            destinations: [
              {
                to: to.startsWith('+') ? to.substring(1) : to // Remove + if present
              }
            ],
            text: message
          }
        ]
      };

      const response = await axios.post(
        `${this.baseURL}/sms/2/text/advanced`,
        payload,
        {
          headers: {
            'Authorization': `App ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const result = response.data;
      const messageStatus = result.messages?.[0]?.status;
      const success = messageStatus?.groupId === 1; // Group 1 = PENDING/ACCEPTED

      // Log SMS to Firestore
      await this.logSMS({
        userId,
        debtId,
        to,
        message,
        success,
        response: result,
        timestamp: new Date()
      });

      if (success) {
        console.log(`✅ SMS sent successfully to ${to}`);
        return { 
          success: true, 
          messageId: result.messages[0]?.messageId,
          data: result
        };
      } else {
        const errorMessage = messageStatus?.description || 'Unknown SMS error';
        console.error(`❌ SMS failed to ${to}:`, errorMessage);
        return { 
          success: false, 
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('SMS Service Error:', error.response?.data || error.message);
      
      // Log failed SMS attempt
      await this.logSMS({
        userId,
        debtId,
        to,
        message,
        success: false,
        error: error.message,
        timestamp: new Date()
      });

      return { 
        success: false, 
        error: error.response?.data?.requestError?.serviceException?.text || error.message 
      };
    }
  }

  generateInvoiceSMS(debt) {
    const { storeOwner, store, amount, paymentMethod, debtCode, dueDate } = debt;
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);

    let paymentInstructions = '';
    
    switch (paymentMethod) {
      case 'mpesa':
        paymentInstructions = `M-Pesa: Paybill ${process.env.SAMWEGA_PAYBILL}, Account ${debtCode}`;
        break;
      case 'bank':
        paymentInstructions = `Bank Deposit: Use ref ${debtCode} (Equity/KCB)`;
        break;
      case 'cheque':
        paymentInstructions = `Cheque: Payable to Samwega Works Ltd, ref ${debtCode}`;
        break;
      default:
        paymentInstructions = `Payment ref: ${debtCode}`;
    }

    return `Samwega Works Ltd Invoice: Pay ${formattedAmount} for debt #${debtCode}. ${paymentInstructions}. Due: ${new Date(dueDate).toLocaleDateString('en-GB')}. Thank you!`;
  }

  generatePaymentConfirmationSMS(debt, paymentAmount) {
    const { debtCode } = debt;
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(paymentAmount);

    return `Payment of ${formattedAmount} received for debt #${debtCode}. Thank you for your payment! - Samwega Works Ltd`;
  }

  async logSMS(smsData) {
    try {
      const db = getFirestore();
      await db.collection('sms_logs').add({
        ...smsData,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
  }

  // Method for testing SMS functionality
  async sendTestSMS(phoneNumber) {
    const testMessage = "Test message from Samwega Works Ltd. debt management system. If you receive this, SMS is working correctly.";
    return this.sendSMS(phoneNumber, testMessage, 'test-user', 'test-debt');
  }
}

module.exports = new SMSService();
