# Production Setup Guide - SMS-Based Payment System

This guide will help you set up your SMS-based debt management system for production use with an SMS forwarding mobile app.

## 🚀 Quick Start

### 1. **Deploy Your Server**
Deploy your Node.js server to your production environment (Heroku, AWS, DigitalOcean, etc.)

### 2. **Configure SMS Forwarding App**
In your SMS forwarding mobile app, set the endpoint URL to:
```
https://your-production-domain.com/api/sms/mpesa
```

### 3. **Test the Setup**
Run the production test script:
```bash
cd server
node test-sms-endpoint.js
```

## 📱 SMS Forwarding App Configuration

### **Endpoint URL**
```
POST https://your-production-domain.com/api/sms/mpesa
```

### **Request Format**
Your SMS forwarding app should send:
```json
{
  "message": "GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 12345 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00",
  "timestamp": "2024-07-26T10:30:00.000Z",
  "source": "sms-forwarder-app"
}
```

### **Response Format**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "debt": {
      "id": "debt-id",
      "debtCode": "12345",
      "newStatus": "partially_paid",
      "newPaidAmount": 500,
      "newRemainingAmount": 1500
    },
    "payment": {
      "amount": 500,
      "transactionId": "GT87HJ890",
      "phoneNumber": "254722123456",
      "senderName": "JOHN DOE"
    }
  }
}
```

## 🔧 Environment Configuration

### **Required Environment Variables**
```bash
# Production settings
NODE_ENV=production
PORT=5000

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# SMS Configuration
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=your-sender-id

# API Configuration
API_BASE_URL=https://your-production-domain.com
API_TOKEN=your-secure-api-token

# Demo mode (disable for production)
DEMO_MODE=false
```

### **Optional Environment Variables**
```bash
# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🧪 Testing Production Setup

### **1. Run Production Tests**
```bash
cd server
API_BASE_URL=https://your-production-domain.com node test-sms-endpoint.js
```

### **2. Test with Real SMS**
1. Create a test debt in your system
2. Make a real M-Pesa payment using the debt code
3. Check if the SMS is forwarded and processed

### **3. Monitor Logs**
Check your server logs for:
- SMS received messages
- Payment processing results
- Any errors or unmatched transactions

## 📊 Monitoring & Debugging

### **Health Check Endpoint**
```
GET https://your-production-domain.com/health
```

### **Unmatched Transactions**
```
GET https://your-production-domain.com/api/sms/unmatched
```

### **Payment Summary**
```
GET https://your-production-domain.com/api/sms/summary/:debtId
```

## 🔒 Security Considerations

### **1. HTTPS Only**
Ensure your production server uses HTTPS for all communications.

### **2. Rate Limiting**
The server includes rate limiting to prevent abuse:
- 100 requests per 15 minutes per IP
- Adjustable via environment variables

### **3. Input Validation**
All SMS messages are validated before processing.

### **4. Error Handling**
Failed SMS processing is logged and can be reviewed.

## 🚨 Troubleshooting

### **Common Issues**

#### **1. SMS Not Being Processed**
- Check if the SMS forwarding app is sending to the correct URL
- Verify the server is running and accessible
- Check server logs for errors

#### **2. Payment Not Matching Debt**
- Verify the account number in the SMS matches a debt code
- Check for typos in debt codes
- Review unmatched transactions

#### **3. SMS Parsing Errors**
- Ensure the SMS format matches M-Pesa confirmation messages
- Check if the SMS forwarding app is modifying the message
- Test with the parsing endpoint

### **Debug Commands**

#### **Test SMS Parsing**
```bash
curl -X GET "https://your-domain.com/api/sms/test-parse?message=YOUR_SMS_MESSAGE" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

#### **Test SMS Processing**
```bash
curl -X POST "https://your-domain.com/api/sms/mpesa" \
  -H "Content-Type: application/json" \
  -d '{"message": "YOUR_SMS_MESSAGE"}'
```

#### **Check Unmatched Transactions**
```bash
curl -X GET "https://your-domain.com/api/sms/unmatched" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

## 📈 Production Checklist

- [ ] Server deployed and accessible via HTTPS
- [ ] Environment variables configured
- [ ] SMS forwarding app configured with correct endpoint
- [ ] Production tests passing
- [ ] Real SMS test completed successfully
- [ ] Monitoring and logging set up
- [ ] Error handling verified
- [ ] Security measures in place
- [ ] Backup procedures established

## 🆘 Support

If you encounter issues:

1. **Check server logs** for detailed error messages
2. **Run the test script** to verify endpoint functionality
3. **Review unmatched transactions** for processing issues
4. **Test with sample SMS messages** to isolate problems

## 📞 Emergency Contacts

- **Server Issues**: Check your hosting provider's support
- **SMS Processing**: Review logs and unmatched transactions
- **Payment Issues**: Check debt records and payment logs

---

**Remember**: Always test thoroughly in a staging environment before going live with real payments! 