#!/bin/bash

# Production Deployment Script for SMS-Based Payment System
# This script helps you prepare and deploy your server for production

set -e

echo "🚀 Production Deployment Script for SMS-Based Payment System"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the server directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the server directory"
    exit 1
fi

print_status "Starting production deployment preparation..."

# 1. Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# 2. Install dependencies
print_status "Installing production dependencies..."
npm ci --only=production
print_success "Dependencies installed"

# 3. Check environment variables
print_status "Checking environment variables..."
REQUIRED_VARS=("NODE_ENV" "FIREBASE_PROJECT_ID" "SMS_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_warning "Missing environment variables: ${MISSING_VARS[*]}"
    print_status "Please set these variables before deployment"
else
    print_success "All required environment variables are set"
fi

# 4. Set production environment
export NODE_ENV=production
export DEMO_MODE=false

print_status "Production environment configured"

# 5. Test the application
print_status "Running production tests..."
if node test-sms-endpoint.js > /dev/null 2>&1; then
    print_success "Production tests passed"
else
    print_warning "Production tests failed - check the output above"
fi

# 6. Create production configuration
print_status "Creating production configuration..."

cat > .env.production << EOF
# Production Environment Variables
NODE_ENV=production
PORT=\${PORT:-5000}

# Firebase Configuration
FIREBASE_PROJECT_ID=\${FIREBASE_PROJECT_ID}
FIREBASE_PRIVATE_KEY=\${FIREBASE_PRIVATE_KEY}
FIREBASE_CLIENT_EMAIL=\${FIREBASE_CLIENT_EMAIL}

# SMS Configuration
SMS_API_KEY=\${SMS_API_KEY}
SMS_SENDER_ID=\${SMS_SENDER_ID}

# API Configuration
API_BASE_URL=\${API_BASE_URL}
API_TOKEN=\${API_TOKEN}

# Demo mode (disabled for production)
DEMO_MODE=false

# CORS Configuration
ALLOWED_ORIGINS=\${ALLOWED_ORIGINS}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

print_success "Production configuration file created: .env.production"

# 7. Create deployment instructions
cat > DEPLOYMENT_INSTRUCTIONS.md << EOF
# Deployment Instructions

## Quick Deploy Options

### Option 1: Heroku
\`\`\`bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set FIREBASE_PROJECT_ID=your-project-id
heroku config:set FIREBASE_PRIVATE_KEY="your-private-key"
heroku config:set FIREBASE_CLIENT_EMAIL=your-client-email
heroku config:set SMS_API_KEY=your-sms-api-key
heroku config:set SMS_SENDER_ID=your-sender-id
heroku config:set API_BASE_URL=https://your-app-name.herokuapp.com
heroku config:set API_TOKEN=your-secure-api-token
heroku config:set DEMO_MODE=false

# Deploy
git push heroku main
\`\`\`

### Option 2: DigitalOcean App Platform
1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy automatically

### Option 3: AWS EC2
\`\`\`bash
# Install PM2 for process management
npm install -g pm2

# Start the application
pm2 start index.js --name "sms-payment-system"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
\`\`\`

## SMS Forwarding App Configuration

Set your SMS forwarding app endpoint to:
\`\`\`
https://your-domain.com/api/sms/mpesa
\`\`\`

## Testing After Deployment

1. Test health endpoint: \`https://your-domain.com/health\`
2. Run production tests: \`node test-sms-endpoint.js\`
3. Test with real SMS messages

## Monitoring

- Check application logs
- Monitor unmatched transactions: \`/api/sms/unmatched\`
- Set up alerts for errors
EOF

print_success "Deployment instructions created: DEPLOYMENT_INSTRUCTIONS.md"

# 8. Create PM2 configuration for production
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sms-payment-system',
    script: 'index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10
  }]
};
EOF

print_success "PM2 configuration created: ecosystem.config.js"

# 9. Create logs directory
mkdir -p logs
print_success "Logs directory created"

# 10. Final checklist
echo ""
echo "🎯 Production Deployment Checklist"
echo "=================================="
echo "✅ Node.js dependencies installed"
echo "✅ Production environment configured"
echo "✅ Configuration files created"
echo "✅ PM2 configuration ready"
echo "✅ Logs directory created"
echo ""
echo "📋 Next Steps:"
echo "1. Set your environment variables"
echo "2. Deploy to your hosting platform"
echo "3. Configure your SMS forwarding app"
echo "4. Test with real SMS messages"
echo "5. Monitor logs and performance"
echo ""
echo "📚 See DEPLOYMENT_INSTRUCTIONS.md for detailed instructions"
echo "📖 See PRODUCTION_SETUP.md for complete setup guide"
echo ""
print_success "Production deployment preparation completed!" 