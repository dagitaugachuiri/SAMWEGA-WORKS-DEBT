const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Set demo mode for testing if not already set
if (!process.env.DEMO_MODE) {
  process.env.DEMO_MODE = 'true';
  console.log('🎭 Demo mode enabled for testing');
}

const { initializeFirebase } = require('./services/firebase');
const debtRoutes = require('./routes/debts');
const testRoutes = require('./routes/test');
const paymentRoutes = require('./routes/payments');
const smsRoutes = require('./routes/sms');
const { errorHandler } = require('./middleware/errorHandler');
const smsService = require('./services/sms');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK
initializeFirebase();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-vercel-app.vercel.app'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/debts', debtRoutes);
app.use('/api/test', testRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sms', smsRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Samwega Works Ltd. Debt Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      debts: '/api/debts',
      payments: '/api/payments',
      test: '/api/test',
    

    }
  });
});
// Root endpoint
app.post('/', (req, res) => {
  res.json({ 
    message: 'Samwega Works Ltd. Debt Management API',
    version: '1.0.0',
    endpoints: {
      sms: '/sms/test',
      send: '/sms/send',
      invoice: '/sms/invoice',
      paymentConfirmation: '/sms/payment-confirmation',
      status: '/sms/status/:messageId',
      healthCheck: '/sms/health'

    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


// Test SMS endpoint
app.post('/sms/test', async (req, res) => {
  console.log('🧪 === SMS TEST ENDPOINT CALLED ===');
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      console.log('❌ Phone number is required');
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    console.log(`📱 Testing SMS to: ${phoneNumber}`);
    const result = await smsService.sendTestSMS(phoneNumber);

    console.log('✅ Test SMS completed');
    console.log('📋 Result:', JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error) {
    console.error('❌ Test SMS endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send custom SMS endpoint
app.post('/sms/send', async (req, res) => {
  console.log('📤 === SEND SMS ENDPOINT CALLED ===');
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { phoneNumber, message, userId, debtId } = req.body;

    if (!phoneNumber || !message) {
      console.log('❌ Phone number and message are required');
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    console.log(`📱 Sending SMS to: ${phoneNumber}`);
    console.log(`💬 Message: ${message}`);

    const result = await smsService.sendSMS(
      phoneNumber, 
      message, 
      userId || 'api-test', 
      debtId || 'api-test-debt'
    );

    console.log('✅ Send SMS completed');
    console.log('📋 Result:', JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error) {
    console.error('❌ Send SMS endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate invoice SMS endpoint
app.post('/sms/invoice', async (req, res) => {
  console.log('📝 === GENERATE INVOICE SMS ENDPOINT CALLED ===');
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { debt, phoneNumber, sendSMS } = req.body;

    if (!debt) {
      console.log('❌ Debt object is required');
      return res.status(400).json({
        success: false,
        error: 'Debt object is required'
      });
    }

    console.log('📝 Generating invoice SMS...');
    const message = smsService.generateInvoiceSMS(debt);

    const response = {
      success: true,
      message: message,
      messageLength: message.length
    };

    // Optionally send the SMS if phoneNumber and sendSMS flag are provided
    if (phoneNumber && sendSMS === true) {
      console.log(`📤 Sending invoice SMS to: ${phoneNumber}`);
      const smsResult = await smsService.sendSMS(
        phoneNumber, 
        message, 
        debt.userId || 'invoice-test', 
        debt.id || debt.debtCode
      );
      response.smsResult = smsResult;
    }

    console.log('✅ Invoice SMS generation completed');
    console.log('📋 Response:', JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error) {
    console.error('❌ Invoice SMS endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate payment confirmation SMS endpoint
app.post('/sms/payment-confirmation', async (req, res) => {
  console.log('💰 === GENERATE PAYMENT CONFIRMATION SMS ENDPOINT CALLED ===');
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { debt, paymentAmount, phoneNumber, sendSMS } = req.body;

    if (!debt || !paymentAmount) {
      console.log('❌ Debt object and payment amount are required');
      return res.status(400).json({
        success: false,
        error: 'Debt object and payment amount are required'
      });
    }

    console.log('💰 Generating payment confirmation SMS...');
    const message = smsService.generatePaymentConfirmationSMS(debt, paymentAmount);

    const response = {
      success: true,
      message: message,
      messageLength: message.length
    };

    // Optionally send the SMS if phoneNumber and sendSMS flag are provided
    if (phoneNumber && sendSMS === true) {
      console.log(`📤 Sending payment confirmation SMS to: ${phoneNumber}`);
      const smsResult = await smsService.sendSMS(
        phoneNumber, 
        message, 
        debt.userId || 'payment-test', 
        debt.id || debt.debtCode
      );
      response.smsResult = smsResult;
    }

    console.log('✅ Payment confirmation SMS generation completed');
    console.log('📋 Response:', JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error) {
    console.error('❌ Payment confirmation SMS endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check message status endpoint
app.get('/sms/status/:messageId', async (req, res) => {
  console.log('📊 === CHECK MESSAGE STATUS ENDPOINT CALLED ===');
  console.log('📋 Message ID:', req.params.messageId);

  try {
    const { messageId } = req.params;

    if (!messageId) {
      console.log('❌ Message ID is required');
      return res.status(400).json({
        success: false,
        error: 'Message ID is required'
      });
    }

    console.log(`📊 Checking status for message: ${messageId}`);
    const result = await smsService.getMessageStatus(messageId);

    console.log('✅ Message status check completed');
    console.log('📋 Result:', JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error) {
    console.error('❌ Message status endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SMS service health check endpoint
app.get('/sms/health', (req, res) => {
  console.log('🏥 === SMS HEALTH CHECK ENDPOINT CALLED ===');

  const healthStatus = {
    service: 'SMS Service',
    status: 'OK',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    environment: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET',
      authToken: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'NOT SET',
      samwegaPaybill: process.env.SAMWEGA_PAYBILL || 'NOT SET'
    }
  };

  console.log('🏥 Health check result:', JSON.stringify(healthStatus, null, 2));
  res.json(healthStatus);
});



// Usage: Add to your main app.js or server.js:
// const smsTestRoutes = require('./sms-test-routes');
// app.use('/api', smsTestRoutes);




// Start server
app.listen(PORT, () => {
  console.log(`🚀 Samwega Debt Management Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
