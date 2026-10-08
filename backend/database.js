const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let dbInstanceWrapper = null;

// Helper to convert SQLite ? to Postgres $1, $2, etc.
function convertQuery(sql) {
  let paramCount = 1;
  let pgSql = sql.replace(/INSERT OR REPLACE INTO settings/gi, 'INSERT INTO settings');
  pgSql = pgSql.replace(/\?/g, () => `$${paramCount++}`);
  
  if (sql.toUpperCase().includes('INSERT OR REPLACE INTO settings')) {
    pgSql += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
  }
  
  return pgSql;
}

// SQLite wrapper function
function initSqliteDb() {
  const dbPath = path.resolve(__dirname, 'paytrack.db');
  console.log(`[DATABASE] Connecting to local SQLite database at: ${dbPath}`);
  const db = new sqlite3.Database(dbPath);

  const sqliteWrapper = {
    isSqlite: true,
    run: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    },
    all: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    },
    exec: (sql) => {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };

  return sqliteWrapper;
}

// Postgres wrapper function
async function tryInitPostgres(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  // Test connection
  await pool.query('SELECT 1');

  const pgWrapper = {
    isSqlite: false,
    run: async (sql, params = []) => {
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
      if (sql.includes('PRAGMA')) return;
      return pool.query(sql);
    }
  };

  return pgWrapper;
}

async function getDb() {
  if (dbInstanceWrapper) return dbInstanceWrapper;

  const dbUrl = process.env.DATABASE_URL;
  let useSqlite = process.env.USE_SQLITE === 'true';

  if (!useSqlite && dbUrl && !dbUrl.includes('placeholder')) {
    try {
      console.log('[DATABASE] Attempting Postgres/Supabase connection...');
      dbInstanceWrapper = await tryInitPostgres(dbUrl);
      console.log('[DATABASE] Successfully connected to Postgres/Supabase!');
    } catch (pgErr) {
      console.warn('[DATABASE] Postgres connection failed or unreachable:', pgErr.message);
      console.log('[DATABASE] Falling back automatically to local SQLite database...');
      dbInstanceWrapper = initSqliteDb();
    }
  } else {
    dbInstanceWrapper = initSqliteDb();
  }

  // Initialize Schema
  const isSqlite = dbInstanceWrapper.isSqlite;
  const serialType = isSqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
  const autoTimestamp = isSqlite ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';

  await dbInstanceWrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${serialType},
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
      created_at TIMESTAMP DEFAULT ${autoTimestamp}
    );

    CREATE TABLE IF NOT EXISTS clients (
      id ${serialType},
      company_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      phone_number TEXT,
      is_archived INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT ${autoTimestamp}
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id ${serialType},
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
      created_at TIMESTAMP DEFAULT ${autoTimestamp},
      updated_at TIMESTAMP DEFAULT ${autoTimestamp},
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_history (
      id ${serialType},
      transaction_id INTEGER,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_mode TEXT CHECK(payment_mode IN ('cash', 'UPI', 'bank', 'cheque')) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT ${autoTimestamp},
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id ${serialType},
      transaction_id INTEGER,
      reminder_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('sent', 'pending')) NOT NULL,
      channel TEXT CHECK(channel IN ('call', 'whatsapp', 'email')) NOT NULL,
      created_at TIMESTAMP DEFAULT ${autoTimestamp},
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings
  const overdueDays = await dbInstanceWrapper.get("SELECT value FROM settings WHERE key = 'overdue_days_threshold'");
  if (!overdueDays) {
    if (isSqlite) {
      await dbInstanceWrapper.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('overdue_days_threshold', '30')");
    } else {
      await dbInstanceWrapper.run("INSERT INTO settings (key, value) VALUES ('overdue_days_threshold', '30') ON CONFLICT (key) DO NOTHING");
    }
  }

  // Ensure Admin User with Admin@741 password exists
  const adminHash = await bcrypt.hash('Admin@741', 10);
  const staffHash = await bcrypt.hash('staff123', 10);

  const adminUser = await dbInstanceWrapper.get("SELECT id FROM users WHERE LOWER(email) = 'admin@paytrack.com' OR role = 'admin'");
  if (!adminUser) {
    await dbInstanceWrapper.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Admin User', 'admin@paytrack.com', adminHash, 'admin']
    );
    await dbInstanceWrapper.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Staff User', 'staff@paytrack.com', staffHash, 'staff']
    );
    console.log('[DATABASE] Created initial Admin and Staff accounts.');
  } else {
    // Update admin password to Admin@741
    await dbInstanceWrapper.run(
      "UPDATE users SET password_hash = ? WHERE LOWER(email) = 'admin@paytrack.com' OR role = 'admin'",
      [adminHash]
    );
  }

  return dbInstanceWrapper;
}

module.exports = {
  getDb
};
