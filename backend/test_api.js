const { spawn } = require('child_process');
const path = require('path');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('--- STARTING REST API INTEGRATION TESTS ---');
  
  // 1. Health check
  console.log('\n[TEST 1] Checking API health endpoint...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  if (healthRes.ok && healthData.status === 'OK') {
    console.log('✓ Health check passed!');
  } else {
    throw new Error('Health check failed');
  }

  // 2. Auth: Admin Login
  console.log('\n[TEST 2] Verifying Admin login with seed credentials...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@paytrack.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  if (loginRes.ok && loginData.token) {
    console.log(`✓ Admin logged in successfully! Role: ${loginData.user.role}`);
  } else {
    throw new Error(`Login failed: ${loginData.error}`);
  }
  
  const token = loginData.token;
  const authHeader = { 'Authorization': `Bearer ${token}` };

  // 3. GET /api/transactions
  console.log('\n[TEST 3] Fetching transactions list...');
  const txRes = await fetch(`${BASE_URL}/api/transactions`, { headers: authHeader });
  const txData = await txRes.json();
  if (txRes.ok && Array.isArray(txData.transactions)) {
    console.log(`✓ Successfully retrieved ${txData.transactions.length} active transactions!`);
  } else {
    throw new Error('Failed to retrieve transactions');
  }

  // 4. GET /api/dashboard
  console.log('\n[TEST 4] Validating dashboard aggregations...');
  const dashRes = await fetch(`${BASE_URL}/api/dashboard`, { headers: authHeader });
  const dashData = await dashRes.json();
  if (dashRes.ok && dashData.kpis && dashData.revenue_trend) {
    console.log('✓ Dashboard aggregate numbers compiled successfully:');
    console.log(`  - Total active clients: ${dashData.kpis.total_clients}`);
    console.log(`  - Monthly revenue: ₹${dashData.kpis.total_revenue_this_month}`);
    console.log(`  - Total outstanding: ₹${dashData.kpis.total_pending}`);
  } else {
    throw new Error('Dashboard aggregation failed');
  }

  // 5. POST /api/clients (Add client)
  console.log('\n[TEST 5] Adding a new client...');
  const clientRes = await fetch(`${BASE_URL}/api/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ company_name: 'Test Corp Ltd.', client_name: 'Test Contact', phone_number: '+91 88888 88888' })
  });
  const clientData = await clientRes.json();
  if (clientRes.ok && clientData.id) {
    console.log(`✓ Client added successfully! ID: ${clientData.id}`);
  } else {
    throw new Error(`Client creation failed: ${clientData.error}`);
  }

  const clientId = clientData.id;

  // 6. POST /api/transactions (Add engagement)
  console.log('\n[TEST 6] Logging a new client service engagement (ITR filing)...');
  const addTxRes = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      client_id: clientId,
      date: new Date().toISOString().split('T')[0],
      service_type: 'Income Tax',
      client_or_consultant: 'client',
      quotation_amount: 10000,
      govt_fees: 0,
      prof_fees: 10000,
      advance_amount: 2000,
      remark: 'Test engagement'
    })
  });
  const addTxData = await addTxRes.json();
  if (addTxRes.ok && addTxData.id) {
    console.log(`✓ Engagement logged successfully! Pending: ₹${addTxData.pending_amount}, Status: ${addTxData.status}`);
    if (addTxData.pending_amount !== 8000 || addTxData.status !== 'partial') {
      throw new Error('Math validation discrepancy: pending should be 8000 and status partial');
    }
  } else {
    throw new Error(`Engagement logging failed: ${addTxData.error}`);
  }

  // 7. GET /api/clients/:id (Profile Ledger)
  console.log('\n[TEST 7] Verifying Client ledger calculations...');
  const profileRes = await fetch(`${BASE_URL}/api/clients/${clientId}`, { headers: authHeader });
  const profileData = await profileRes.json();
  if (profileRes.ok && profileData.summary) {
    console.log('✓ Profile ledger totals match:');
    console.log(`  - Lifetime billed: ₹${profileData.summary.total_billed}`);
    console.log(`  - Lifetime received: ₹${profileData.summary.total_received}`);
    console.log(`  - Lifetime pending: ₹${profileData.summary.total_pending}`);
    if (profileData.summary.total_billed !== 10000 || profileData.summary.total_received !== 2000) {
      throw new Error('Ledger math error!');
    }
  } else {
    throw new Error('Profile ledger verification failed');
  }

  console.log('\n--- ALL API INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

// Start backend server child process, execute tests, then kill process
const serverProc = spawn('node', ['server.js'], { cwd: __dirname });

serverProc.stdout.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('PayTrack CRM backend running')) {
    // Run tests once server is listening
    runTests()
      .then(() => {
        serverProc.kill();
        process.exit(0);
      })
      .catch((err) => {
        console.error('\n✗ TEST RUN FAILED:', err.message);
        serverProc.kill();
        process.exit(1);
      });
  }
});

serverProc.stderr.on('data', (data) => {
  console.error('[SERVER ERROR]', data.toString());
});
