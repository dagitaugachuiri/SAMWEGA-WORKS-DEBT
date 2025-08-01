const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Test configuration
const TEST_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  testUser: {
    email: 'test@samwega.com',
    password: 'testpassword123'
  },
  testDebt: {
    storeOwner: {
      name: 'John Doe',
      phoneNumber: '+254712345678',
      email: 'john@example.com'
    },
    store: {
      name: 'ABC Hardware',
      location: 'Gilgil'
    },
    amount: 10000,
    dateIssued: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'mpesa',
    description: 'Metal building supplies'
  }
};

class TestRunner {
  constructor() {
    this.results = [];
    this.authToken = null;
    this.testDebtId = null;
  }

  async log(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (isError) {
      console.error('❌', logMessage);
    } else {
      console.log('✅', logMessage);
    }
    
    this.results.push({ timestamp, message, isError });
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${TEST_CONFIG.baseURL}${endpoint}`,
        timeout: TEST_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }

      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 0
      };
    }
  }

  async testHealthCheck() {
    await this.log('Testing health check endpoint...');
    
    const result = await this.makeRequest('GET', '/health');
    
    if (result.success && result.data.status === 'OK') {
      await this.log('Health check passed');
      return true;
    } else {
      await this.log(`Health check failed: ${result.error}`, true);
      return false;
    }
  }

  async testAuthentication() {
    await this.log('Testing authentication (mock)...');
    
    // Since we can't actually create a Firebase user in this test,
    // we'll simulate having a valid token
    // In a real test, you would get this token from Firebase Auth
    this.authToken = 'mock-jwt-token-for-testing';
    
    await this.log('Authentication test completed (mocked)');
    return true;
  }

  async testDebtCreation() {
    await this.log('Testing debt creation...');
    
    const result = await this.makeRequest('POST', '/api/debts', TEST_CONFIG.testDebt);
    
    if (result.success && result.data.success) {
      this.testDebtId = result.data.data.id;
      const sixDigitCode = result.data.data.sixDigitCode;
      await this.log(`Debt created successfully with ID: ${this.testDebtId}, Code: ${sixDigitCode}`);
      
      // Check SMS was attempted
      if (result.data.sms) {
        await this.log(`SMS notification: ${result.data.sms.success ? 'Sent' : 'Failed'}`);
      }
      
      return true;
    } else {
      await this.log(`Debt creation failed: ${JSON.stringify(result.error)}`, true);
      return false;
    }
  }

  async testDebtRetrieval() {
    if (!this.testDebtId) {
      await this.log('Skipping debt retrieval test - no debt ID available', true);
      return false;
    }

    await this.log('Testing debt retrieval...');
    
    // Test get all debts
    const allDebtsResult = await this.makeRequest('GET', '/api/debts');
    
    if (allDebtsResult.success && allDebtsResult.data.success) {
      await this.log(`Retrieved ${allDebtsResult.data.data.length} debts`);
    } else {
      await this.log(`Failed to retrieve all debts: ${allDebtsResult.error}`, true);
      return false;
    }

    // Test get specific debt
    const specificDebtResult = await this.makeRequest('GET', `/api/debts/${this.testDebtId}`);
    
    if (specificDebtResult.success && specificDebtResult.data.success) {
      await this.log(`Retrieved specific debt: ${this.testDebtId}`);
      return true;
    } else {
      await this.log(`Failed to retrieve specific debt: ${specificDebtResult.error}`, true);
      return false;
    }
  }

  async testPaymentSimulation() {
    if (!this.testDebtId) {
      await this.log('Skipping payment simulation test - no debt ID available', true);
      return false;
    }

    await this.log('Testing payment simulation...');
    
    const paymentData = {
      debtId: this.testDebtId,
      amount: 5000,
      paymentMethod: 'mpesa'
    };

    const result = await this.makeRequest('POST', '/api/test/simulate-payment', paymentData);
    
    if (result.success && result.data.success) {
      await this.log('Payment simulation completed successfully');
      
      // Check if SMS confirmation was sent
      if (result.data.data.sms) {
        await this.log(`Payment confirmation SMS: ${result.data.data.sms.success ? 'Sent' : 'Failed'}`);
      }
      
      return true;
    } else {
      await this.log(`Payment simulation failed: ${JSON.stringify(result.error)}`, true);
      return false;
    }
  }

  async testSMSFunctionality() {
    await this.log('Testing SMS functionality...');
    
    const smsData = {
      phoneNumber: '+254712345678',
      message: 'Test SMS from Samwega debt management system'
    };

    const result = await this.makeRequest('POST', '/api/test/sms', smsData);
    
    if (result.success) {
      await this.log(`SMS test completed: ${result.data.result.success ? 'Success' : 'Failed'}`);
      return result.data.result.success;
    } else {
      await this.log(`SMS test failed: ${JSON.stringify(result.error)}`, true);
      return false;
    }
  }

  async testCompleteWorkflow() {
    await this.log('Testing complete workflow...');
    
    const result = await this.makeRequest('POST', '/api/test/workflow');
    
    if (result.success && result.data.success) {
      const steps = result.data.data.steps;
      await this.log(`Workflow test completed with debt ID: ${result.data.data.debtId}`);
      await this.log(`- Debt creation: ${steps.debtCreation.success ? 'Success' : 'Failed'}`);
      await this.log(`- Invoice SMS: ${steps.invoiceSMS.success ? 'Success' : 'Failed'}`);
      await this.log(`- Payment simulation: ${steps.paymentSimulation.success ? 'Success' : 'Failed'}`);
      await this.log(`- Confirmation SMS: ${steps.confirmationSMS.success ? 'Success' : 'Failed'}`);
      return true;
    } else {
      await this.log(`Complete workflow test failed: ${JSON.stringify(result.error)}`, true);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Samwega Debt Management System Tests');
    console.log('=' * 60);
    
    const tests = [
      { name: 'Health Check', func: this.testHealthCheck },
      { name: 'Authentication', func: this.testAuthentication },
      { name: 'Debt Creation', func: this.testDebtCreation },
      { name: 'Debt Retrieval', func: this.testDebtRetrieval },
      { name: 'Payment Simulation', func: this.testPaymentSimulation },
      { name: 'SMS Functionality', func: this.testSMSFunctionality },
      { name: 'Complete Workflow', func: this.testCompleteWorkflow }
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    for (const test of tests) {
      try {
        console.log(`\n📋 Running ${test.name}...`);
        const result = await test.func.call(this);
        if (result) {
          passedTests++;
        }
      } catch (error) {
        await this.log(`${test.name} threw an error: ${error.message}`, true);
      }
    }

    console.log('\n' + '=' * 60);
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! System is ready for deployment.');
    } else {
      console.log(`⚠️ ${totalTests - passedTests} test(s) failed. Please check the errors above.`);
    }

    return passedTests === totalTests;
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      total: this.results.length,
      passed: this.results.filter(r => !r.isError).length,
      failed: this.results.filter(r => r.isError).length,
      details: this.results
    };

    console.log('\n📄 Detailed Test Report:');
    console.log(JSON.stringify(report, null, 2));
    
    return report;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = new TestRunner();
  
  testRunner.runAllTests()
    .then(success => {
      testRunner.generateReport();
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = TestRunner;
