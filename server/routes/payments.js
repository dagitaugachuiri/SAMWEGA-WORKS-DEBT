const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsService = require('../services/sms');
const { getFirestore, getFirestoreApp } = require('../services/firebase');
const pdfParse = require('pdf-parse');
const formidable = require('formidable');
const fs = require('fs');
const { OpenAI } = require('openai');
const FormData = require('form-data');
const axios = require('axios');
const router = express.Router();

// Approve manual payment (admin only - can be called via special endpoint)
router.post('/manual-approve/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { approvalCode } = req.body;
    
    // Simple approval code check (in production, use proper admin authentication)
    if (approvalCode !== 'SAMWEGA2024') {
      return res.status(401).json({ success: false, error: 'Invalid approval code' });
    }

    const db = getFirestore();
    const debtDoc = await db.collection('debts').doc(debtId).get();

    if (!debtDoc.exists) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    await debtDoc.ref.update({ 
      manualPaymentApproved: true,
      manualRequestPending: false,
      approvedAt: new Date()
    });

    res.json({ success: true, message: 'Manual payment approved' });
  } catch (error) {
    console.error('Manual payment approval error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve manual payment' });
  }
});

// Request manual payment approval
router.post('/manual-request', authenticate, async (req, res) => {
  try {
    const { debtId } = req.body;
    const db = getFirestore();
    const debtDoc = await db.collection('debts').doc(debtId).get();

    if (!debtDoc.exists) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    const debt = debtDoc.data();

    if (debt.manualRequestPending) {
      return res.status(400).json({ success: false, error: 'Manual approval already requested' });
    }

    // Send SMS alert with debt details
    const formatCurrency = (amount) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    const smsMessage = `🔴 MANUAL PAYMENT REQUEST\n\nDebt: #${debt.debtCode}\nStore: ${debt.store.name}\nOwner: ${debt.storeOwner.name}\nPhone: ${debt.storeOwner.phoneNumber}\nAmount: ${formatCurrency(debt.amount)}\nOutstanding: ${formatCurrency(debt.remainingAmount || debt.amount)}\n\nUser requesting manual payment processing.`;
    
    await smsService.sendSMS('+254743466032', smsMessage, req.user.uid, debtId);

    // Update debt document
    await debtDoc.ref.update({ manualRequestPending: true });

    res.json({ success: true, message: 'Manual payment request sent' });
  } catch (error) {
    console.error('Manual payment request error:', error);
    res.status(500).json({ success: false, error: 'Failed to request manual approval' });
  }
});

// Get payment instructions for a debt
router.get('/instructions/:debtCode', authenticate, async (req, res) => {
  try {
    const { debtCode } = req.params;
    
    // Get debt details
    const db = getFirestore();
    const debtQuery = await db.collection('debts')
      .where('debtCode', '==', debtCode)
      .limit(1)
      .get();

    if (debtQuery.empty) {
      return res.status(404).json({ success: false, error: 'Debt not found' });
    }

    const debt = debtQuery.docs[0].data();
    const remainingAmount = debt.remainingAmount || debt.amount;

    // Generate payment instructions
    const instructions = {
      paybill: {
        number: '123456', // Default paybill number
        accountNumber: debtCode,
        amount: remainingAmount,
        instructions: [
          `Go to M-Pesa on your phone`,
          `Select "Lipa na M-Pesa"`,
          `Select "Pay Bill"`,
          `Enter Business Number: 123456`,
          `Enter Account Number: ${debtCode}`,
          `Enter Amount: ${remainingAmount}`,
          `Enter your M-Pesa PIN to complete`
        ]
      },
      message: `To pay: Go to M-Pesa > Lipa na M-Pesa > Pay Bill > Business No: 123456 > Account: ${debtCode} > Amount: KES ${remainingAmount}`
    };

    res.json({
      success: true,
      data: {
        debt: debt,
        instructions: instructions
      }
    });
  } catch (error) {
    console.error('Error getting payment instructions:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment instructions' });
  }
});












const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Add to .env file
});

router.post('/process-statement', authenticate, async (req, res) => {
  let file = null; // Declare file in outer scope for cleanup
  try {
    const form = new formidable.IncomingForm({
      keepExtensions: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const bank = fields.bank?.[0];
    const logs = JSON.parse(fields.logs?.[0] || '[]');
    file = files.file?.[0]; // Assign file for cleanup

    console.log(`Processing request - Bank: ${bank}, Logs count: ${logs.length}, File size: ${file.size} bytes`);
    if (!bank || bank !== 'Equity' || !file) {
      return res.status(400).json({ success: false, error: 'Invalid bank or missing file' });
    }

    // Upload file to OpenAI
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.filepath), { filename: file.originalFilename });
    formData.append('purpose', 'assistants'); // Still required for file upload

    const uploadResponse = await axios.post('https://api.openai.com/v1/files', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    const fileId = uploadResponse.data.id;
    console.log(`File uploaded to OpenAI, ID: ${fileId}`);

    // Prepare prompt for chat completion
    const prompt = `
      You are a transaction verification assistant. Analyze the uploaded PDF bank statement from Equity Bank (file ID: ${fileId}).
      Match transactions against the provided JSON logs: ${JSON.stringify(logs)}.
      Output a structured JSON: { "success": true, "matches": [{ "logId": "1", "verified": true, "details": "Matched amount 100 on date X" }], "unmatched": ["logIds"], "summary": "X matches found" }.
      Ignore non-transaction data and focus on amounts, codes, or references.
    `;

    // Call chat completion with file context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'file', file_id: fileId }, // Reference the uploaded file
          ],
        },
      ],
      response_format: { type: 'json_object' }, // Ensure JSON output
    });

    const result = JSON.parse(completion.choices[0].message.content);
    console.log('Verification result:', result);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (file && file.filepath) fs.unlinkSync(file.filepath); // Clean up temp file if exists
  }
});
module.exports = router;




