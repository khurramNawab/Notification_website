const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireAdmin } = require('./auth');

// Get settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (Admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  const { overdue_days_threshold } = req.body;
  if (!overdue_days_threshold || isNaN(overdue_days_threshold)) {
    return res.status(400).json({ error: 'Invalid overdue threshold value' });
  }

  try {
    const db = await getDb();
    await db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('overdue_days_threshold', ?)",
      [overdue_days_threshold.toString()]
    );

    // Recalculate ALL active transactions status based on new threshold!
    const transactions = await db.all("SELECT id, date, quotation_amount, advance_amount, payment_received FROM transactions WHERE is_archived = 0");
    for (const tx of transactions) {
      const quotation = parseFloat(tx.quotation_amount) || 0;
      const advance = parseFloat(tx.advance_amount) || 0;
      const received = parseFloat(tx.payment_received) || 0;
      const pending = quotation - advance - received;

      let status = 'pending';
      if (pending <= 0) {
        status = 'complete';
      } else {
        const txDate = new Date(tx.date);
        const today = new Date();
        const diffTime = today - txDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > parseInt(overdue_days_threshold)) {
          status = 'overdue';
        } else if (received > 0 || advance > 0) {
          status = 'partial';
        } else {
          status = 'pending';
        }
      }

      await db.run("UPDATE transactions SET status = ? WHERE id = ?", [status, tx.id]);
    }

    res.json({ message: 'Settings updated and transactions recalculated successfully' });
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
