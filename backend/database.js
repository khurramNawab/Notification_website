const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let pool = null;
let dbInstanceWrapper = null;

// Helper to convert SQLite ? to Postgres $1, $2, etc.
function convertQuery(sql) {
  let paramCount = 1;
  // Replace INSERT OR REPLACE with ON CONFLICT DO UPDATE
  let pgSql = sql.replace(/INSERT OR REPLACE INTO settings/gi, 'INSERT INTO settings');
  pgSql = pgSql.replace(/\?/g, () => `$${paramCount++}`);
  
  if (sql.toUpperCase().includes('INSERT OR REPLACE INTO settings')) {
    pgSql += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
  }
  
  return pgSql;
}

async function getDb() {
  if (dbInstanceWrapper) return dbInstanceWrapper;

  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.domxxlgfxiapnzfvjlmm:%28Msrassessment2026%29@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  dbInstanceWrapper = {
    run: async (sql, params = []) => {
      // Postgres needs BEGIN / COMMIT for transactions, SQLite also uses BEGIN TRANSACTION / COMMIT
      if (sql.trim().toUpperCase() === 'BEGIN TRANSACTION;') {
        await pool.query('BEGIN;');
        return { changes: 0 };
      }
      if (sql.trim().toUpperCase() === 'COMMIT;') {
        await pool.query('COMMIT;');
        return { changes: 0 };
      }
      if (sql.trim().toUpperCase() === 'ROLLBACK;') {
        await pool.query('ROLLBACK;');
        return { changes: 0 };
      }

      let queryStr = convertQuery(sql);
      let isInsert = queryStr.trim().toUpperCase().startsWith('INSERT INTO');
      
      if (isInsert && !queryStr.toUpperCase().includes('RETURNING') && !queryStr.toUpperCase().includes('ON CONFLICT')) {
        queryStr += ' RETURNING id';
      }

      try {
        const result = await pool.query(queryStr, params);
        let lastID = null;
        if (isInsert && result.rows && result.rows.length > 0 && result.rows[0].id) {
          lastID = result.rows[0].id;
        }
        return { lastID, changes: result.rowCount };
      } catch (e) {
        console.error('DB Run Error:', queryStr, params, e);
        throw e;
      }
    },
    get: async (sql, params = []) => {
      const result = await pool.query(convertQuery(sql), params);
      return result.rows[0];
    },
    all: async (sql, params = []) => {
      const result = await pool.query(convertQuery(sql), params);
      return result.rows;
    },
    exec: async (sql) => {
      // Exclude SQLite pragmas
      if (sql.includes('PRAGMA')) return;
      return pool.query(sql);
    }
  };

  // Initialize Postgres Schema
  await dbInstanceWrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      phone_number TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER,
      date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      client_or_consultant TEXT CHECK(client_or_consultant IN ('client', 'consultant')) NOT NULL,
      quotation_amount REAL DEFAULT 0,
      govt_fees REAL DEFAULT 0,
      prof_fees REAL DEFAULT 0,
      advance_amount REAL DEFAULT 0,
      payment_received REAL DEFAULT 0,
      pending_amount REAL DEFAULT 0,
      status TEXT CHECK(status IN ('complete', 'partial', 'pending', 'overdue')) NOT NULL,
      remark TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_history (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_mode TEXT CHECK(payment_mode IN ('cash', 'UPI', 'bank', 'cheque')) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER,
      reminder_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('sent', 'pending')) NOT NULL,
      channel TEXT CHECK(channel IN ('call', 'whatsapp', 'email')) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Set default settings if not exists
  const overdueDays = await dbInstanceWrapper.get("SELECT value FROM settings WHERE key = 'overdue_days_threshold'");
  if (!overdueDays) {
    await dbInstanceWrapper.run("INSERT INTO settings (key, value) VALUES ('overdue_days_threshold', '30') ON CONFLICT (key) DO NOTHING");
  }

  // Create default admin and staff users if users table is empty
  const userCount = await dbInstanceWrapper.get('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.count) === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('staff123', 10);
    
    await dbInstanceWrapper.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Admin User', 'admin@paytrack.com', adminHash, 'admin']
    );
    await dbInstanceWrapper.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Staff User', 'staff@paytrack.com', staffHash, 'staff']
    );
  }

  return dbInstanceWrapper;
}

module.exports = {
  getDb
};
