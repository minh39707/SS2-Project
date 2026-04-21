require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { extractUserId } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const habitsRoutes = require('./routes/habits');
const aiRoutes = require('./routes/ai');
const storeRoutes = require('./routes/store');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(extractUserId);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/store', storeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// Global error handlers — keep the process alive when Supabase is temporarily unavailable
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(` HabitForge API running at http://0.0.0.0:${PORT}/api`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
