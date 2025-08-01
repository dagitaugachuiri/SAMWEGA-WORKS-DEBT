# PayHero Integration Setup for Auto Payment Processing

This document explains how to set up and configure the PayHero API integration for automatic payment processing in the Samwega Debt Management System.

## Overview

The system automatically processes payments through PayHero by:
1. **Checking PayHero API** every 5 minutes for completed transactions
2. **Matching transactions** with debt records using the 6-digit debt code
3. **Updating debt status** automatically when payments are confirmed
4. **Sending SMS confirmations** to debtors
5. **Maintaining audit trails** of all processed payments

## PayHero Account Setup

### 1. Create PayHero Account
1. Visit [https://payhero.co.ke](https://payhero.co.ke)
2. Sign up for a business account
3. Complete KYC verification process
4. Get your business approved for API access

### 2. Get API Credentials
1. Log in to PayHero dashboard
2. Navigate to **API Settings** or **Developer Section**
3. Generate your **API Key**
4. Note down your **Base URL** (usually `https://api.payhero.co.ke`)

### 3. Configure M-Pesa Integration
1. Set up your M-Pesa business account with PayHero
2. Configure callback URLs in PayHero dashboard
3. Test the integration with small amounts

## Environment Configuration

Update your `.env` file in the server directory:

```bash
# PayHero API Configuration
PAYHERO_API_KEY=your_payhero_api_key_here
PAYHERO_BASE_URL=https://api.payhero.co.ke
API_BASE_URL=http://localhost:5000

# For production, use your actual domain
# API_BASE_URL=https://your-domain.com
```

### Example Configuration:
```bash
PAYHERO_API_KEY=pk_live_1234567890abcdef1234567890abcdef
PAYHERO_BASE_URL=https://api.payhero.co.ke
API_BASE_URL=https://samwega-api.vercel.app
```

## How Auto-Processing Works

### 1. Debt Creation
```javascript
// When a debt is created, a 6-digit code is generated
const debt = {
  debtCode: "123456", // Unique 6-digit code
  amount: 5000,
  storeOwner: { phoneNumber: "+254712345678", name: "John Doe" },
  // ... other fields
}
```

### 2. Payment Initiation
When a debtor makes an M-Pesa payment:
```javascript
// PayHero processes the payment with the debt code as reference
const paymentRequest = {
  amount: 5000,
  phone_number: "254712345678",
  external_reference: "123456", // The debt code
  callback_url: "https://your-domain.com/api/payments/webhook/payhero"
}
```

### 3. Auto-Processing Service
The system runs a background service that:
```javascript
// Every 5 minutes, check for new payments
setInterval(() => {
  // 1. Get all pending/partially paid debts
  // 2. Query PayHero API for completed transactions
  // 3. Match transactions with debt codes
  // 4. Update debt status
  // 5. Send SMS confirmations
}, 5 * 60 * 1000);
```

### 4. Transaction Matching
```javascript
// System matches PayHero transactions with debts
const transaction = {
  id: "txn_123456789",
  external_reference: "123456", // Matches debt.debtCode
  amount: 5000,
  status: "COMPLETED",
  phone_number: "254712345678"
};
```

## API Endpoints

### Payment Processing Management

#### Get Processing Status
```bash
GET /api/payments/processor/status
Authorization: Bearer your_firebase_token
```

Response:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "isProcessing": false,
    "apiConfigured": true,
    "lastProcessed": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Start/Stop Auto Processing
```bash
POST /api/payments/processor/start
POST /api/payments/processor/stop
Authorization: Bearer your_firebase_token

# Body for start endpoint
{
  "intervalMinutes": 5
}
```

#### Manual Processing Trigger
```bash
POST /api/payments/processor/run
Authorization: Bearer your_firebase_token
```

#### Check Specific Debt
```bash
POST /api/payments/processor/check-debt
Authorization: Bearer your_firebase_token

{
  "debtCode": "123456"
}
```

### Webhook Endpoint
```bash
POST /api/payments/webhook/payhero
# No authentication required - called by PayHero
```

## Database Collections

### 1. `debts` Collection
```javascript
{
  id: "debt_id",
  debtCode: "123456", // Used for PayHero matching
  amount: 5000,
  paidAmount: 0,
  remainingAmount: 5000,
  status: "pending", // "pending", "partially_paid", "paid"
  storeOwner: {
    name: "John Doe",
    phoneNumber: "+254712345678"
  },
  createdAt: "2024-01-15T08:00:00.000Z",
  lastPaymentDate: null,
  lastUpdatedAt: "2024-01-15T08:00:00.000Z"
}
```

### 2. `payment_logs` Collection
```javascript
{
  debtId: "debt_id",
  amount: 5000,
  paymentMethod: "mpesa",
  reference: "123456",
  success: true,
  transactionId: "txn_123456789",
  phoneNumber: "254712345678",
  autoProcessed: true,
  processedAt: "2024-01-15T10:30:00.000Z",
  payHeroTransaction: { /* full PayHero transaction object */ }
}
```

### 3. `processed_transactions` Collection
```javascript
{
  debtId: "debt_id",
  transactionId: "txn_123456789",
  amount: 5000,
  status: "paid",
  processedAt: "2024-01-15T10:30:00.000Z"
}
```

## Payment Flow Example

### 1. Create Debt
```bash
POST /api/debts
{
  "storeOwner": {
    "name": "John Doe",
    "phoneNumber": "+254712345678"
  },
  "store": {
    "name": "Doe's Shop",
    "location": "Nairobi"
  },
  "amount": 5000,
  "dateIssued": "2024-01-15",
  "dueDate": "2024-01-30",
  "paymentMethod": "mpesa"
}
```

Response includes `debtCode: "123456"`

### 2. SMS Sent to Debtor
```
Samwega Works Ltd Invoice: Pay KES 5,000.00 for debt #123456.
M-Pesa: Paybill 123456, Account 123456.
Due: 30/01/2024. Thank you!
```

### 3. Debtor Makes Payment
Debtor uses M-Pesa:
- Paybill: Your PayHero paybill number
- Account: 123456 (the debt code)
- Amount: 5000

### 4. PayHero Processes Payment
PayHero receives payment and creates transaction with:
- `external_reference: "123456"`
- `status: "COMPLETED"`

### 5. Auto-Processing Detects Payment
Within 5 minutes, the system:
1. Queries PayHero API
2. Finds completed transaction with reference "123456"
3. Updates debt status to "paid"
4. Sends confirmation SMS

### 6. SMS Confirmation Sent
```
Payment of KES 5,000.00 received for debt #123456.
Thank you for your payment! - Samwega Works Ltd
```

## Monitoring and Troubleshooting

### 1. Check Processing Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/payments/processor/status
```

### 2. View Payment Logs
Check Firestore collections:
- `payment_logs` - All payment attempts
- `processed_transactions` - Successfully processed transactions

### 3. Manual Processing
If auto-processing fails, manually trigger:
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/payments/processor/run
```

### 4. Check Specific Debt
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"debtCode": "123456"}' \
  http://localhost:5000/api/payments/processor/check-debt
```

## Common Issues

### 1. API Key Issues
```
Error: Request failed with status code 401
```
- Verify `PAYHERO_API_KEY` in .env file
- Ensure API key is active in PayHero dashboard

### 2. Transaction Not Found
```
No debt found for reference: 123456
```
- Check debt code spelling
- Verify debt exists in database
- Ensure debt status is not already "paid"

### 3. Webhook Not Receiving Data
- Verify webhook URL in PayHero dashboard
- Check that URL is publicly accessible
- Ensure HTTPS in production

### 4. Processing Service Not Running
```
PayHero API key not configured - cannot start auto processing
```
- Add `PAYHERO_API_KEY` to .env file
- Restart the server

## Security Considerations

### 1. API Key Security
- Never commit API keys to version control
- Use different keys for development/production
- Rotate keys regularly

### 2. Webhook Security
- Consider adding webhook signature verification
- Log all webhook requests for audit
- Rate limit webhook endpoint

### 3. Error Handling
- All payment processing errors are logged
- Failed transactions don't affect debt status
- Retry mechanisms for temporary failures

## Production Deployment

### 1. Environment Variables
```bash
# Production environment
NODE_ENV=production
PAYHERO_API_KEY=pk_live_your_production_key
API_BASE_URL=https://your-domain.com
```

### 2. Webhook Configuration
Set PayHero webhook URL to:
```
https://your-domain.com/api/payments/webhook/payhero
```

### 3. Monitoring
- Set up alerts for payment processing failures
- Monitor PayHero API rate limits
- Track payment success rates

## Support

### PayHero Support
- Documentation: [PayHero API Docs](https://payhero.co.ke/docs)
- Support: Available through PayHero dashboard

### System Support
- Check server logs for detailed error messages
- Use the built-in status endpoints for monitoring
- Review Firestore logs for payment processing history

This integration ensures reliable, automatic payment processing with full transparency and accountability through comprehensive logging and SMS notifications.
