const { getDb } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const db = await getDb();
  console.log('Seeding database...');

  // Reset database tables
  await db.exec(`
    DELETE FROM payment_history;
    DELETE FROM reminders;
    DELETE FROM transactions;
    DELETE FROM clients;
    DELETE FROM users;
    DELETE FROM settings;
  `);

  // Seed settings
  await db.run("INSERT INTO settings (key, value) VALUES ('overdue_days_threshold', '30')");

  // Seed Users
  const adminHash = await bcrypt.hash('admin123', 10);
  const staffHash = await bcrypt.hash('staff123', 10);

  await db.run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Admin User', 'admin@paytrack.com', adminHash, 'admin']
  );
  await db.run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Staff User', 'staff@paytrack.com', staffHash, 'staff']
  );

  console.log('Users seeded.');

  // Seed Clients
  const clientsData = [
    { company_name: 'Acme Corp Ltd.', client_name: 'John Doe', phone_number: '+91 98765 43210' },
    { company_name: 'Stark Industries', client_name: 'Pepper Potts', phone_number: '+91 91234 56789' },
    { company_name: 'Wayne Enterprises', client_name: 'Lucius Fox', phone_number: '+91 92233 44556' },
    { company_name: 'LexCorp', client_name: 'Mercy Graves', phone_number: '+91 93344 55667' },
    { company_name: 'TechVision Inc.', client_name: 'Sarah Smith', phone_number: '+91 94455 66778' },
    { company_name: 'Global Logistics', client_name: 'Mike Johnson', phone_number: '+91 95566 77889' },
    { company_name: 'Pioneer Retail', client_name: 'Emily Chen', phone_number: '+91 96677 88990' },
    { company_name: 'Sunrise Exports', client_name: 'Raj Patel', phone_number: '+91 97788 99001' },
    { company_name: 'Apex Builders', client_name: 'Lisa Wong', phone_number: '+91 98899 00112' },
    { company_name: 'Zenith Healthcare', client_name: 'Dr. Ahmed', phone_number: '+91 99900 11223' },
    { company_name: 'BlueWave Tech', client_name: 'Simon Clark', phone_number: '+91 90011 22334' },
    { company_name: 'Nexa Design', client_name: 'Anna Lee', phone_number: '+91 91122 33445' },
    { company_name: 'Urban Foods', client_name: 'David Kim', phone_number: '+91 92233 44556' }
  ];

  const clientIds = {};
  for (const client of clientsData) {
    const res = await db.run(
      'INSERT INTO clients (company_name, client_name, phone_number) VALUES (?, ?, ?)',
      [client.company_name, client.client_name, client.phone_number]
    );
    clientIds[client.company_name] = res.lastID;
  }

  console.log('Clients seeded.');

  // Helper to subtract days from current date
  function getPastDateString(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }

  // Transactions Data (mirrors excel rows)
  // Fields: client_id, date, service_type, client_or_consultant, quotation_amount, govt_fees, prof_fees, advance_amount, payment_received
  // status: auto-set
  const transactionsData = [
    {
      company: 'Acme Corp Ltd.',
      date: getPastDateString(10), // Recent
      service_type: 'GST Audit',
      client_or_consultant: 'client',
      quotation_amount: 45000,
      govt_fees: 20000,
      prof_fees: 25000,
      advance_amount: 10000,
      payment_received: 0,
      remark: 'Advance received, drafting audit report'
    },
    {
      company: 'TechVision Inc.',
      date: getPastDateString(22), // Recent
      service_type: 'Income Tax',
      client_or_consultant: 'client',
      quotation_amount: 15500,
      govt_fees: 0,
      prof_fees: 15500,
      advance_amount: 15500,
      payment_received: 0,
      remark: 'Full fee paid upfront'
    },
    {
      company: 'Global Logistics',
      date: getPastDateString(45), // Overdue (>30 days)
      service_type: 'ROC Filing',
      client_or_consultant: 'consultant',
      quotation_amount: 8000,
      govt_fees: 3000,
      prof_fees: 5000,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Follow up required for full payment'
    },
    {
      company: 'Pioneer Retail',
      date: getPastDateString(18), // Recent
      service_type: 'Audit',
      client_or_consultant: 'client',
      quotation_amount: 120000,
      govt_fees: 20000,
      prof_fees: 100000,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Filing pending approval'
    },
    {
      company: 'Sunrise Exports',
      date: getPastDateString(5), // Recent
      service_type: 'GST Returns',
      client_or_consultant: 'client',
      quotation_amount: 12000,
      govt_fees: 0,
      prof_fees: 12000,
      advance_amount: 12000,
      payment_received: 0,
      remark: 'Filing complete'
    },
    {
      company: 'Apex Builders',
      date: getPastDateString(12), // Recent
      service_type: 'Income Tax',
      client_or_consultant: 'client',
      quotation_amount: 35000,
      govt_fees: 0,
      prof_fees: 35000,
      advance_amount: 20000,
      payment_received: 0,
      remark: 'Filing completed, waiting for final balance'
    },
    {
      company: 'Zenith Healthcare',
      date: getPastDateString(50), // Overdue (>30 days)
      service_type: 'Audit',
      client_or_consultant: 'client',
      quotation_amount: 85000,
      govt_fees: 0,
      prof_fees: 85000,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Invoice sent, client checking accounts'
    },
    {
      company: 'BlueWave Tech',
      date: getPastDateString(8), // Recent
      service_type: 'ROC Filing',
      client_or_consultant: 'client',
      quotation_amount: 6500,
      govt_fees: 2500,
      prof_fees: 4000,
      advance_amount: 6500,
      payment_received: 0,
      remark: 'Annual return successfully filed'
    },
    {
      company: 'Nexa Design',
      date: getPastDateString(15), // Recent
      service_type: 'GST Reg.',
      client_or_consultant: 'client',
      quotation_amount: 5000,
      govt_fees: 1500,
      prof_fees: 3500,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Application uploaded, waiting for registration copy'
    },
    {
      company: 'Urban Foods',
      date: getPastDateString(40), // Overdue (>30 days)
      service_type: 'Audit',
      client_or_consultant: 'client',
      quotation_amount: 45000,
      govt_fees: 0,
      prof_fees: 45000,
      advance_amount: 25000,
      payment_received: 0,
      remark: 'Draft report sent. Follow up needed for balance.'
    },
    {
      company: 'Stark Industries',
      date: getPastDateString(32), // Overdue (>30 days)
      service_type: 'Audit',
      client_or_consultant: 'client',
      quotation_amount: 150000,
      govt_fees: 0,
      prof_fees: 150000,
      advance_amount: 50000,
      payment_received: 0,
      remark: 'Consultation over, balance outstanding'
    },
    {
      company: 'Wayne Enterprises',
      date: getPastDateString(2), // Very recent
      service_type: 'GST Returns',
      client_or_consultant: 'client',
      quotation_amount: 320000,
      govt_fees: 20000,
      prof_fees: 300000,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Quarterly filing started'
    },
    {
      company: 'LexCorp',
      date: getPastDateString(10), // Recent
      service_type: 'Consulting',
      client_or_consultant: 'client',
      quotation_amount: 45000,
      govt_fees: 0,
      prof_fees: 45000,
      advance_amount: 0,
      payment_received: 0,
      remark: 'Drafting agreements'
    }
  ];

  for (const tx of transactionsData) {
    const clientId = clientIds[tx.company];
    
    // Status calculation logic
    const quotation = tx.quotation_amount;
    const advance = tx.advance_amount;
    const received = tx.payment_received;
    const pending = quotation - advance - received;
    
    let status = 'pending';
    if (pending <= 0) {
      status = 'complete';
    } else {
      // Calculate age of date
      const txDate = new Date(tx.date);
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

    const res = await db.run(
      `INSERT INTO transactions (
        client_id, date, service_type, client_or_consultant, 
        quotation_amount, govt_fees, prof_fees, advance_amount, 
        payment_received, pending_amount, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId, tx.date, tx.service_type, tx.client_or_consultant,
        quotation, tx.govt_fees, tx.prof_fees, advance,
        received, pending, status, tx.remark
      ]
    );

    const transactionId = res.lastID;

    // Log initial advance payment to history if present
    if (advance > 0) {
      await db.run(
        `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
         VALUES (?, ?, ?, ?, ?)`,
        [transactionId, advance, tx.date, 'bank', 'Advance Payment Logged']
      );
    }

    // Seed some reminders for overdue/pending transactions
    if (status === 'overdue' || status === 'pending') {
      await db.run(
        `INSERT INTO reminders (transaction_id, reminder_date, status, channel)
         VALUES (?, ?, ?, ?)`,
        [transactionId, getPastDateString(1), 'pending', 'whatsapp']
      );
    }
  }

  // Let's add some secondary payments to test the partial status
  // Global Logistics (ID 3) is Overdue. Let's make Apex Builders (ID 6) have a secondary payment of 5000.
  const apexTx = await db.get("SELECT id, quotation_amount, advance_amount, payment_received FROM transactions WHERE client_id = ?", [clientIds['Apex Builders']]);
  if (apexTx) {
    const secondaryPayment = 5000;
    const newReceived = apexTx.payment_received + secondaryPayment;
    const newPending = apexTx.quotation_amount - apexTx.advance_amount - newReceived;
    
    // update transaction
    await db.run(
      "UPDATE transactions SET payment_received = ?, pending_amount = ?, status = 'partial' WHERE id = ?",
      [newReceived, newPending, apexTx.id]
    );

    // log payment history
    await db.run(
      `INSERT INTO payment_history (transaction_id, amount, payment_date, payment_mode, note)
       VALUES (?, ?, ?, ?, ?)`,
      [apexTx.id, secondaryPayment, getPastDateString(2), 'UPI', 'Second installment received']
    );
  }

  console.log('Transactions & Payments seeded.');
  console.log('Seeding complete successfully.');
  
  // Close DB instance if needed, or exit
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seeding failed:', err);
  });
}

module.exports = { seed };
