const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsProcessor = require('../services/smsProcessor');

const router = express.Router();

// POST endpoint to receive M-Pesa SMS messages
router.post('/mpesa', async (req, res) => {
  try {
    console.log('Received SMS webhook:', req.body);

    const { message, smsText, text, content } = req.body;
    
    // Extract SMS message from various possible field names
    const smsMessage = message || smsText || text || content;

    if (!smsMessage) {
      console.error('No SMS message provided in request body');
      return res.status(400).json({
        success: false,
        error: 'SMS message is required',
        receivedData: req.body
      });
    }

    console.log('Processing SMS message:', smsMessage);

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(smsMessage);
    
    if (!parseResult.success) {
      console.error('Failed to parse SMS message:', parseResult.error);
      return res.status(400).json({
        success: false,
        error: 'Invalid SMS message format',
        details: parseResult.error,
        originalMessage: smsMessage
      });
    }

    // Process the payment
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);

    if (processResult.success) {
      console.log('SMS payment processed successfully:', processResult);
      return res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        data: processResult
      });
    } else {
      console.error('Failed to process SMS payment:', processResult.error);
      return res.status(400).json({
        success: false,
        error: processResult.error,
        accountNumber: processResult.accountNumber
      });
    }

  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET endpoint to test SMS parsing (for development/testing)
router.get('/test-parse', authenticate, async (req, res) => {
  try {
    const { message } = req.query;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message parameter is required'
      });
    }

    const parseResult = smsProcessor.parseMpesaSMS(message);
    
    res.json({
      success: true,
      parseResult: parseResult
    });

  } catch (error) {
    console.error('Error testing SMS parsing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST endpoint to test SMS processing (for development/testing)
router.post('/test-process', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required in request body'
      });
    }

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(message);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SMS message format',
        details: parseResult.error
      });
    }

    // Process the payment (dry run - don't actually update debt)
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);
    
    res.json({
      success: true,
      parseResult: parseResult,
      processResult: processResult
    });

  } catch (error) {
    console.error('Error testing SMS processing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to retrieve unmatched transactions
router.get('/unmatched', authenticate, async (req, res) => {
  try {
    const result = await smsProcessor.getUnmatchedTransactions();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.transactions
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error getting unmatched transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to get payment summary for a debt
router.get('/summary/:debtId', authenticate, async (req, res) => {
  try {
    const { debtId } = req.params;
    
    if (!debtId) {
      return res.status(400).json({
        success: false,
        error: 'Debt ID is required'
      });
    }

    const result = await smsProcessor.getPaymentSummary(debtId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.summary
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error getting payment summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST endpoint to manually process a specific SMS message
router.post('/manual-process', authenticate, async (req, res) => {
  try {
    const { message, debtCode } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'SMS message is required'
      });
    }

    // Parse the SMS message
    const parseResult = smsProcessor.parseMpesaSMS(message);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid SMS message format',
        details: parseResult.error
      });
    }

    // If debtCode is provided, override the account number from SMS
    if (debtCode) {
      parseResult.data.accountNumber = debtCode;
      console.log('Overriding account number with provided debtCode:', debtCode);
    }

    // Process the payment
    const processResult = await smsProcessor.processSMSPayment(parseResult.data);
    
    res.json({
      success: true,
      parseResult: parseResult,
      processResult: processResult
    });

  } catch (error) {
    console.error('Error manually processing SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 