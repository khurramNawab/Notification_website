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

// Serve Static Assets from React build (if built)
const fs = require('fs');
const path = require('path');
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root endpoint
app.get('/', (req, res) => {
  if (fs.existsSync(frontendIndexPath)) {
    return res.sendFile(frontendIndexPath);
  }
  res.json({ name: 'PayTrack CRM Backend API', status: 'OK', message: 'Backend is running live' });
});

// Fallback all non-API GET requests to React index.html or API response
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (fs.existsSync(frontendIndexPath)) {
    return res.sendFile(frontendIndexPath);
  }
  res.json({ name: 'PayTrack CRM Backend API', status: 'OK' });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PayTrack CRM backend running on port ${PORT}`);
});
