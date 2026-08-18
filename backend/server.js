const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getDb } = require('./database');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// Initialize Database
getDb()
  .then(() => {
    console.log('SQLite Database connected and tables verified.');
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

// Mount Routers
const { router: authRouter } = require('./routes/auth');
const clientsRouter = require('./routes/clients');
const transactionsRouter = require('./routes/transactions');
const dashboardRouter = require('./routes/dashboard');
const settingsRouter = require('./routes/settings');

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);

// Serve Static Assets from React build
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Fallback all non-API GET requests to React index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`PayTrack CRM backend running on port ${PORT}`);
});
