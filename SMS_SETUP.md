# SMS Integration Setup with Infobip

This document explains how to set up and configure the SMS functionality using Infobip for the Samwega Debt Management System.

## Overview

The system automatically sends SMS messages to debtors when:
1. **Debt is created** - Invoice SMS with payment instructions
2. **Payment is received** - Payment confirmation SMS

## Infobip Setup

### 1. Create Infobip Account
1. Visit [https://infobip.com](https://infobip.com)
2. Sign up for a new account or log in to existing account
3. Complete account verification process

### 2. Get API Credentials
1. Go to **Developer Hub** in your Infobip dashboard
2. Navigate to **API Keys** section
3. Create a new API key or copy existing one
4. Note down your **API Key** (starts with "App ")

### 3. Configure Sender ID
1. In Infobip dashboard, go to **SMS** > **Sender IDs**
2. Register "SAMWEGA" as sender ID (or your preferred name)
3. Wait for approval if required by your region

## Environment Configuration

Update your `.env` file in the server directory with the following variables:

```bash
# Infobip SMS Configuration
INFOBIP_API_KEY=your_infobip_api_key_here
INFOBIP_BASE_URL=https://api.infobip.com
INFOBIP_SENDER_ID=SAMWEGA

# Your M-Pesa Paybill (for payment instructions)
SAMWEGA_PAYBILL=your_mpesa_paybill_number
```

### Example Configuration:
```bash
INFOBIP_API_KEY=App 1234567890abcdef1234567890abcdef-12345678-1234-1234-1234-123456789012
INFOBIP_BASE_URL=https://api.infobip.com
INFOBIP_SENDER_ID=SAMWEGA
SAMWEGA_PAYBILL=123456
```

## SMS Message Templates

### 1. Invoice SMS (Sent when debt is created)
```
Samwega Works Ltd Invoice: Pay KES 5,000.00 for debt #123456. 
M-Pesa: Paybill 123456, Account 123456. 
Due: 31/12/2024. Thank you!
```

### 2. Payment Confirmation SMS (Sent when payment is received)
```
Payment of KES 2,500.00 received for debt #123456. 
Thank you for your payment! - Samwega Works Ltd
```

## Features

### Automatic SMS Sending
- **On Debt Creation**: Invoice SMS sent immediately to debtor's phone
- **On Payment**: Confirmation SMS sent automatically
- **Error Handling**: Failed SMS attempts are logged and retried
- **SMS Logging**: All SMS activities logged to Firestore for audit

### Payment Method Instructions
The system includes specific payment instructions based on selected method:

- **M-Pesa**: Includes paybill number and account reference
- **Bank Transfer**: Includes reference code for bank deposits
- **Cheque**: Instructions for cheque payments

### Phone Number Validation
- Accepts Kenyan phone numbers in format: `+254XXXXXXXXX`
- Supports both Safaricom (+2541X, +2547X) and other networks

## Testing SMS Functionality

### 1. Test via Dashboard
1. Log in to the system
2. Click "Test System" button
3. Select "Test SMS"
4. Enter a valid phone number
5. Send test message

### 2. Test via API
```bash
POST /api/test/sms
Authorization: Bearer your_firebase_token
Content-Type: application/json

{
  "phoneNumber": "+254712345678",
  "message": "Test message from Samwega"
}
```

### 3. Complete Workflow Test
```bash
POST /api/test/workflow
Authorization: Bearer your_firebase_token
```
This will:
1. Create a test debt
2. Send invoice SMS
3. Simulate payment
4. Send confirmation SMS

## Troubleshooting

### Common Issues

1. **SMS not sending**
   - Check API key is correct and active
   - Verify sender ID is approved
   - Check phone number format (+254XXXXXXXXX)
   - Review server logs for error messages

2. **Invalid API Key**
   ```
   Error: Request failed with status code 401
   ```
   - Verify `INFOBIP_API_KEY` in .env file
   - Ensure API key starts with "App "

3. **Sender ID Issues**
   ```
   Error: Sender ID not approved
   ```
   - Register and get approval for sender ID in Infobip dashboard
   - Use default sender ID temporarily

4. **Phone Number Format**
   ```
   Error: Invalid destination format
   ```
   - Ensure numbers are in format +254XXXXXXXXX
   - Remove spaces and special characters

### Debugging

Check SMS logs in Firestore:
1. Open Firebase Console
2. Go to Firestore Database
3. Check `sms_logs` collection
4. Review success/failure status and error messages

## Cost Considerations

### Infobip Pricing
- SMS costs vary by destination country
- Kenya SMS typically costs $0.03-0.05 per message
- Monitor usage in Infobip dashboard
- Set up billing alerts to avoid overspend

### Optimization Tips
1. **Message Length**: Keep under 160 characters to avoid multi-part SMS
2. **Timing**: Send during business hours for better delivery
3. **Validation**: Validate phone numbers before sending
4. **Monitoring**: Regular check delivery reports

## Production Deployment

### Security Checklist
- [ ] API keys stored securely in environment variables
- [ ] Never commit API keys to version control
- [ ] Use different API keys for dev/staging/production
- [ ] Enable IP whitelisting if available
- [ ] Monitor API usage and set up alerts

### Monitoring
1. Set up Infobip delivery reports
2. Monitor SMS logs in Firestore
3. Set up alerting for high failure rates
4. Regular audit of SMS usage and costs

## Support

### Infobip Support
- Documentation: [https://www.infobip.com/docs](https://www.infobip.com/docs)
- Support Portal: Available in Infobip dashboard
- API Reference: [https://www.infobip.com/docs/api](https://www.infobip.com/docs/api)

### System Support
- Check server logs: `npm run dev` (development)
- Test endpoints: Use the built-in test functionality
- Firebase logs: Available in Firebase Console

## API Reference

### Send SMS Endpoint
```javascript
// Internal service method
smsService.sendSMS(phoneNumber, message, userId, debtId)
```

### Generate Messages
```javascript
// Invoice SMS
smsService.generateInvoiceSMS(debtObject)

// Payment confirmation SMS
smsService.generatePaymentConfirmationSMS(debtObject, paymentAmount)
```

This integration provides reliable SMS delivery with comprehensive logging and error handling for the debt management system.




const express = require('express');
const { collection, addDoc, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, updateDoc, setDoc } = require('firebase/firestore');
const { getFirestoreApp } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const smsService = require('../services/sms');

const router = express.Router();

// Previous routes (unchanged, included for context)
const generateDebtCode = async () => {
  const db = getFirestoreApp();
  let code;
  let isUnique = false;
  const maxAttempts = 10;
  let attempts = 0;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.floor(100000 + Math.random() * Troubleshooting
  }
};



// Existing routes (unchanged, included for completeness)
router.post('/', authenticate, validate(schemas.debt), async (req, res) => {
  // ... (unchanged)
});

// ... (other existing routes)

module.exports = router;