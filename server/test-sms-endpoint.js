const axios = require('axios');

// Configuration - Update these for production
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_TOKEN = process.env.API_TOKEN || 'your-api-token-here';

// Production SMS forwarding endpoint
const SMS_ENDPOINT = `${API_BASE_URL}/api/sms/mpesa`;

// Sample M-Pesa SMS messages for testing
const sampleSMSMessages = [
  {
    name: 'Standard M-Pesa Payment',
    message: 'GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 12345 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00'
  },
  {
    name: 'M-Pesa SMS with larger amount',
    message: 'XY99ZW789 Confirmed. You have received Ksh25,000.00 from MIKE BROWN 254711234567 for account 805265 via Paybill 570425 on 2024-07-26 at 9:45 AM. New M-PESA balance is Ksh50,000.00'
  },
  {
    name: 'M-Pesa SMS with different format',
    message: 'AB12CD345 Confirmed. Ksh1,500.00 received from JANE SMITH 254733456789 for account 67890 via Paybill 570425 on 2024-07-26 at 2:15 PM. New M-PESA balance is Ksh25,000.00'
  }
];

// Test the SMS forwarding endpoint (simulates what your mobile app will send)
async function testSMSForwarding() {
  console.log('📱 Testing SMS Forwarding Endpoint (Production Ready)\n');
  console.log(`📍 Endpoint: ${SMS_ENDPOINT}\n`);
  
  for (const sms of sampleSMSMessages) {
    try {
      console.log(`📱 Testing: ${sms.name}`);
      console.log(`Message: ${sms.message}\n`);
      
      // Simulate the exact payload your SMS forwarding app will send
      const payload = {
        message: sms.message,
        timestamp: new Date().toISOString(),
        source: 'sms-forwarder-app'
      };
      
      const response = await axios.post(SMS_ENDPOINT, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SMS-Forwarder-App/1.0'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        console.log('✅ SMS processed successfully:');
        console.log(`   Status: ${response.data.message}`);
        
        if (response.data.data && response.data.data.debt) {
          const debt = response.data.data.debt;
          console.log(`   Debt Found: ${debt.debtCode}`);
          console.log(`   New Status: ${debt.newStatus}`);
          console.log(`   Paid Amount: Ksh${debt.newPaidAmount}`);
          console.log(`   Remaining: Ksh${debt.newRemainingAmount}`);
        }
        
        if (response.data.data && response.data.data.payment) {
          const payment = response.data.data.payment;
          console.log(`   Payment Amount: Ksh${payment.amount}`);
          console.log(`   Transaction ID: ${payment.transactionId}`);
          console.log(`   Sender: ${payment.senderName} (${payment.phoneNumber})`);
        }
        
        console.log('');
      } else {
        console.log('❌ SMS processing failed:');
        console.log(`   Error: ${response.data.error}`);
        if (response.data.accountNumber) {
          console.log(`   Account Number: ${response.data.accountNumber}`);
        }
        console.log('');
      }
    } catch (error) {
      console.log('❌ Network/Server Error:');
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.error || 'Unknown error'}`);
      } else if (error.request) {
        console.log(`   Error: No response received (${error.message})`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
      console.log('');
    }
  }
}

// Test the SMS parsing endpoint
async function testSMSParsing() {
  console.log('🧪 Testing SMS Parsing Endpoint\n');
  
  for (const sms of sampleSMSMessages) {
    try {
      console.log(`📱 Testing: ${sms.name}`);
      console.log(`Message: ${sms.message}\n`);
      
      const response = await axios.get(`${API_BASE_URL}/api/sms/test-parse`, {
        params: { message: sms.message },
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      });
      
      if (response.data.success) {
        const parsed = response.data.parseResult.data;
        console.log('✅ Parsed successfully:');
        console.log(`   Amount: Ksh${parsed.amount}`);
        console.log(`   Account Number: ${parsed.accountNumber}`);
        console.log(`   Phone Number: ${parsed.phoneNumber}`);
        console.log(`   Transaction Date: ${parsed.transactionDate}`);
        console.log(`   Transaction ID: ${parsed.transactionId}`);
        console.log(`   Sender Name: ${parsed.senderName}`);
        console.log(`   Paybill Number: ${parsed.paybillNumber}\n`);
      } else {
        console.log('❌ Failed to parse:', response.data.parseResult.error, '\n');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.error || error.message, '\n');
    }
  }
}

// Test the main SMS processing endpoint
async function testSMSProcessing() {
  console.log('🔄 Testing SMS Processing Endpoint\n');
  
  for (const sms of sampleSMSMessages) {
    try {
      console.log(`📱 Processing: ${sms.name}`);
      console.log(`Message: ${sms.message}\n`);
      
      const response = await axios.post(`${API_BASE_URL}/api/sms/mpesa`, {
        message: sms.message
      });
      
      if (response.data.success) {
        console.log('✅ Processed successfully:');
        console.log(`   Message: ${response.data.message}`);
        if (response.data.data.debt) {
          console.log(`   Debt ID: ${response.data.data.debt.id}`);
          console.log(`   Debt Code: ${response.data.data.debt.debtCode}`);
          console.log(`   New Paid Amount: Ksh${response.data.data.debt.newPaidAmount}`);
          console.log(`   New Remaining Amount: Ksh${response.data.data.debt.newRemainingAmount}`);
          console.log(`   New Status: ${response.data.data.debt.newStatus}`);
        }
        if (response.data.data.payment) {
          console.log(`   Payment Amount: Ksh${response.data.data.payment.amount}`);
          console.log(`   Transaction ID: ${response.data.data.payment.transactionId}`);
          console.log(`   Phone Number: ${response.data.data.payment.phoneNumber}`);
          console.log(`   Sender Name: ${response.data.data.payment.senderName}`);
        }
        console.log('');
      } else {
        console.log('❌ Failed to process:', response.data.error, '\n');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.error || error.message, '\n');
    }
  }
}

// Test manual processing with debt code override
async function testManualProcessing() {
  console.log('🔧 Testing Manual SMS Processing with Debt Code Override\n');
  
  const testMessage = 'GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 99999 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00';
  const debtCode = '12345'; // Override the account number from SMS
  
  try {
    console.log(`📱 Manual Processing with debt code override`);
    console.log(`Message: ${testMessage}`);
    console.log(`Override Debt Code: ${debtCode}\n`);
    
    const response = await axios.post(`${API_BASE_URL}/api/sms/manual-process`, {
      message: testMessage,
      debtCode: debtCode
    }, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    
    if (response.data.success) {
      console.log('✅ Manually processed successfully:');
      console.log(`   Parsed Account Number: ${response.data.parseResult.data.accountNumber}`);
      console.log(`   Override Debt Code: ${debtCode}`);
      if (response.data.processResult.success) {
        console.log(`   Processing Result: ${response.data.processResult.message}`);
      } else {
        console.log(`   Processing Error: ${response.data.processResult.error}`);
      }
      console.log('');
    } else {
      console.log('❌ Failed to process manually:', response.data.error, '\n');
    }
  } catch (error) {
    console.log('❌ Error:', error.response?.data?.error || error.message, '\n');
  }
}

// Test getting unmatched transactions
async function testUnmatchedTransactions() {
  console.log('🔍 Testing Unmatched Transactions Endpoint\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/sms/unmatched`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    
    if (response.data.success) {
      console.log(`✅ Found ${response.data.data.length} unmatched transactions:`);
      response.data.data.forEach((tx, index) => {
        console.log(`   ${index + 1}. Account: ${tx.accountNumber}, Amount: Ksh${tx.amount}, Reason: ${tx.reason}`);
      });
      console.log('');
    } else {
      console.log('❌ Failed to get unmatched transactions:', response.data.error, '\n');
    }
  } catch (error) {
    console.log('❌ Error:', error.response?.data?.error || error.message, '\n');
  }
}

// Test production readiness
async function testProductionReadiness() {
  console.log('🚀 Testing Production Readiness\n');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test SMS endpoint availability
    const smsResponse = await axios.post(SMS_ENDPOINT, {
      message: 'Test message for endpoint availability'
    }, { timeout: 5000 });
    
    console.log('✅ SMS endpoint is accessible');
    console.log(`   Response status: ${smsResponse.status}`);
    
    console.log('\n🎯 Production Setup Checklist:');
    console.log('   ✅ Server is running and accessible');
    console.log('   ✅ SMS endpoint is responding');
    console.log('   ✅ Health check is working');
    console.log('\n📱 Next Steps:');
    console.log(`   1. Configure your SMS forwarding app with: ${SMS_ENDPOINT}`);
    console.log('   2. Test with real M-Pesa SMS messages');
    console.log('   3. Monitor payment processing in your dashboard');
    console.log('   4. Check unmatched transactions for any issues');
    
  } catch (error) {
    console.log('❌ Production readiness test failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || 'Unknown error'}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure your server is running');
    console.log('   2. Check if the endpoint URL is correct');
    console.log('   3. Verify network connectivity');
    console.log('   4. Check server logs for errors');
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting SMS Endpoint Tests\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`📱 SMS Endpoint: ${SMS_ENDPOINT}\n`);
  
  try {
    await testProductionReadiness();
    await testSMSForwarding();
    await testSMSParsing();
    await testSMSProcessing();
    await testManualProcessing();
    await testUnmatchedTransactions();
    
    console.log('✅ All tests completed!\n');
    console.log('📋 Test Summary:');
    console.log('   - Production Readiness: Tests server accessibility');
    console.log('   - SMS Forwarding: Tests the main production endpoint');
    console.log('   - SMS Parsing: Tests the parsing of M-Pesa SMS messages');
    console.log('   - SMS Processing: Tests the main payment processing endpoint');
    console.log('   - Manual Processing: Tests processing with debt code override');
    console.log('   - Unmatched Transactions: Tests retrieval of unmatched payments');
    console.log('\n🔗 Available Endpoints:');
    console.log(`   POST ${SMS_ENDPOINT} - Main SMS processing endpoint (for your app)`);
    console.log(`   GET  ${API_BASE_URL}/api/sms/test-parse - Test SMS parsing`);
    console.log(`   POST ${API_BASE_URL}/api/sms/test-process - Test SMS processing`);
    console.log(`   GET  ${API_BASE_URL}/api/sms/unmatched - Get unmatched transactions`);
    console.log(`   GET  ${API_BASE_URL}/api/sms/summary/:debtId - Get payment summary`);
    console.log(`   POST ${API_BASE_URL}/api/sms/manual-process - Manual processing`);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testSMSForwarding,
  testSMSParsing,
  testSMSProcessing,
  testManualProcessing,
  testUnmatchedTransactions,
  testProductionReadiness,
  runTests
}; 