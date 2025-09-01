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

// Enable trust proxy - add this BEFORE other middleware
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
  
// CORS configuration 
app.use(cors({
  origin:['https://smwoks-1.onrender.com','https://samwega-works-debt-mngmt.onrender.com','http://localhost:3000','https://samwega-works-debt-client.onrender.com'], // Add your frontend domain
  credentials: true,

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
      sms: '/api/sms'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});






// Start server
app.listen(PORT, () => {
  console.log(`🚀 Samwega Debt Management Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
