# M-Pesa SMS Processing Endpoint

This document describes the SMS processing endpoint that receives M-Pesa SMS messages and automatically updates debt records in the system.

## Overview

The SMS processing system consists of:
- **SMS Processor Service** (`server/services/smsProcessor.js`) - Core logic for parsing and processing SMS messages
- **SMS Routes** (`server/routes/sms.js`) - Express endpoints for handling SMS requests
- **Main Endpoint** - `POST /api/sms/mpesa` - Receives and processes M-Pesa SMS messages

## Features

- ✅ Parse M-Pesa SMS messages to extract payment details
- ✅ Automatically update debt records with payment information
- ✅ Log all payments and unmatched transactions
- ✅ Handle various SMS message formats
- ✅ Error handling and validation
- ✅ Testing endpoints for development
- ✅ Manual processing with debt code override

## Main Endpoint

### POST `/api/sms/mpesa`

Receives M-Pesa SMS messages and processes payments automatically.

**Request Body:**
```json
{
  "message": "GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 12345 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00"
}
```

**Alternative field names supported:**
- `message`
- `smsText`
- `text`
- `content`

**Response (Success):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "debt": {
      "id": "debt_id_here",
      "debtCode": "12345",
      "originalAmount": 1000,
      "previousPaidAmount": 0,
      "newPaidAmount": 500,
      "newRemainingAmount": 500,
      "newStatus": "partially_paid"
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

**Response (Error):**
```json
{
  "success": false,
  "error": "No debt found for this account number",
  "accountNumber": "12345"
}
```

## SMS Message Format

The system parses M-Pesa SMS messages in the following format:

```
[TransactionID] Confirmed. You have received Ksh[Amount] from [SenderName] [PhoneNumber] for account [AccountNumber] via Paybill [PaybillNumber] on [Date] at [Time]. New M-PESA balance is Ksh[Balance].
```

**Example:**
```
GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 12345 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00
```

**Extracted Data:**
- **Transaction ID**: `GT87HJ890`
- **Amount**: `500.00`
- **Sender Name**: `JOHN DOE`
- **Phone Number**: `254722123456`
- **Account Number**: `12345`
- **Paybill Number**: `570425`
- **Transaction Date**: `2024-07-26 at 10:30 AM`

## Additional Endpoints

### GET `/api/sms/test-parse`
Test SMS parsing without processing payments.

**Query Parameters:**
- `message` - SMS message to parse

**Headers:**
- `Authorization: Bearer <token>` (required)

### POST `/api/sms/test-process`
Test SMS processing (requires authentication).

**Request Body:**
```json
{
  "message": "SMS message here"
}
```

### GET `/api/sms/unmatched`
Get unmatched transactions that need review.

**Headers:**
- `Authorization: Bearer <token>` (required)

### GET `/api/sms/summary/:debtId`
Get payment summary for a specific debt.

**Headers:**
- `Authorization: Bearer <token>` (required)

### POST `/api/sms/manual-process`
Manually process SMS with optional debt code override.

**Request Body:**
```json
{
  "message": "SMS message here",
  "debtCode": "optional_debt_code_override"
}
```

**Headers:**
- `Authorization: Bearer <token>` (required)

## Database Collections

### `debts` Collection
Updated fields when payment is processed:
- `paidAmount` - Total amount paid
- `remainingAmount` - Remaining debt amount
- `status` - Updated status (`paid`, `partially_paid`, `pending`)
- `lastPaymentDate` - Date of last payment
- `lastUpdatedAt` - Last update timestamp

### `payment_logs` Collection
Logs all payment attempts:
```json
{
  "debtId": "debt_id",
  "debtCode": "12345",
  "amount": 500,
  "paymentMethod": "mpesa_paybill",
  "reference": "GT87HJ890",
  "phoneNumber": "254722123456",
  "accountNumber": "12345",
  "senderName": "JOHN DOE",
  "transactionDate": "2024-07-26T10:30:00.000Z",
  "success": true,
  "transactionId": "GT87HJ890",
  "smsData": { /* parsed SMS data */ },
  "createdAt": "2024-07-26T10:30:00.000Z"
}
```

### `unmatched_transactions` Collection
Logs transactions that couldn't be matched to debts:
```json
{
  "accountNumber": "99999",
  "amount": 500,
  "phoneNumber": "254722123456",
  "transactionDate": "2024-07-26T10:30:00.000Z",
  "transactionId": "GT87HJ890",
  "senderName": "JOHN DOE",
  "paybillNumber": "570425",
  "originalMessage": "SMS message here",
  "reason": "No matching debt found",
  "needsReview": true,
  "createdAt": "2024-07-26T10:30:00.000Z"
}
```

## Testing

Run the test script to verify the endpoint functionality:

```bash
cd server
node test-sms-endpoint.js
```

**Prerequisites:**
- Set `API_BASE_URL` environment variable (default: `http://localhost:5000`)
- Set `API_TOKEN` environment variable for authenticated endpoints
- Ensure server is running
- Ensure Firebase is configured

## Error Handling

The system handles various error scenarios:

1. **Invalid SMS Format** - Returns parsing error with details
2. **Missing Required Fields** - Validates amount and account number
3. **No Matching Debt** - Logs as unmatched transaction
4. **Database Errors** - Logs errors and returns appropriate response
5. **Network Errors** - Graceful error handling with detailed logging

## Security Considerations

- The main SMS endpoint (`/api/sms/mpesa`) does not require authentication for webhook compatibility
- All other endpoints require authentication
- Input validation prevents malicious data injection
- All operations are logged for audit purposes

## Integration

### Webhook Integration
Configure your SMS forwarding service to send POST requests to:
```
POST http://your-server.com/api/sms/mpesa
```

**Example webhook payload:**
```json
{
  "message": "GT87HJ890 Confirmed. You have received Ksh500.00 from JOHN DOE 254722123456 for account 12345 via Paybill 570425 on 2024-07-26 at 10:30 AM. New M-PESA balance is Ksh10,000.00"
}
```

### Manual Processing
For manual processing or testing, use the authenticated endpoints with proper API tokens.

## Monitoring

Monitor the following for system health:
- Payment success/failure rates
- Unmatched transactions count
- Database performance
- API response times
- Error logs

## Troubleshooting

### Common Issues

1. **"No debt found for this account number"**
   - Verify the debt exists with the correct `debtCode`
   - Check for typos in account numbers

2. **"Invalid SMS message format"**
   - Verify SMS message follows M-Pesa format
   - Check for special characters or encoding issues

3. **Authentication errors**
   - Verify API token is valid
   - Check token expiration

4. **Database connection issues**
   - Verify Firebase configuration
   - Check network connectivity

### Logs
Check server logs for detailed error information:
```bash
# View server logs
tail -f server.log

# Check for SMS processing errors
grep "SMS" server.log
```

## Support

For issues or questions:
1. Check the logs for error details
2. Verify SMS message format
3. Test with the provided test script
4. Review unmatched transactions collection 