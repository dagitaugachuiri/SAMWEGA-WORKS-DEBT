const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsProcessor = require('../services/smsProcessor');

const router = express.Router();

// Standardized error response helper
const createErrorResponse = (status, message, details = {}, originalData = null) => ({
  success: false,
  error: {
    message,
    code: status,
    details: process.env.NODE_ENV === 'development' ? details : undefined, // Include details only in dev mode
    originalData
  }
});

// POST endpoint to receive M-Pesa SMS messages
router.post('/mpesa', async (req, res) => {
  try {
    console.log('📥 Received SMS webhook:', JSON.stringify(req.body, null, 2));

    const { message, smsText, text, content } = req.body;
    const smsMessage = message || smsText || text || content;

    if (!smsMessage) {
      console.error('❌ No SMS message provided in request body');
      return res.status(400).json(createErrorResponse(400, 'SMS message is required', { fields: ['message', 'smsText', 'text', 'content'] }, req.body));
    }

    console.log('📋 Processing SMS message:', smsMessage);

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(smsMessage);

    if (!parseResult.success) {
      console.error('❌ Failed to parse SMS message:', parseResult.error);
      return res.status(400).json(createErrorResponse(400, 'Invalid SMS message format', { error: parseResult.error }, smsMessage));
    }

    // Process the payment
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);

    if (!processResult.success) {
      console.error('❌ Failed to process SMS payment:', processResult.error);
      return res.status(400).json(createErrorResponse(400, 'Payment processing failed', { error: processResult.error, accountNumber: processResult.accountNumber }));
    }

    console.log('✅ SMS payment processed successfully:', JSON.stringify(processResult, null, 2));
    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: processResult
    });

  } catch (error) {
    console.error('❌ Error processing SMS webhook:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

// POST endpoint to receive M-Pesa SMS webhook (alternative version)
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Received SMS webhook:', req.body);

    // Extract message from webhook payload
    const webhookData = req.body;
    if (!webhookData || !webhookData.key) {
      throw new Error('No SMS message provided in request body');
    }

    // Process the SMS
    const smsProcessor = require('../services/smsProcessor');
    const parsedSMS = await smsProcessor.parseMpesaSMS(webhookData);

    if (!parsedSMS.success) {
      console.warn('⚠️ Failed to parse SMS:', parsedSMS.error);
      return res.status(400).json(parsedSMS);
    }

    // Process payment if SMS was parsed successfully
    const paymentResult = await smsProcessor.processSMSPayment(parsedSMS.data);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      payment: paymentResult
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to test SMS parsing (for development/testing)
router.get('/test-parse', authenticate, async (req, res) => {
  try {
    const { message } = req.query;

    if (!message) {
      console.error('❌ Message query parameter missing');
      return res.status(400).json(createErrorResponse(400, 'Message parameter is required'));
    }

    if (typeof message !== 'string') {
      console.error('❌ Message must be a string');
      return res.status(400).json(createErrorResponse(400, 'Message must be a string', { receivedType: typeof message }));
    }

    const parseResult = smsProcessor.parseMpesaSMS(message);

    console.log('✅ SMS parsing test completed:', JSON.stringify(parseResult, null, 2));
    return res.status(200).json({
      success: true,
      parseResult
    });

  } catch (error) {
    console.error('❌ Error testing SMS parsing:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

// POST endpoint to test SMS processing (for development/testing)
router.post('/test-process', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      console.error('❌ Message field missing in request body');
      return res.status(400).json(createErrorResponse(400, 'Message is required in request body', { receivedBody: req.body }));
    }

    if (typeof message !== 'string') {
      console.error('❌ Message must be a string');
      return res.status(400).json(createErrorResponse(400, 'Message must be a string', { receivedType: typeof message }));
    }

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(message);

    if (!parseResult.success) {
      console.error('❌ Failed to parse SMS message:', parseResult.error);
      return res.status(400).json(createErrorResponse(400, 'Invalid SMS message format', { error: parseResult.error }, message));
    }

    // Process the payment (dry run)
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);

    console.log('✅ SMS processing test completed:', JSON.stringify({ parseResult, processResult }, null, 2));
    return res.status(200).json({
      success: true,
      parseResult,
      processResult
    });

  } catch (error) {
    console.error('❌ Error testing SMS processing:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

// GET endpoint to retrieve unmatched transactions
router.get('/unmatched', authenticate, async (req, res) => {
  try {
    const result = await smsProcessor.getUnmatchedTransactions();

    if (!result.success) {
      console.error('❌ Failed to retrieve unmatched transactions:', result.error);
      return res.status(500).json(createErrorResponse(500, 'Failed to retrieve unmatched transactions', { error: result.error }));
    }

    console.log('✅ Retrieved unmatched transactions:', JSON.stringify(result.transactions, null, 2));
    return res.status(200).json({
      success: true,
      data: result.transactions
    });

  } catch (error) {
    console.error('❌ Error getting unmatched transactions:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

// GET endpoint to get payment summary for a debt
router.get('/summary/:debtId', authenticate, async (req, res) => {
  try {
    const { debtId } = req.params;

    if (!debtId) {
      console.error('❌ Debt ID missing in request');
      return res.status(400).json(createErrorResponse(400, 'Debt ID is required'));
    }

    if (typeof debtId !== 'string') {
      console.error('❌ Debt ID must be a string');
      return res.status(400).json(createErrorResponse(400, 'Debt ID must be a string', { receivedType: typeof debtId }));
    }

    const result = await smsProcessor.getPaymentSummary(debtId);

    if (!result.success) {
      console.error('❌ Failed to retrieve payment summary:', result.error);
      return res.status(500).json(createErrorResponse(500, 'Failed to retrieve payment summary', { error: result.error }));
    }

    console.log('✅ Payment summary retrieved:', JSON.stringify(result.summary, null, 2));
    return res.status(200).json({
      success: true,
      data: result.summary
    });

  } catch (error) {
    console.error('❌ Error getting payment summary:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

// POST endpoint to manually process a specific SMS message
router.post('/manual-process', authenticate, async (req, res) => {
  try {
    const { message, debtCode } = req.body;

    if (!message) {
      console.error('❌ SMS message missing in request body');
      return res.status(400).json(createErrorResponse(400, 'SMS message is required', { receivedBody: req.body }));
    }

    if (typeof message !== 'string') {
      console.error('❌ Message must be a string');
      return res.status(400).json(createErrorResponse(400, 'Message must be a string', { receivedType: typeof message }));
    }

    if (debtCode && typeof debtCode !== 'string') {
      console.error('❌ Debt code must be a string');
      return res.status(400).json(createErrorResponse(400, 'Debt code must be a string', { receivedType: typeof debtCode }));
    }

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(message);

    if (!parseResult.success) {
      console.error('❌ Failed to parse SMS message:', parseResult.error);
      return res.status(400).json(createErrorResponse(400, 'Invalid SMS message format', { error: parseResult.error }, message));
    }

    // Override account number if debtCode is provided
    if (debtCode) {
      parseResult.data.accountNumber = debtCode;
      console.log('🔄 Overriding account number with provided debtCode:', debtCode);
    }

    // Process the payment
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);

    console.log('✅ Manual SMS processing completed:', JSON.stringify({ parseResult, processResult }, null, 2));
    return res.status(200).json({
      success: true,
      parseResult,
      processResult
    });

  } catch (error) {
    console.error('❌ Error manually processing SMS:', error.message, error.stack);
    return res.status(500).json(createErrorResponse(500, 'Internal server error', { stack: error.stack }));
  }
});

module.exports = router;