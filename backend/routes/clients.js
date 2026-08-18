const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireAdmin } = require('./auth');

// List clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    // Fetch all non-archived clients
    const clients = await db.all('SELECT * FROM clients WHERE is_archived = 0 ORDER BY company_name ASC');
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get client profile
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    
    // Fetch client details
    const client = await db.get('SELECT * FROM clients WHERE id = ? AND is_archived = 0', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Fetch transactions
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE client_id = ? AND is_archived = 0 ORDER BY date DESC',
      [id]
    );

    // Calculate billing summary
    // Billed = sum(quotation_amount)
    // Received = sum(advance_amount) + sum(payment_received)
    // Pending = sum(pending_amount)
    const summary = await db.get(
      `SELECT 
        COALESCE(SUM(quotation_amount), 0) as total_billed,
        COALESCE(SUM(advance_amount + payment_received), 0) as total_received,
        COALESCE(SUM(pending_amount), 0) as total_pending
       FROM transactions 
       WHERE client_id = ? AND is_archived = 0`,
      [id]
    );

    // Fetch payment history
    const payments = await db.all(
      `SELECT ph.*, t.service_type, t.date as tx_date 
       FROM payment_history ph
       JOIN transactions t ON ph.transaction_id = t.id
       WHERE t.client_id = ? AND t.is_archived = 0
       ORDER BY ph.payment_date DESC, ph.id DESC`,
      [id]
    );

    res.json({
      client,
      transactions,
      summary,
      payments
    });
  } catch (err) {
    console.error('Failed to fetch client profile:', err);
    res.status(500).json({ error: 'Failed to fetch client profile' });
  }
});

// Create client
router.post('/', authenticateToken, async (req, res) => {
  const { company_name, client_name, phone_number } = req.body;

  if (!company_name || !client_name) {
    return res.status(400).json({ error: 'Company name and client name are required' });
  }

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO clients (company_name, client_name, phone_number) VALUES (?, ?, ?)',
      [company_name.trim(), client_name.trim(), phone_number ? phone_number.trim() : '']
    );

    const newClient = await db.get('SELECT * FROM clients WHERE id = ?', [result.lastID]);
    res.status(201).json(newClient);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { company_name, client_name, phone_number } = req.body;

  if (!company_name || !client_name) {
    return res.status(400).json({ error: 'Company name and client name are required' });
  }

  try {
    const db = await getDb();
    await db.run(
      'UPDATE clients SET company_name = ?, client_name = ?, phone_number = ? WHERE id = ?',
      [company_name.trim(), client_name.trim(), phone_number ? phone_number.trim() : '', id]
    );

    const updated = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Archive client (soft delete) - Admin only
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    
    // Check if client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Soft delete client
    await db.run('UPDATE clients SET is_archived = 1 WHERE id = ?', [id]);
    
    // Soft delete all transactions of this client
    await db.run('UPDATE transactions SET is_archived = 1 WHERE client_id = ?', [id]);

    res.json({ message: 'Client and their transactions archived successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive client' });
  }
});

module.exports = router;
