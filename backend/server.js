// Main Express Server
// Entry point for backend API

require('dotenv').config();

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[auth] SUPABASE_SERVICE_ROLE_KEY missing in backend/.env — profile lookup falls back to user JWT + RLS. Add the service role key for reliable login.'
  );
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors()); // Allow frontend to connect
app.use(express.json()); // Parse JSON request body

// Import routes
const productsRouter = require('./routes/products');
const partiesRouter = require('./routes/parties');
const purchasesRouter = require('./routes/purchases');
const salesRouter = require('./routes/sales');
const dashboardRouter = require('./routes/dashboard');
const expensesRouter = require('./routes/expenses');
const employeesRouter = require('./routes/employees');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const activityLogRouter = require('./routes/activityLog');
const supportMessagesRouter = require('./routes/supportMessages');
const citiesRouter = require('./routes/cities');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { checkAccess } = require('./middleware/checkAccess');

// Public
app.get('/api/health', async (req, res) => {
  try {
    const { supabase, assertNoError } = require('./database/supabase');
    const { error } = await supabase.from('products').select('id').limit(1);
    assertNoError(error);
    res.json({ status: 'OK', message: 'Server is running!', database: 'supabase' });
  } catch (error) {
    res.status(503).json({ status: 'ERROR', message: error.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/support-messages', requireAuth, supportMessagesRouter);

// Authenticated (admin + staff)
app.use('/api/dashboard', requireAuth, checkAccess, dashboardRouter);
app.use('/api/products', requireAuth, checkAccess, productsRouter);
app.use('/api/parties', requireAuth, checkAccess, partiesRouter);
app.use('/api/sales', requireAuth, checkAccess, salesRouter);
app.use('/api/cities', requireAuth, checkAccess, citiesRouter);

// Admin only
app.use('/api/purchases', requireAuth, requireAdmin, checkAccess, purchasesRouter);
app.use('/api/expenses', requireAuth, requireAdmin, checkAccess, expensesRouter);
app.use('/api/employees', requireAuth, requireAdmin, checkAccess, employeesRouter);
app.use('/api/reports', requireAuth, requireAdmin, checkAccess, reportsRouter);
app.use('/api/users', requireAuth, requireAdmin, checkAccess, usersRouter);
app.use('/api/activity-log', requireAuth, requireAdmin, checkAccess, activityLogRouter);
app.use('/api/settings', requireAuth, checkAccess, require('./routes/settings'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API: auth, dashboard, products, parties, sales, cities (staff+admin)`);
  console.log(`📊 API: purchases, expenses, employees, reports, users, settings (admin where required)`);
});
