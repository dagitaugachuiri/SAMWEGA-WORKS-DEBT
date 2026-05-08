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
const customerRoutes = require('./routes/customers');
const userRoutes = require('./routes/users');
const configRoutes = require('./routes/config');
const supplierDebtRoutes = require('./routes/supplier-debts');
const { errorHandler } = require('./middleware/errorHandler');
const smsService = require('./services/sms');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK
initializeFirebase();

// CORS configuration - move to top
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url} from ${req.headers.origin || 'no origin'}`);
  next();
});

// Enable trust proxy
app.set('trust proxy', 1);

// Security middleware - temporarily commented out to debug CORS
// app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, // Increased for development
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/debts', debtRoutes);
app.use('/api/test', testRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/config', configRoutes);
app.use('/api/supplier-debts', supplierDebtRoutes);


app.get('/health', (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ip: clientIp // Add client IP to response
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
      sms: '/api/sms',
      users: '/api/users',
      config: '/api/config'
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
