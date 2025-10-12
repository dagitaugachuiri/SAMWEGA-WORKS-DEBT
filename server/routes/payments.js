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

// Generate PDF for payment logs
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
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=payment_logs_${new Date().toISOString().split('T')[0]}.pdf`
    );

    doc.pipe(res);

    // 🧾 Title Section
    doc.font('Helvetica-Bold')
      .fontSize(16)
      .text('Samwega Payment Logs Report', { align: 'center' });

    let y = 90;
    doc.moveTo(50, y).lineTo(550, y).strokeColor('#00695C').stroke();
    y += 20;

    // 📊 Summary Section
    doc.font('Helvetica').fontSize(10).fillColor('#333');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, y); y += 14;
    doc.text(`Total Logs: ${stats.total}`, 50, y); y += 14;
    doc.text(`Total Amount: ${formatCurrency(stats.totalAmount)}`, 50, y); y += 20;

    // 🧠 Table Header
    const headers = ['Account Number', 'Amount', 'Processed By', 'Date', 'Transaction Code'];

    // Adjusted column widths (more space for Transaction Code)
    const colX = [50, 150, 250, 370, 470];
    const colWidth = [100, 100, 120, 100, 150];

    // Header background
    doc.font('Helvetica-Bold').fontSize(10);
    doc.rect(50, y, 540, 22).fill('#00695C');
    doc.fillColor('white');
    headers.forEach((header, i) => {
      doc.text(header, colX[i] + 4, y + 6, {
        width: colWidth[i] - 8,
        align: 'left',
      });
    });
    doc.fillColor('black');
    y += 26;

    // 🗂️ Table Data
    doc.font('Helvetica').fontSize(9);

    logs.forEach((log, index) => {
      if (y > 760) {
        // Page break
        doc.addPage();
        y = 50;

        // Redraw header on new page
        doc.font('Helvetica-Bold').fontSize(10);
        doc.rect(50, y, 540, 22).fill('#00695C');
        doc.fillColor('white');
        headers.forEach((header, i) => {
          doc.text(header, colX[i] + 4, y + 6, {
            width: colWidth[i] - 8,
            align: 'left',
          });
        });
        doc.fillColor('black');
        y += 26;
        doc.font('Helvetica').fontSize(9);
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, y, 540, 20).fill('#F9F9F9').fillColor('black');
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

      // Render each cell (with wrapping for long text)
      row.forEach((cell, i) => {
        const textOptions = {
          width: colWidth[i] - 8,
          align: i === 1 ? 'right' : 'left',
        };
        doc.text(String(cell), colX[i] + 4, y + 5, textOptions);
      });

      y += 20;
    });

    // ✅ Footer
    if (y < 780) {
      y += 20;
    }
    doc.font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#666')
      .text(`Generated by Samwega System • ${new Date().toLocaleString()}`, 50, y, {
        align: 'center',
        width: 500,
      });

    // Finalize document
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res
      .status(500)
      .json({ error: 'Failed to generate PDF', details: error.message });
  }
});














module.exports = router;




