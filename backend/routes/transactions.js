const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const { getDb } = require('../database');
const { authenticateToken, requireAdmin } = require('./auth');

const upload = multer({ storage: multer.memoryStorage() });

// Helper to recalculate transaction pending amount and status on backend
async function recalculateTransaction(txId, dbInstance) {
  const db = dbInstance || await getDb();
  
  // Get transaction
  const tx = await db.get('SELECT * FROM transactions WHERE id = ?', [txId]);
  if (!tx) return;

  const quotation = parseFloat(tx.quotation_amount) || 0;
  const advance = parseFloat(tx.advance_amount) || 0;

  // Sum all payments from payment_history
  const paymentSum = await db.get(
    'SELECT COALESCE(SUM(amount), 0) as total FROM payment_history WHERE transaction_id = ?',
    [txId]
  );
  
  const payment_received = paymentSum.total;
  const pending_amount = quotation - advance - payment_received;

  // Get overdue days from settings
  const setting = await db.get("SELECT value FROM settings WHERE key = 'overdue_days_threshold'");
  const threshold = parseInt(setting ? setting.value : '30');

  let status = 'pending';
  if (pending_amount <= 0) {
    status = 'complete';
  } else {
    const txDate = new Date(tx.date);
    const today = new Date();
    const diffTime = today - txDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > threshold) {
      status = 'overdue';
    } else if (payment_received > 0 || advance > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }
  }

  await db.run(
    `UPDATE transactions SET 
       payment_received = ?, 
       pending_amount = ?, 
       status = ?, 
       updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [payment_received, pending_amount, status, txId]
  );

  return { payment_received, pending_amount, status };
}

// Fetch all transactions with server-side pagination, search, and filters
router.get('/', authenticateToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const { search, service_type, status, date_start, date_end } = req.query;

  try {
    const db = await getDb();
    
    // Build SQL query dynamically
    let query = `
      SELECT t.*, c.company_name, c.client_name, c.phone_number 
      FROM transactions t
      JOIN clients c ON t.client_id = c.id
      WHERE t.is_archived = 0 AND c.is_archived = 0
    `;
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM transactions t
      JOIN clients c ON t.client_id = c.id
      WHERE t.is_archived = 0 AND c.is_archived = 0
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const searchPattern = `%${search.trim()}%`;
      const searchSql = ` AND (c.company_name LIKE ? OR c.client_name LIKE ? OR c.phone_number LIKE ? OR t.service_type LIKE ?)`;
      query += searchSql;
      countQuery += searchSql;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (service_type && service_type !== 'All Services' && service_type !== 'all') {
      if (service_type.toLowerCase() === 'gst') {
        const gstPattern = '%GST%';
        query += ` AND t.service_type LIKE ?`;
        countQuery += ` AND t.service_type LIKE ?`;
        params.push(gstPattern);
        countParams.push(gstPattern);
      } else if (service_type.toLowerCase() === 'income tax') {
        const patterns = ['%Income Tax%', '%TDS%', '%PAN%', '%TAN%'];
        const groupSql = ` AND (t.service_type LIKE ? OR t.service_type LIKE ? OR t.service_type LIKE ? OR t.service_type LIKE ?)`;
        query += groupSql;
        countQuery += groupSql;
        params.push(...patterns);
        countParams.push(...patterns);
      } else if (service_type.toLowerCase() === 'audit') {
        const auditPatterns = ['%Audit%', '%Certification%'];
        const groupSql = ` AND (t.service_type LIKE ? OR t.service_type LIKE ?)`;
        query += groupSql;
        countQuery += groupSql;
        params.push(...auditPatterns);
        countParams.push(...auditPatterns);
      } else if (service_type.toLowerCase() === 'roc') {
        const rocPatterns = ['%ROC%', '%LLP%', '%Company Registration%', '%Company Formation%'];
        const groupSql = ` AND (t.service_type LIKE ? OR t.service_type LIKE ? OR t.service_type LIKE ? OR t.service_type LIKE ?)`;
        query += groupSql;
        countQuery += groupSql;
        params.push(...rocPatterns);
        countParams.push(...rocPatterns);
      } else {
        query += ` AND t.service_type = ?`;
        countQuery += ` AND t.service_type = ?`;
        params.push(service_type);
        countParams.push(service_type);
      }
    }

    if (status) {
      query += ` AND t.status = ?`;
      countQuery += ` AND t.status = ?`;
      params.push(status);
      countParams.push(status);
    }

    if (date_start && date_end) {
      query += ` AND t.date BETWEEN ? AND ?`;
      countQuery += ` AND t.date BETWEEN ? AND ?`;
      params.push(date_start, date_end);
      countParams.push(date_start, date_end);
    }

    // Sorting: default to newest date
    query += ` ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const transactions = await db.all(query, params);
    const countResult = await db.get(countQuery, countParams);

    res.json({
      transactions,
      pagination: {
        total: countResult.count,
        page,
        limit,
        pages: Math.ceil(countResult.count / limit)
      }
    });
  } catch (err) {
    console.error('Failed to query transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create transaction
router.post('/', authenticateToken, async (req, res) => {
  const {
    client_id,
    date,
    service_type,
    client_or_consultant,
    quotation_amount,
    govt_fees,
    prof_fees,
    advance_amount,
    remark
  } = req.body;

  if (!client_id || !date || !service_type || !client_or_consultant) {
    return res.status(400).json({ error: 'Client, Date, Service type, and Client/Consultant type are required' });
  }

  const quotation = parseFloat(quotation_amount) || 0;
  const govt = parseFloat(govt_fees) || 0;
  const prof = parseFloat(prof_fees) || 0;
  const advance = parseFloat(advance_amount) || 0;

  if (quotation < 0 || govt < 0 || prof < 0 || advance < 0) {
    return res.status(400).json({ error: 'Amounts cannot be negative' });
  }

  try {
    const db = await getDb();
    
    // Initial fields
    const pending_amount = quotation - advance;
    
    // Get default overdue days threshold
    const setting = await db.get("SELECT value FROM settings WHERE key = 'overdue_days_threshold'");
    const threshold = parseInt(setting ? setting.value : '30');

    let status = 'pending';
    if (pending_amount <= 0) {
      status = 'complete';
    } else {
      const txDate = new Date(date);
      const today = new Date();
      const diffTime = today - txDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > threshold) {
        status = 'overdue';
      } else if (advance > 0) {
        status = 'partial';
      } else {
        status = 'pending';
      }
    }

    const result = await db.run(
      `INSERT INTO transactions (
        client_id, date, service_type, client_or_consultant, 
        quotation_amount, govt_fees, prof_fees, advance_amount, 
        payment_received, pending_amount, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        client_id, date, service_type.trim(), client_or_consultant,
        quotation, govt, prof, advance, pending_amount, status, remark ? remark.trim() : ''
      ]
    );

    const txId = result.lastID;

    // Log the advance payment into payment history
    if (advance > 0) {
      await db.run(
        `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
         VALUES (?, ?, ?, ?, ?)`,
        [txId, advance, date, 'bank', 'Advance Payment Logged on Creation']
      );
    }

    const newTx = await db.get('SELECT * FROM transactions WHERE id = ?', [txId]);
    res.status(201).json(newTx);
  } catch (err) {
    console.error('Failed to create transaction:', err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    date,
    service_type,
    client_or_consultant,
    quotation_amount,
    govt_fees,
    prof_fees,
    advance_amount,
    remark
  } = req.body;

  if (!date || !service_type || !client_or_consultant) {
    return res.status(400).json({ error: 'Date, Service type, and Client/Consultant tag are required' });
  }

  const quotation = parseFloat(quotation_amount) || 0;
  const govt = parseFloat(govt_fees) || 0;
  const prof = parseFloat(prof_fees) || 0;
  const advance = parseFloat(advance_amount) || 0;

  if (quotation < 0 || govt < 0 || prof < 0 || advance < 0) {
    return res.status(400).json({ error: 'Amounts cannot be negative' });
  }

  try {
    const db = await getDb();
    
    // Check if transaction exists
    const existing = await db.get('SELECT id, advance_amount FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update main attributes first
    await db.run(
      `UPDATE transactions SET 
         date = ?, service_type = ?, client_or_consultant = ?, 
         quotation_amount = ?, govt_fees = ?, prof_fees = ?, 
         advance_amount = ?, remark = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        date, service_type.trim(), client_or_consultant,
        quotation, govt, prof, advance, remark ? remark.trim() : '', id
      ]
    );

    // If advance amount changed, check or adjust payment history for advance.
    // To simplify: we can insert/update the advance payment log.
    // Let's find the initial advance payment
    const advanceLog = await db.get(
      "SELECT id FROM payment_history WHERE transaction_id = ? AND note LIKE '%Advance Payment%'",
      [id]
    );
    
    if (advance > 0) {
      if (advanceLog) {
        await db.run(
          "UPDATE payment_history SET amount = ?, payment_date = ? WHERE id = ?",
          [advance, date, advanceLog.id]
        );
      } else {
        await db.run(
          `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
           VALUES (?, ?, ?, ?, ?)`,
          [id, advance, date, 'bank', 'Advance Payment Logged on Update']
        );
      }
    } else {
      // If advance was updated to 0, delete the advance log
      if (advanceLog) {
        await db.run("DELETE FROM payment_history WHERE id = ?", [advanceLog.id]);
      }
    }

    // Now recalculate pending_amount & status on backend based on payment logs!
    const stats = await recalculateTransaction(id, db);
    
    const updatedTx = await db.get('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json(updatedTx);
  } catch (err) {
    console.error('Failed to update transaction:', err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Log manual payments (Add Payment)
router.post('/:id/payments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { amount, payment_date, payment_mode, note } = req.body;

  if (!amount || !payment_date || !payment_mode) {
    return res.status(400).json({ error: 'Amount, Date, and Mode are required' });
  }

  const pAmount = parseFloat(amount) || 0;
  if (pAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero' });
  }

  try {
    const db = await getDb();
    const tx = await db.get('SELECT id FROM transactions WHERE id = ?', [id]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Save payment log
    await db.run(
      `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
       VALUES (?, ?, ?, ?, ?)`,
      [id, pAmount, payment_date, payment_mode, note ? note.trim() : '']
    );

    // Recalculate transaction
    const stats = await recalculateTransaction(id, db);

    res.status(201).json({ message: 'Payment recorded successfully', stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log payment' });
  }
});

// Soft Delete transaction (Admin Only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const tx = await db.get('SELECT id FROM transactions WHERE id = ?', [id]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await db.run('UPDATE transactions SET is_archived = 1 WHERE id = ?', [id]);
    res.json({ message: 'Transaction archived successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Generate PDF Invoice
router.get('/:id/invoice', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const tx = await db.get(
      `SELECT t.*, c.company_name, c.client_name, c.phone_number 
       FROM transactions t 
       JOIN clients c ON t.client_id = c.id 
       WHERE t.id = ? AND t.is_archived = 0`,
      [id]
    );

    if (!tx) {
      return res.status(404).json({ error: 'Invoice details not found' });
    }

    const doc = new PDFDocument({ margin: 50 });
    
    // Set headers for response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${id}.pdf`);
    
    doc.pipe(res);

    // Document Header / Letterhead
    doc.fillColor('#00685f').fontSize(24).font('Helvetica-Bold').text('PAYTRACK CRM', { align: 'left' });
    doc.fontSize(10).fillColor('#565e74').text('Consultancy & Billing Suite', { align: 'left' });
    doc.moveDown();

    // Horizontal line
    doc.moveTo(50, 95).lineTo(550, 95).stroke('#bcc9c6');
    doc.moveDown(2);

    // Invoice Details
    doc.fillColor('#0b1c30').fontSize(14).text(`INVOICE FOR: ${tx.service_type.toUpperCase()}`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#0b1c30')
       .text(`Invoice ID: #INV-${1000 + tx.id}`)
       .text(`Engagement Date: ${tx.date}`)
       .text(`Due Status: ${tx.status.toUpperCase()}`);
    doc.moveDown();

    // Client details
    doc.text('CLIENT DETAILS:', { font: 'Helvetica-Bold', underline: true });
    doc.text(`Company Name: ${tx.company_name}`);
    doc.text(`Primary Contact: ${tx.client_name}`);
    doc.text(`Phone: ${tx.phone_number || '-'}`);
    doc.moveDown(2);

    // Billing Breakdown Table Header
    doc.fillColor('#eff4ff').rect(50, 240, 500, 20).fill();
    doc.fillColor('#00685f').fontSize(10).font('Helvetica-Bold')
       .text('DESCRIPTION', 60, 245)
       .text('AMOUNT (INR)', 450, 245, { align: 'right' });
    
    doc.moveDown(1.5);
    let currentY = 270;

    // Fees rows
    doc.fillColor('#0b1c30').font('Helvetica');
    
    // Row 1: Professional fees
    doc.text('Professional Consultancy Fees', 60, currentY);
    doc.text(`INR ${tx.prof_fees.toLocaleString()}`, 450, currentY, { align: 'right' });
    currentY += 20;

    // Row 2: Government fees
    doc.text('Government Filing & Registration Fees', 60, currentY);
    doc.text(`INR ${tx.govt_fees.toLocaleString()}`, 450, currentY, { align: 'right' });
    currentY += 20;

    // Line
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke('#bcc9c6');
    currentY += 10;

    // Total Quotation
    doc.font('Helvetica-Bold');
    doc.text('Total Quotation Amount (A)', 60, currentY);
    doc.text(`INR ${tx.quotation_amount.toLocaleString()}`, 450, currentY, { align: 'right' });
    currentY += 20;

    // Advance
    doc.text('Less: Advance Paid (B)', 60, currentY);
    doc.text(`INR ${tx.advance_amount.toLocaleString()}`, 450, currentY, { align: 'right' });
    currentY += 20;

    // Paid
    doc.text('Less: Payments Received (C)', 60, currentY);
    doc.text(`INR ${tx.payment_received.toLocaleString()}`, 450, currentY, { align: 'right' });
    currentY += 25;

    // Highlight Box for Outstanding
    doc.fillColor('#ffdad6').rect(50, currentY, 500, 30).fill();
    doc.fillColor('#ba1a1a').font('Helvetica-Bold').fontSize(12)
       .text('TOTAL OUTSTANDING BALANCE DUE (A - B - C)', 60, currentY + 10)
       .text(`INR ${tx.pending_amount.toLocaleString()}`, 450, currentY + 10, { align: 'right' });

    // Remarks
    if (tx.remark) {
      doc.moveDown(4);
      doc.fillColor('#0b1c30').fontSize(10).font('Helvetica-Bold').text('Remarks:', 50);
      doc.font('Helvetica').text(tx.remark);
    }

    // Footer
    doc.moveDown(4);
    doc.fontSize(8).fillColor('#3d4947').text('Generated by PayTrack CRM Ledger. This is a computer generated document, no signature required.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

// Export transactions to Excel matching CA Firm sheet column order
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    
    // Fetch all active transactions
    const rows = await db.all(
      `SELECT t.*, c.company_name, c.client_name, c.phone_number 
       FROM transactions t
       JOIN clients c ON t.client_id = c.id
       WHERE t.is_archived = 0 AND c.is_archived = 0
       ORDER BY t.date DESC`
    );

    // Map rows to Excel structure
    // Date, Company Name, Client Name, Number, Service, Client/Cons, Quotation, Govt Fees, Prof Fees, Advance, Pending Amount, Payment Received, Remark
    const excelRows = rows.map(r => ({
      'Date': r.date,
      'Company Name': r.company_name,
      'Client Name': r.client_name,
      'Number': r.phone_number,
      'Service': r.service_type,
      'Client/Cons': r.client_or_consultant,
      'Quotation': r.quotation_amount,
      'Govt Fees': r.govt_fees,
      'Prof Fees': r.prof_fees,
      'Advance': r.advance_amount,
      'Pending Amount': r.pending_amount,
      'Payment Received': r.payment_received,
      'Remark': r.remark
    }));

    const worksheet = xlsx.utils.json_to_sheet(excelRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Transactions_Export.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export spreadsheet' });
  }
});

// Import transactions from Excel - Phase 1: Upload and Preview with Validation
router.post('/import-preview', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No Excel file uploaded' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet);

    const validatedRows = [];
    let rowNum = 1;

    for (const row of rawRows) {
      rowNum++;
      const errors = [];
      
      const company_name = row['Company Name'] || '';
      const client_name = row['Client Name'] || '';
      const date = row['Date'] || '';
      const service_type = row['Service'] || '';
      const client_or_consultant = (row['Client/Cons'] || '').toString().toLowerCase().trim();
      const quotation_amount = parseFloat(row['Quotation']) || 0;
      const govt_fees = parseFloat(row['Govt Fees']) || 0;
      const prof_fees = parseFloat(row['Prof Fees']) || 0;
      const advance_amount = parseFloat(row['Advance']) || 0;
      const payment_received = parseFloat(row['Payment Received']) || 0;
      const phone_number = row['Number'] || '';
      const remark = row['Remark'] || '';

      // Validation
      if (!company_name) errors.push('Company Name is required');
      if (!client_name) errors.push('Client Name is required');
      if (!date) errors.push('Date is required');
      if (!service_type) errors.push('Service type is required');
      if (client_or_consultant !== 'client' && client_or_consultant !== 'consultant') {
        errors.push("Client/Cons must be 'client' or 'consultant'");
      }
      if (quotation_amount < 0) errors.push('Quotation amount cannot be negative');
      if (govt_fees < 0) errors.push('Govt fees cannot be negative');
      if (prof_fees < 0) errors.push('Prof fees cannot be negative');
      if (advance_amount < 0) errors.push('Advance amount cannot be negative');
      if (payment_received < 0) errors.push('Payment Received cannot be negative');

      validatedRows.push({
        rowNum,
        data: {
          company_name,
          client_name,
          phone_number,
          date,
          service_type,
          client_or_consultant,
          quotation_amount,
          govt_fees,
          prof_fees,
          advance_amount,
          payment_received,
          remark
        },
        isValid: errors.length === 0,
        errors
      });
    }

    res.json({ rows: validatedRows });
  } catch (err) {
    console.error('Import preview failed:', err);
    res.status(500).json({ error: 'Failed to process Excel spreadsheet preview' });
  }
});

// Import transactions from Excel - Phase 2: Confirm Commit
router.post('/import-commit', authenticateToken, async (req, res) => {
  const { rows } = req.body; // Array of validated row objects
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No validated rows to commit' });
  }

  try {
    const db = await getDb();
    
    // Begin transaction for safety
    await db.run('BEGIN TRANSACTION;');

    for (const r of rows) {
      if (!r.isValid) continue;

      const data = r.data;
      
      // 1. Find or create client
      let client = await db.get(
        'SELECT id FROM clients WHERE LOWER(company_name) = ? AND is_archived = 0',
        [data.company_name.toLowerCase().trim()]
      );

      let clientId;
      if (client) {
        clientId = client.id;
      } else {
        const cRes = await db.run(
          'INSERT INTO clients (company_name, client_name, phone_number) VALUES (?, ?, ?)',
          [data.company_name.trim(), data.client_name.trim(), data.phone_number ? data.phone_number.toString().trim() : '']
        );
        clientId = cRes.lastID;
      }

      // 2. Insert transaction
      const quotation = parseFloat(data.quotation_amount) || 0;
      const advance = parseFloat(data.advance_amount) || 0;
      const received = parseFloat(data.payment_received) || 0;
      const pending = quotation - advance - received;

      // Status
      let status = 'pending';
      if (pending <= 0) {
        status = 'complete';
      } else {
        const txDate = new Date(data.date);
        const today = new Date();
        const diffTime = today - txDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 30) {
          status = 'overdue';
        } else if (received > 0 || advance > 0) {
          status = 'partial';
        } else {
          status = 'pending';
        }
      }

      const txRes = await db.run(
        `INSERT INTO transactions (
          client_id, date, service_type, client_or_consultant,
          quotation_amount, govt_fees, prof_fees, advance_amount,
          payment_received, pending_amount, status, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId, data.date, data.service_type, data.client_or_consultant,
          quotation, data.govt_fees, data.prof_fees, advance,
          received, pending, status, data.remark
        ]
      );

      const txId = txRes.lastID;

      // 3. Log advance payment to history if present
      if (advance > 0) {
        await db.run(
          `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
           VALUES (?, ?, ?, ?, ?)`,
          [txId, advance, data.date, 'bank', 'Advance Payment Logged from Import']
        );
      }

      // 4. Log subsequent payment received to history if present
      if (received > 0) {
        await db.run(
          `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
           VALUES (?, ?, ?, ?, ?)`,
          [txId, received, data.date, 'bank', 'Subsequent Payment Logged from Import']
        );
      }
    }

    await db.run('COMMIT;');
    res.json({ message: 'Excel spreadsheet rows successfully imported' });
  } catch (err) {
    console.error('Import commit error:', err);
    try {
      await db.run('ROLLBACK;');
    } catch (_) {}
    res.status(500).json({ error: 'Failed to import records' });
  }
});

// Logs a follow up reminder
router.post('/:id/reminders', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { channel, reminder_date } = req.body;

  if (!channel || !reminder_date) {
    return res.status(400).json({ error: 'Channel and date are required' });
  }

  try {
    const db = await getDb();
    
    // Save to DB
    await db.run(
      `INSERT INTO reminders (transaction_id, reminder_date, status, channel)
       VALUES (?, ?, 'sent', ?)`,
      [id, reminder_date, channel]
    );

    // Call notification stub (simulating external WhatsApp/SMS service)
    const tx = await db.get(
      `SELECT t.*, c.company_name, c.client_name, c.phone_number 
       FROM transactions t 
       JOIN clients c ON t.client_id = c.id 
       WHERE t.id = ?`,
      [id]
    );

    console.log(`[STUB NOTIFICATION] Sent ${channel} reminder to client ${tx.client_name} at ${tx.phone_number} for outstanding balance of INR ${tx.pending_amount}`);

    res.json({ message: 'Reminder triggered and logged successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record reminder' });
  }
});

module.exports = router;
