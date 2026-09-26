const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireGateKey } = require('../middleware');
const { pushToUser } = require('../notify');

const router = express.Router();

// These endpoints stand in for the physical hardware described in the README
// (vehicle sensor, ANPR camera, PIN keypad, barrier). There is no simulated
// data behind them -- they read and write the real database, hash-check the
// real PIN, and push a real-time event to the real logged-in user. A real
// ANPR camera / IoT controller would call exactly these HTTP endpoints.

router.post('/entry', requireGateKey, (req, res) => {
  const { gate_code, plate, pin } = req.body;
  if (!gate_code || !plate || !pin) return res.status(400).json({ error: 'gate_code, plate, pin wajib diisi.' });

  const gate = db.prepare('SELECT * FROM gates WHERE code = ?').get(gate_code);
  if (!gate) return res.status(404).json({ error: 'Gate tidak ditemukan.' });

  const vehicle = db.prepare('SELECT * FROM vehicles WHERE plate = ?').get(plate.toUpperCase().trim());
  if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak terdaftar.', gate_action: 'DENY' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(vehicle.user_id);
  if (!user || !user.pin_hash || !bcrypt.compareSync(String(pin), user.pin_hash)) {
    return res.status(401).json({ error: 'PIN salah.', gate_action: 'DENY' });
  }

  const openSession = db.prepare("SELECT id FROM sessions WHERE vehicle_id = ? AND status != 'EXITED'").get(vehicle.id);
  if (openSession) return res.status(409).json({ error: 'Kendaraan ini sudah tercatat sedang parkir.', gate_action: 'DENY' });

  const info = db
    .prepare(
      `INSERT INTO sessions (vehicle_id, user_id, plate, entry_gate_code, entry_time, status, payment_status)
       VALUES (?,?,?,?,datetime('now'),'PARKED','PENDING')`
    )
    .run(vehicle.id, user.id, vehicle.plate, gate_code);

  pushToUser(user.id, 'session_update', { id: info.lastInsertRowid, status: 'PARKED', event: 'ENTRY' });
  db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?,?,?)').run(
    gate_code,
    'VEHICLE_ENTRY',
    `${vehicle.plate} masuk lewat ${gate_code}`
  );

  res.json({ ok: true, gate_action: 'OPEN', session_id: info.lastInsertRowid });
});

router.post('/exit-request', requireGateKey, (req, res) => {
  const { gate_code, plate } = req.body;
  if (!gate_code || !plate) return res.status(400).json({ error: 'gate_code dan plate wajib diisi.' });

  const gate = db.prepare('SELECT * FROM gates WHERE code = ?').get(gate_code);
  if (!gate) return res.status(404).json({ error: 'Gate tidak ditemukan.' });

  const session = db
    .prepare("SELECT * FROM sessions WHERE plate = ? AND status = 'PARKED' ORDER BY id DESC LIMIT 1")
    .get(plate.toUpperCase().trim());
  if (!session) return res.status(404).json({ error: 'Tidak ada sesi parkir aktif untuk plat ini.' });

  db.prepare("UPDATE sessions SET status = 'WAITING_FOR_APPROVAL', exit_gate_code = ? WHERE id = ?").run(
    gate_code,
    session.id
  );
  pushToUser(session.user_id, 'exit_request', {
    id: session.id,
    plate: session.plate,
    gate_code,
    status: 'WAITING_FOR_APPROVAL',
  });
  res.json({ ok: true, status: 'WAITING_FOR_APPROVAL' });
});

router.post('/payment-confirm', requireGateKey, (req, res) => {
  // Stands in for a payment gateway webhook (e.g. Midtrans/Xendit) confirming
  // a real QRIS payment. Plug a real webhook into this same endpoint shape.
  const { session_id, method } = req.body;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  if (session.status !== 'WAITING_FOR_PAYMENT') {
    return res.status(409).json({ error: 'Sesi ini tidak sedang menunggu pembayaran.' });
  }
  db.prepare(
    `UPDATE sessions SET status = 'EXITED', payment_status = 'PAID', payment_method = ?, paid_at = datetime('now'), exit_time = datetime('now') WHERE id = ?`
  ).run(method || 'QRIS', session.id);
  pushToUser(session.user_id, 'session_update', { id: session.id, status: 'EXITED' });
  db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?,?,?)').run(
    session.exit_gate_code || 'GATE',
    'PAYMENT_CONFIRMED',
    `${session.plate} bayar Rp${session.amount}`
  );
  res.json({ ok: true, gate_action: 'OPEN', status: 'EXITED' });
});

module.exports = router;
