const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('./auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    
    // Get current month prefix 'YYYY-MM'
    const today = new Date();
    const currentMonthKey = today.toISOString().substring(0, 7); // 'YYYY-MM'

    // 1. KPI - Total Revenue this month (sum of payments in payment_history)
    const monthlyRevenue = await db.get(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payment_history WHERE payment_date LIKE ?",
      [`${currentMonthKey}%`]
    );

    // 2. KPI - Total Pending Amount (sum of pending_amount in active transactions)
    const totalPending = await db.get(
      "SELECT COALESCE(SUM(pending_amount), 0) as total FROM transactions WHERE is_archived = 0"
    );

    // 3. KPI - Active Clients count
    const activeClientsCount = await db.get(
      "SELECT COUNT(*) as count FROM clients WHERE is_archived = 0"
    );

    // 4. KPI - Overdue Transactions count
    const overdueCount = await db.get(
      "SELECT COUNT(*) as count FROM transactions WHERE status = 'overdue' AND is_archived = 0"
    );

    // 4b. KPI - Total Government Fees (all active transactions)
    const totalGovtFees = await db.get(
      "SELECT COALESCE(SUM(govt_fees), 0) as total FROM transactions WHERE is_archived = 0"
    );

    // 4c. KPI - Total Professional Fees (all active transactions)
    const totalProfFees = await db.get(
      "SELECT COALESCE(SUM(prof_fees), 0) as total FROM transactions WHERE is_archived = 0"
    );

    // 5. Monthly Revenue Trend (Last 6 Months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      const monthPrefix = d.toISOString().substring(0, 7); // 'YYYY-MM'
      months.push({ label: monthLabel, prefix: monthPrefix });
    }

    const trend = [];
    for (const m of months) {
      const rev = await db.get(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payment_history WHERE payment_date LIKE ?",
        [`${m.prefix}%`]
      );
      trend.push({
        month: m.label,
        amount: rev.total
      });
    }

    // 6. Status Breakdown (Complete, Partial, Pending, Overdue)
    const statusRows = await db.all(
      `SELECT status, COUNT(*) as count 
       FROM transactions 
       WHERE is_archived = 0 
       GROUP BY status`
    );
    
    const statuses = {
      complete: 0,
      partial: 0,
      pending: 0,
      overdue: 0
    };
    statusRows.forEach(row => {
      statuses[row.status] = row.count;
    });

    // 7. Follow-up lists (Outstanding payments grouped by age)
    // Overdue: Age > 30 days
    // Due This Week: Age between 24 and 30 days
    // Upcoming: Age < 24 days
    const activeTxs = await db.all(
      `SELECT t.*, c.company_name, c.client_name, c.phone_number 
       FROM transactions t
       JOIN clients c ON t.client_id = c.id
       WHERE t.pending_amount > 0 AND t.is_archived = 0 AND c.is_archived = 0
       ORDER BY t.date ASC`
    );

    const followUps = {
      overdue: [],
      due_this_week: [],
      upcoming: []
    };

    activeTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      const diffTime = today - txDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const txWithAge = { ...tx, age_days: diffDays };

      if (diffDays > 30) {
        followUps.overdue.push(txWithAge);
      } else if (diffDays >= 24) {
        followUps.due_this_week.push(txWithAge);
      } else {
        followUps.upcoming.push(txWithAge);
      }
    });

    // Recent 5 transactions
    const recentTransactions = await db.all(
      `SELECT t.*, c.company_name 
       FROM transactions t
       JOIN clients c ON t.client_id = c.id
       WHERE t.is_archived = 0
       ORDER BY t.date DESC, t.id DESC
       LIMIT 5`
    );

    res.json({
      kpis: {
        total_revenue_this_month: monthlyRevenue.total,
        total_pending: totalPending.total,
        total_clients: activeClientsCount.count,
        overdue_count: overdueCount.count,
        total_govt_fees: totalGovtFees.total,
        total_prof_fees: totalProfFees.total
      },
      revenue_trend: trend,
      status_breakdown: [
        { name: 'Complete', value: statuses.complete, color: '#0D9488' },
        { name: 'Partial', value: statuses.partial, color: '#b05e3d' },
        { name: 'Pending', value: statuses.pending + statuses.overdue, color: '#ba1a1a' }
      ],
      status_counts: statuses,
      follow_ups: followUps,
      recent_transactions: recentTransactions
    });

  } catch (err) {
    console.error('Failed to calculate dashboard data:', err);
    res.status(500).json({ error: 'Failed to aggregate dashboard analytics' });
  }
});

module.exports = router;
