require('dotenv').config();
const SMSService = require('../services/sms');

async function testInfobipSMS() {
  try {
    const phoneNumber = '254743466032'; // Replace with test number
    console.log('🧪 Testing SMS service with Infobip...');
    const result = await SMSService.sendTestSMS(phoneNumber);
    console.log('📝 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testInfobipSMS();