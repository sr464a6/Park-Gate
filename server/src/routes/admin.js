const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAdmin } = require('../middleware');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  const token = jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ ok: true, token });
});

router.get('/dashboard', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const parked = db.prepare("SELECT COUNT(*) c FROM sessions WHERE status != 'EXITED'").get().c;
  const entriesToday = db.prepare("SELECT COUNT(*) c FROM sessions WHERE entry_time LIKE ?").get(`${today}%`).c;
  const exitsToday = db.prepare("SELECT COUNT(*) c FROM sessions WHERE exit_time LIKE ?").get(`${today}%`).c;
  const revenueToday = db
    .prepare("SELECT COALESCE(SUM(amount),0) s FROM sessions WHERE payment_status='PAID' AND paid_at LIKE ?")
    .get(`${today}%`).s;
  const gates = db.prepare('SELECT * FROM gates').all();
  res.json({
    currently_parked: parked,
    entries_today: entriesToday,
    exits_today: exitsToday,
    revenue_today: revenueToday,
    gates,
  });
});

router.get('/sessions', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, v.vehicle_type, v.brand_model, u.name AS owner_name, u.phone
       FROM sessions s JOIN vehicles v ON v.id=s.vehicle_id JOIN users u ON u.id=s.user_id
       ORDER BY s.id DESC LIMIT 200`
    )
    .all();
  res.json({ sessions: rows });
});

router.get('/users', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.phone, u.status, u.created_at,
       (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id) AS vehicle_count
       FROM users u ORDER BY u.id DESC`
    )
    .all();
  res.json({ users: rows });
});

router.get('/audit-log', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json({ audit_log: rows });
});

router.get('/tariffs', requireAdmin, (req, res) => {
  res.json({ tariffs: db.prepare('SELECT * FROM tariffs').all() });
});

router.put('/tariffs/:type', requireAdmin, (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount < 0) return res.status(400).json({ error: 'Nominal tidak valid.' });
  db.prepare('UPDATE tariffs SET amount = ? WHERE vehicle_type = ?').run(amount, req.params.type);
  db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?,?,?)').run(
    req.admin.username,
    'TARIFF_CHANGE',
    `${req.params.type} -> Rp${amount}`
  );
  res.json({ ok: true });
});

// Manual exit authorization for when the user's phone is unavailable.
router.post('/sessions/:id/manual-authorize', requireAdmin, (req, res) => {
  const db_ = require('../db');
  const session = db_.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const tariff = db_
    .prepare('SELECT amount FROM tariffs WHERE vehicle_type = (SELECT vehicle_type FROM vehicles WHERE id = ?)')
    .get(session.vehicle_id);
  const amount = tariff ? tariff.amount : 5000;
  db_.prepare("UPDATE sessions SET status='WAITING_FOR_PAYMENT', amount=? WHERE id=?").run(amount, session.id);
  db_.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?,?,?)').run(
    req.admin.username,
    'MANUAL_EXIT_AUTHORIZATION',
    `Sesi #${session.id} (${session.plate}) diotorisasi manual`
  );
  res.json({ ok: true, amount });
});

module.exports = router;
