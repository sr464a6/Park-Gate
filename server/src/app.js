const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const sessionRoutes = require('./routes/sessions');
const gateRoutes = require('./routes/gate');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the real user PWA and the admin/gate-simulator page as static sites.
app.use('/', express.static(path.join(__dirname, '..', '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin-public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

module.exports = app;
