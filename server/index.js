const express = require('express');
const cors = require('cors');
const path = require('path');

const categoriesRouter = require('./routes/categories');
const menuItemsRouter = require('./routes/menuItems');
const tablesRouter = require('./routes/tables');
const ordersRouter = require('./routes/orders');
const kotRouter = require('./routes/kot');
const customersRouter = require('./routes/customers');
const analyticsRouter = require('./routes/analytics');
const guestOrderRouter = require('./routes/guestOrder');
const subscriptionRouter = require('./routes/subscription');
const superAdminRouter = require('./routes/superAdmin');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', superAdminRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/menu-items', menuItemsRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/kot', kotRouter);
app.use('/api/customers', customersRouter);
app.use('/api/guest', guestOrderRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api', analyticsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve compiled client in production
const fs = require('fs');
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && req.method === 'GET') {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🍽️  Restaurant Billing Server running on http://localhost:${PORT}`);
  console.log(`📊  API available at http://localhost:${PORT}/api`);
});
