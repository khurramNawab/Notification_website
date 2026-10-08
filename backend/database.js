const fs = require('fs');
const path = require('path');
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

// 1. Pure JavaScript JSON File Database (Zero native binary dependencies, runs anywhere)
function initPureJsDb() {
  const storePath = path.resolve(__dirname, 'paytrack_store.json');
  console.log(`[DATABASE] Initializing Pure-JS persistent database at: ${storePath}`);

  let data = {
    users: [],
    clients: [],
    transactions: [],
    payment_history: [],
    reminders: [],
    settings: { overdue_days_threshold: '30' },
    counters: { users: 0, clients: 0, transactions: 0, payment_history: 0, reminders: 0 }
  };

  if (fs.existsSync(storePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      data = { ...data, ...parsed };
    } catch (e) {
      console.warn('[DATABASE] Failed to read store, starting with fresh store:', e.message);
    }
  }

  // Auto-seed existing data if store is empty
  const seedPath = path.resolve(__dirname, 'seed_data.json');
  if ((!data.clients || data.clients.length === 0) && fs.existsSync(seedPath)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (seed.clients && seed.clients.length > 0) {
        data.users = seed.users || data.users;
        data.clients = seed.clients || [];
        data.transactions = seed.transactions || [];
        data.payment_history = seed.payment_history || [];
        data.reminders = seed.reminders || [];
        if (seed.settings && Array.isArray(seed.settings)) {
          seed.settings.forEach(s => { if (s.key && s.value) data.settings[s.key] = s.value; });
        }
        // Update counters
        data.counters.users = Math.max(0, ...data.users.map(u => u.id || 0));
        data.counters.clients = Math.max(0, ...data.clients.map(c => c.id || 0));
        data.counters.transactions = Math.max(0, ...data.transactions.map(t => t.id || 0));
        data.counters.payment_history = Math.max(0, ...data.payment_history.map(p => p.id || 0));
        data.counters.reminders = Math.max(0, ...data.reminders.map(r => r.id || 0));
        console.log(`[DATABASE] Loaded ${data.clients.length} clients and ${data.transactions.length} transactions from seed_data.json`);
      }
    } catch (seedErr) {
      console.warn('[DATABASE] Failed to load seed_data.json:', seedErr.message);
    }
  }

  const saveData = () => {
    try {
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[DATABASE] Failed to save store:', e.message);
    }
  };

  const jsWrapper = {
    isPureJs: true,
    run: async (sql, params = []) => {
      const s = sql.trim();
      const upper = s.toUpperCase();

      if (upper.startsWith('INSERT INTO USERS')) {
        data.counters.users++;
        const id = data.counters.users;
        const [name, email, password_hash, role] = params;
        data.users.push({ id, name, email: email ? email.toLowerCase() : '', password_hash, role, created_at: new Date().toISOString() });
        saveData();
        return { lastID: id, changes: 1 };
      }

      if (upper.startsWith('UPDATE USERS SET PASSWORD_HASH')) {
        const [hash] = params;
        let changes = 0;
        data.users.forEach(u => {
          if (u.role === 'admin' || u.email === 'admin@paytrack.com') {
            u.password_hash = hash;
            changes++;
          }
        });
        saveData();
        return { changes };
      }

      if (upper.startsWith('DELETE FROM USERS WHERE ID')) {
        const id = parseInt(params[0]);
        const before = data.users.length;
        data.users = data.users.filter(u => u.id !== id);
        saveData();
        return { changes: before - data.users.length };
      }

      if (upper.startsWith('INSERT INTO CLIENTS')) {
        data.counters.clients++;
        const id = data.counters.clients;
        const [company_name, client_name, phone_number] = params;
        data.clients.push({ id, company_name, client_name, phone_number, is_archived: 0, created_at: new Date().toISOString() });
        saveData();
        return { lastID: id, changes: 1 };
      }

      if (upper.startsWith('UPDATE CLIENTS SET COMPANY_NAME')) {
        const [company_name, client_name, phone_number, id] = params;
        const c = data.clients.find(x => x.id === parseInt(id));
        if (c) {
          c.company_name = company_name;
          c.client_name = client_name;
          c.phone_number = phone_number;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('UPDATE CLIENTS SET IS_ARCHIVED = 1')) {
        const id = parseInt(params[0]);
        const c = data.clients.find(x => x.id === id);
        if (c) {
          c.is_archived = 1;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('INSERT INTO TRANSACTIONS')) {
        data.counters.transactions++;
        const id = data.counters.transactions;
        const [client_id, date, service_type, client_or_consultant, quotation_amount, govt_fees, prof_fees, advance_amount, payment_received, pending_amount, status, remark] = params;
        data.transactions.push({
          id,
          client_id: parseInt(client_id),
          date,
          service_type,
          client_or_consultant,
          quotation_amount: parseFloat(quotation_amount) || 0,
          govt_fees: parseFloat(govt_fees) || 0,
          prof_fees: parseFloat(prof_fees) || 0,
          advance_amount: parseFloat(advance_amount) || 0,
          payment_received: parseFloat(payment_received) || 0,
          pending_amount: parseFloat(pending_amount) || 0,
          status,
          remark: remark || '',
          is_archived: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        saveData();
        return { lastID: id, changes: 1 };
      }

      if (upper.startsWith('UPDATE TRANSACTIONS SET PAYMENT_RECEIVED')) {
        const [payment_received, pending_amount, status, id] = params;
        const tx = data.transactions.find(t => t.id === parseInt(id));
        if (tx) {
          tx.payment_received = parseFloat(payment_received) || 0;
          tx.pending_amount = parseFloat(pending_amount) || 0;
          tx.status = status;
          tx.updated_at = new Date().toISOString();
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('UPDATE TRANSACTIONS SET DATE = ?') || upper.startsWith('UPDATE TRANSACTIONS SET \n         DATE = ?')) {
        const [date, service_type, client_or_consultant, quotation_amount, govt_fees, prof_fees, advance_amount, remark, id] = params;
        const tx = data.transactions.find(t => t.id === parseInt(id));
        if (tx) {
          tx.date = date;
          tx.service_type = service_type;
          tx.client_or_consultant = client_or_consultant;
          tx.quotation_amount = parseFloat(quotation_amount) || 0;
          tx.govt_fees = parseFloat(govt_fees) || 0;
          tx.prof_fees = parseFloat(prof_fees) || 0;
          tx.advance_amount = parseFloat(advance_amount) || 0;
          tx.remark = remark || '';
          tx.updated_at = new Date().toISOString();
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('UPDATE TRANSACTIONS SET STATUS = ? WHERE ID = ?')) {
        const [status, id] = params;
        const tx = data.transactions.find(t => t.id === parseInt(id));
        if (tx) {
          tx.status = status;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('UPDATE TRANSACTIONS SET IS_ARCHIVED = 1')) {
        const id = parseInt(params[0]);
        const tx = data.transactions.find(t => t.id === id);
        if (tx) {
          tx.is_archived = 1;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('INSERT INTO PAYMENT_HISTORY')) {
        data.counters.payment_history++;
        const id = data.counters.payment_history;
        const [transaction_id, amount, payment_date, payment_mode, note] = params;
        data.payment_history.push({
          id,
          transaction_id: parseInt(transaction_id),
          amount: parseFloat(amount) || 0,
          payment_date,
          payment_mode,
          note: note || '',
          created_at: new Date().toISOString()
        });
        saveData();
        return { lastID: id, changes: 1 };
      }

      if (upper.startsWith('UPDATE PAYMENT_HISTORY SET AMOUNT')) {
        const [amount, payment_date, id] = params;
        const ph = data.payment_history.find(p => p.id === parseInt(id));
        if (ph) {
          ph.amount = parseFloat(amount) || 0;
          ph.payment_date = payment_date;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      if (upper.startsWith('DELETE FROM PAYMENT_HISTORY WHERE ID')) {
        const id = parseInt(params[0]);
        data.payment_history = data.payment_history.filter(p => p.id !== id);
        saveData();
        return { changes: 1 };
      }

      if (upper.startsWith('INSERT INTO REMINDERS')) {
        data.counters.reminders++;
        const id = data.counters.reminders;
        const [transaction_id, reminder_date, status, channel] = params;
        data.reminders.push({
          id,
          transaction_id: parseInt(transaction_id),
          reminder_date,
          status,
          channel,
          created_at: new Date().toISOString()
        });
        saveData();
        return { lastID: id, changes: 1 };
      }

      if (upper.includes('SETTINGS')) {
        if (params.length === 1) {
          data.settings.overdue_days_threshold = params[0].toString();
        } else if (params.length >= 2) {
          data.settings[params[0]] = params[1].toString();
        }
        saveData();
        return { changes: 1 };
      }

      return { changes: 0 };
    },

    get: async (sql, params = []) => {
      const s = sql.trim();
      const upper = s.toUpperCase();

      if (upper.includes('FROM USERS WHERE EMAIL = ?') || upper.includes("FROM USERS WHERE LOWER(EMAIL) = 'ADMIN@PAYTRACK.COM'")) {
        const email = params[0] ? params[0].toLowerCase().trim() : 'admin@paytrack.com';
        return data.users.find(u => u.email.toLowerCase() === email || (email === 'admin@paytrack.com' && u.role === 'admin'));
      }

      if (upper.includes('FROM USERS WHERE ID = ?')) {
        return data.users.find(u => u.id === parseInt(params[0]));
      }

      if (upper.includes('SELECT COUNT(*) AS COUNT FROM USERS')) {
        return { count: data.users.length };
      }

      if (upper.includes('SELECT COUNT(*) AS COUNT FROM CLIENTS WHERE IS_ARCHIVED = 0')) {
        return { count: data.clients.filter(c => c.is_archived === 0).length };
      }

      if (upper.includes('SELECT COUNT(*) AS COUNT FROM TRANSACTIONS WHERE STATUS = \'OVERDUE\'')) {
        return { count: data.transactions.filter(t => t.is_archived === 0 && t.status === 'overdue').length };
      }

      if (upper.includes('SELECT COALESCE(SUM(AMOUNT), 0) AS TOTAL FROM PAYMENT_HISTORY WHERE PAYMENT_DATE LIKE ?')) {
        const prefix = params[0].replace('%', '');
        const sum = data.payment_history
          .filter(p => p.payment_date && p.payment_date.startsWith(prefix))
          .reduce((acc, p) => acc + p.amount, 0);
        return { total: sum };
      }

      if (upper.includes('SELECT COALESCE(SUM(PENDING_AMOUNT), 0) AS TOTAL FROM TRANSACTIONS')) {
        const sum = data.transactions
          .filter(t => t.is_archived === 0)
          .reduce((acc, t) => acc + (t.pending_amount || 0), 0);
        return { total: sum };
      }

      if (upper.includes('SELECT COALESCE(SUM(GOVT_FEES), 0) AS TOTAL FROM TRANSACTIONS')) {
        const sum = data.transactions
          .filter(t => t.is_archived === 0)
          .reduce((acc, t) => acc + (t.govt_fees || 0), 0);
        return { total: sum };
      }

      if (upper.includes('SELECT COALESCE(SUM(PROF_FEES), 0) AS TOTAL FROM TRANSACTIONS')) {
        const sum = data.transactions
          .filter(t => t.is_archived === 0)
          .reduce((acc, t) => acc + (t.prof_fees || 0), 0);
        return { total: sum };
      }

      if (upper.includes('FROM CLIENTS WHERE LOWER(COMPANY_NAME) = ?')) {
        const name = (params[0] || '').toLowerCase().trim();
        return data.clients.find(c => c.company_name.toLowerCase().trim() === name && c.is_archived === 0);
      }

      if (upper.includes('FROM CLIENTS WHERE ID = ?')) {
        return data.clients.find(c => c.id === parseInt(params[0]) && c.is_archived === 0);
      }

      if (upper.includes('FROM TRANSACTIONS WHERE ID = ?')) {
        return data.transactions.find(t => t.id === parseInt(params[0]));
      }

      if (upper.includes('SELECT T.*, C.COMPANY_NAME, C.CLIENT_NAME, C.PHONE_NUMBER \n       FROM TRANSACTIONS T \n       JOIN CLIENTS C ON T.CLIENT_ID = C.ID \n       WHERE T.ID = ?')) {
        const tx = data.transactions.find(t => t.id === parseInt(params[0]));
        if (!tx) return null;
        const c = data.clients.find(cl => cl.id === tx.client_id) || {};
        return { ...tx, company_name: c.company_name || '', client_name: c.client_name || '', phone_number: c.phone_number || '' };
      }

      if (upper.includes('SELECT COALESCE(SUM(AMOUNT), 0) AS TOTAL FROM PAYMENT_HISTORY WHERE TRANSACTION_ID = ?')) {
        const txId = parseInt(params[0]);
        const sum = data.payment_history
          .filter(p => p.transaction_id === txId)
          .reduce((acc, p) => acc + p.amount, 0);
        return { total: sum };
      }

      if (upper.includes('FROM PAYMENT_HISTORY WHERE TRANSACTION_ID = ? AND NOTE LIKE')) {
        const txId = parseInt(params[0]);
        return data.payment_history.find(p => p.transaction_id === txId && p.note.includes('Advance Payment'));
      }

      if (upper.includes("FROM SETTINGS WHERE KEY = 'OVERDUE_DAYS_THRESHOLD'")) {
        return { value: data.settings.overdue_days_threshold || '30' };
      }

      if (upper.includes('SELECT COUNT(*) AS COUNT FROM TRANSACTIONS T') || upper.includes('SELECT COUNT(*) AS COUNT \n      FROM TRANSACTIONS T')) {
        let list = data.transactions.filter(t => t.is_archived === 0);
        return { count: list.length };
      }

      return null;
    },

    all: async (sql, params = []) => {
      const upper = sql.trim().toUpperCase();

      if (upper.includes('FROM USERS')) {
        return data.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at }));
      }

      if (upper.includes('FROM CLIENTS WHERE IS_ARCHIVED = 0')) {
        return data.clients.filter(c => c.is_archived === 0).sort((a, b) => a.company_name.localeCompare(b.company_name));
      }

      if (upper.includes('FROM SETTINGS')) {
        return Object.keys(data.settings).map(k => ({ key: k, value: data.settings[k] }));
      }

      if (upper.includes('SELECT STATUS, COUNT(*) AS COUNT \n       FROM TRANSACTIONS')) {
        const counts = {};
        data.transactions.filter(t => t.is_archived === 0).forEach(t => {
          counts[t.status] = (counts[t.status] || 0) + 1;
        });
        return Object.keys(counts).map(status => ({ status, count: counts[status] }));
      }

      if (upper.includes('DISTINCT SUBSTR(DATE, 1, 7) AS MONTH_KEY')) {
        const set = new Set();
        data.transactions.filter(t => t.is_archived === 0 && t.date).forEach(t => {
          if (t.date.length >= 7) set.add(t.date.substring(0, 7));
        });
        return Array.from(set).map(month_key => ({ month_key }));
      }

      // Transactions query with join
      if (upper.includes('FROM TRANSACTIONS T') && upper.includes('JOIN CLIENTS C')) {
        let list = data.transactions.filter(t => t.is_archived === 0).map(t => {
          const c = data.clients.find(cl => cl.id === t.client_id && cl.is_archived === 0) || {};
          return {
            ...t,
            company_name: c.company_name || 'Unknown',
            client_name: c.client_name || 'Unknown',
            phone_number: c.phone_number || ''
          };
        });

        // Date filter
        if (upper.includes('T.DATE LIKE ?')) {
          const prefix = (params[0] || '').replace('%', '');
          list = list.filter(t => t.date && t.date.startsWith(prefix));
        }

        // Pending filter for followups
        if (upper.includes('T.PENDING_AMOUNT > 0')) {
          list = list.filter(t => t.pending_amount > 0);
          return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        }

        return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }

      if (upper.includes('FROM TRANSACTIONS WHERE CLIENT_ID = ?')) {
        const clientId = parseInt(params[0]);
        return data.transactions.filter(t => t.client_id === clientId && t.is_archived === 0).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      }

      return [];
    },

    exec: async (sql) => {
      return Promise.resolve();
    }
  };

  return jsWrapper;
}

// 2. Native SQLite wrapper (for local environments supporting sqlite3)
function initNativeSqliteDb() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'paytrack.db');
  console.log(`[DATABASE] Connecting to local SQLite database at: ${dbPath}`);
  const db = new sqlite3.Database(dbPath);

  return {
    isSqlite: true,
    run: (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    }),
    all: (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    }),
    exec: (sql) => new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    })
  };
}

// 3. PostgreSQL wrapper
async function tryInitPostgres(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  await pool.query('SELECT 1');

  return {
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

      const result = await pool.query(queryStr, params);
      let lastID = null;
      if (isInsert && result.rows && result.rows.length > 0 && result.rows[0].id) {
        lastID = result.rows[0].id;
      }
      return { lastID, changes: result.rowCount };
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
}

async function getDb() {
  if (dbInstanceWrapper) return dbInstanceWrapper;

  const dbUrl = process.env.DATABASE_URL;
  let useSqlite = process.env.USE_SQLITE === 'true';

  if (!useSqlite && dbUrl && !dbUrl.includes('placeholder')) {
    try {
      console.log('[DATABASE] Attempting Postgres connection...');
      dbInstanceWrapper = await tryInitPostgres(dbUrl);
      console.log('[DATABASE] Successfully connected to Postgres database!');
    } catch (pgErr) {
      console.warn('[DATABASE] Postgres connection failed or unreachable:', pgErr.message);
      try {
        dbInstanceWrapper = initNativeSqliteDb();
      } catch (_) {
        console.log('[DATABASE] Using resilient Pure-JS persistent database...');
        dbInstanceWrapper = initPureJsDb();
      }
    }
  } else {
    try {
      dbInstanceWrapper = initNativeSqliteDb();
    } catch (_) {
      console.log('[DATABASE] Using resilient Pure-JS persistent database...');
      dbInstanceWrapper = initPureJsDb();
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
    console.log('[DATABASE] Initial Admin and Staff accounts seeded successfully.');
  } else {
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
