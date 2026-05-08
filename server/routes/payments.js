const express = require('express');
const { authenticate } = require('../middleware/auth');
const smsService = require('../services/sms');
const admin = require('../services/firebase-admin');
const db = admin.firestore();
const pdfParse = require('pdf-parse');
const formidable = require('formidable');
const fs = require('fs');
const { OpenAI } = require('openai');
const FormData = require('form-data');
const axios = require('axios');
const router = express.Router();
const PDFDocument = require('pdfkit');
const PDFTable = require('pdfkit-table');
// Approve manual payment (admin only - can be called via special endpoint)
router.post('/manual-approve/:debtId', async (req, res) => {
  try {
    const { debtId } = req.params;
    const { approvalCode } = req.body;
    
    // Simple approval code check (in production, use proper admin authentication)
    if (approvalCode !== 'SAMWEGA2024') {
      return res.status(401).json({ success: false, error: 'Invalid approval code' });
    }

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

router.post('/generate-pdf', authenticate, async (req, res) => {
  try {
    const { logs, stats } = req.body;

    if (!logs || !Array.isArray(logs) || !stats) {
      return res.status(400).json({ error: 'Invalid or missing logs or stats data' });
    }

    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
      }).format(amount);

    // Initialize PDFDocument
    const doc = new PDFDocument({ size: 'A4', margin: 35 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payment_logs_${new Date().toISOString().split('T')[0]}.pdf`
    );
    doc.pipe(res);

    // 🧾 Title
    doc.font('Helvetica-Bold')
      .fontSize(14)
      .text('Samwega Payment Logs Report', { align: 'center' });

    let y = 80;
    doc.moveTo(35, y).lineTo(560, y).strokeColor('#00695C').stroke();
    y += 15;

    // 📊 Summary
    doc.font('Helvetica').fontSize(8).fillColor('#333');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 35, y); y += 11;
    doc.text(`Total Logs: ${stats.total}`, 35, y); y += 11;
    doc.text(`Total Amount: ${formatCurrency(stats.totalAmount)}`, 35, y); y += 16;

    // 🧠 Table Header
    const headers = ['Account Number', 'Amount', 'Processed By', 'Date', 'Transaction Code'];

    // Tighter layout (more space for transaction column)
    const colX = [35, 125, 210, 325, 425];
    const colWidth = [85, 85, 110, 95, 150];

    // Header background
    doc.font('Helvetica-Bold').fontSize(8);
    doc.rect(35, y, 540, 18).fill('#00695C');
    doc.fillColor('white');
    headers.forEach((header, i) => {
      const align = i === 1 ? 'right' : 'left';
      const offset = i === 1 ? -2 : 4; // right-align Amount header properly
      doc.text(header, colX[i] + offset, y + 5, {
        width: colWidth[i] - 8,
        align,
      });
    });
    doc.fillColor('black');
    y += 20;

    // 🗂️ Table Data
    doc.font('Helvetica').fontSize(7.5);

    logs.forEach((log, index) => {
      if (y > 760) {
        doc.addPage();
        y = 45;

        // Redraw header
        doc.font('Helvetica-Bold').fontSize(8);
        doc.rect(35, y, 540, 18).fill('#00695C');
        doc.fillColor('white');
        headers.forEach((header, i) => {
          const align = i === 1 ? 'right' : 'left';
          const offset = i === 1 ? -2 : 4;
          doc.text(header, colX[i] + offset, y + 5, {
            width: colWidth[i] - 8,
            align,
          });
        });
        doc.fillColor('black');
        y += 20;
        doc.font('Helvetica').fontSize(7.5);
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(35, y, 540, 16).fill('#F9F9F9').fillColor('black');
      }

      const row = [
        log.accountNumber || 'N/A',
        formatCurrency(log.amount),
        log.createdBy || 'Unknown',
        log.processedAt
          ? new Date(log.processedAt).toLocaleDateString()
          : log.paymentDate
          ? new Date(log.paymentDate.seconds * 1000).toLocaleDateString()
          : 'N/A',
        log.transactionCode || 'N/A',
      ];

      row.forEach((cell, i) => {
        const align = i === 1 ? 'right' : 'left';
        const offset = i === 1 ? -2 : 4;
        doc.text(String(cell), colX[i] + offset, y + 4, {
          width: colWidth[i] - 8,
          align,
        });
      });

      y += 16;
    });

    // ✅ Footer
    if (y < 780) y += 20;
    doc.font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor('#666')
      .text(`Generated by Samwega System • ${new Date().toLocaleString()}`, 35, y, {
        align: 'center',
        width: 520,
      });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res
      .status(500)
      .json({ error: 'Failed to generate PDF', details: error.message });
  }
});















// Get all payment logs
router.get('/logs', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('payment_logs').get();
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching payment logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment logs' });
  }
});

// Verify a payment log
router.patch('/logs/:id/verify', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('payment_logs').doc(id).update({ verified: true });
    res.json({ success: true, message: 'Payment log verified successfully' });
  } catch (error) {
    console.error('Error verifying payment log:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment log' });
  }
});

// Verify and register transaction code
router.post('/verify-transaction', authenticate, async (req, res) => {
  try {
    const { transactionCode, amount, debtId } = req.body;
    const userId = req.user.uid;

    const parseTransactionCode = (code) => {
      const match = code.match(/^(.+?)(?:\((\d+(?:\.\d+)?)\))?$/);
      if (!match) return { baseCode: code.trim(), declaredTotal: null };
      return {
        baseCode: match[1].trim(),
        declaredTotal: match[2] ? parseFloat(match[2]) : null,
      };
    };

    const { baseCode, declaredTotal } = parseTransactionCode(transactionCode);
    const docRef = db.collection('manual-transactions').doc(baseCode);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const totalAmount = declaredTotal || amount;
      const newTransaction = {
        transactionCode: baseCode,
        totalAmount,
        remainingAmount: totalAmount - amount,
        usedAmounts: [
          {
            debtId,
            usedBy: userId,
            amount,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date(),
      };
      await docRef.set(newTransaction);
      return res.json({ success: true });
    }

    const data = docSnap.data();

    // If not a multi-debt transaction → reject re-use
    if (!data.totalAmount || data.totalAmount === data.usedAmounts[0]?.amount) {
      return res.status(400).json({ success: false, error: 'This transaction code has already been used.' });
    }

    // Multi-debt case
    if (data.remainingAmount < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient remaining balance in this transaction code.' });
    }

    // Update remaining amount and add usage
    await docRef.update({
      remainingAmount: data.remainingAmount - amount,
      usedAmounts: [
        ...data.usedAmounts,
        {
          debtId,
          usedBy: userId,
          amount,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Transaction verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;




