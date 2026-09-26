const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware');
const { subscribe, pushToUser } = require('../notify');

const router = express.Router();

router.get('/stream', (req, res) => {
  // EventSource can't send custom headers, so accept the JWT as a query param here.
  const jwt = require('jsonwebtoken');
  let user;
  try {
    user = jwt.verify(req.query.token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).end();
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: connected\ndata: {}\n\n');
  const unsubscribe = subscribe(user.sub, res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, v.brand_model, v.vehicle_type FROM sessions s
       JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 100`
    )
    .all(req.user.sub);
  res.json({ sessions: rows });
});

router.get('/active', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, v.brand_model, v.vehicle_type FROM sessions s
       JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.user_id = ? AND s.status != 'EXITED' ORDER BY s.id DESC`
    )
    .all(req.user.sub);
  res.json({ sessions: rows });
});

// User approves or rejects an exit request that the gate raised.
router.post('/:id/authorize', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  if (session.status !== 'WAITING_FOR_APPROVAL') {
    return res.status(409).json({ error: 'Sesi ini tidak sedang menunggu persetujuan.' });
  }
  const approve = !!req.body.approve;
  if (!approve) {
    db.prepare("UPDATE sessions SET status = 'PARKED' WHERE id = ?").run(session.id);
    return res.json({ ok: true, status: 'PARKED' });
  }
  const tariff = db.prepare('SELECT amount FROM tariffs WHERE vehicle_type = (SELECT vehicle_type FROM vehicles WHERE id = ?)').get(session.vehicle_id);
  const amount = tariff ? tariff.amount : 5000;
  db.prepare("UPDATE sessions SET status = 'WAITING_FOR_PAYMENT', amount = ? WHERE id = ?").run(amount, session.id);
  pushToUser(req.user.sub, 'session_update', { id: session.id, status: 'WAITING_FOR_PAYMENT', amount });
  res.json({ ok: true, status: 'WAITING_FOR_PAYMENT', amount });
});

module.exports = router;
