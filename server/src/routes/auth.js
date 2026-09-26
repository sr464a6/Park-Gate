const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateCode, hashCode, sendOtp, activeChannel } = require('../otp');

const router = express.Router();

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p.replace(/^\+/, '');
  return p;
}

function signUserToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone, role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

// ---- Step 1: request OTP (used for both register and login-recovery) ----
router.post('/otp/request', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const email = req.body.email ? String(req.body.email).trim() : null;
  const purpose = req.body.purpose === 'reset_pin' ? 'reset_pin' : 'register';
  if (!phone || phone.length < 8) return res.status(400).json({ error: 'Nomor HP tidak valid.' });

  const recent = db
    .prepare(
      `SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? ORDER BY id DESC LIMIT 1`
    )
    .get(phone, purpose);
  if (recent) {
    const ageSeconds = (Date.now() - new Date(recent.created_at + 'Z').getTime()) / 1000;
    if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({
        error: `Tunggu ${Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds)} detik sebelum minta kode baru.`,
      });
    }
  }

  if (purpose === 'register') {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND phone_verified = 1 AND pin_hash IS NOT NULL').get(phone);
    if (existing) return res.status(409).json({ error: 'Nomor ini sudah terdaftar. Silakan masuk.' });
  } else {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (!existing) return res.status(404).json({ error: 'Nomor belum terdaftar.' });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO otp_codes (phone, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?)`
  ).run(phone, purpose, hashCode(code), expiresAt);

  try {
    const result = await sendOtp({ phone, email, code });
    return res.json({
      ok: true,
      channel: result.channel,
      ttl_minutes: OTP_TTL_MINUTES,
      dev_otp: result.devCode || undefined,
    });
  } catch (err) {
    if (err.message === 'EMAIL_REQUIRED') {
      return res.status(400).json({ error: 'Server dikonfigurasi mengirim OTP lewat email. Sertakan alamat email.' });
    }
    console.error('OTP send error:', err.message);
    return res.status(502).json({ error: 'Gagal mengirim OTP. Coba lagi sebentar lagi.' });
  }
});

// ---- Step 2: verify OTP -> short-lived registration/reset token ----
router.post('/otp/verify', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const purpose = req.body.purpose === 'reset_pin' ? 'reset_pin' : 'register';
  const code = String(req.body.code || '').trim();
  if (!phone || !code) return res.status(400).json({ error: 'Data tidak lengkap.' });

  const row = db
    .prepare(`SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? ORDER BY id DESC LIMIT 1`)
    .get(phone, purpose);
  if (!row) return res.status(400).json({ error: 'Kode OTP tidak ditemukan, minta kode baru.' });
  if (row.consumed) return res.status(400).json({ error: 'Kode sudah digunakan, minta kode baru.' });
  if (new Date(row.expires_at + 'Z').getTime() < Date.now()) {
    return res.status(400).json({ error: 'Kode sudah kedaluwarsa, minta kode baru.' });
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan salah, minta kode baru.' });
  }
  if (hashCode(code) !== row.code_hash) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    return res.status(400).json({ error: 'Kode OTP salah.' });
  }

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id);

  if (purpose === 'register') {
    db.prepare(
      `INSERT INTO users (phone, phone_verified) VALUES (?, 1)
       ON CONFLICT(phone) DO UPDATE SET phone_verified = 1`
    ).run(phone);
  }

  const verifyToken = jwt.sign({ phone, purpose, verified: true }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });
  res.json({ ok: true, verify_token: verifyToken });
});

// ---- Step 3: finish registration by setting name + PIN ----
router.post('/register/complete', (req, res) => {
  const { verify_token, name, pin, email } = req.body;
  if (!verify_token || !pin) return res.status(400).json({ error: 'Data tidak lengkap.' });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN harus 4-6 digit angka.' });

  let payload;
  try {
    payload = jwt.verify(verify_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Verifikasi kedaluwarsa, ulangi proses.' });
  }
  if (payload.purpose !== 'register' || !payload.verified) {
    return res.status(401).json({ error: 'Token tidak valid.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(payload.phone);
  if (!user || !user.phone_verified) return res.status(400).json({ error: 'Nomor belum diverifikasi.' });

  const pinHash = bcrypt.hashSync(pin, 10);
  db.prepare('UPDATE users SET name = ?, email = ?, pin_hash = ? WHERE id = ?').run(
    name || 'Pengguna',
    email || user.email,
    pinHash,
    user.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  db.prepare('INSERT INTO audit_log (actor, action, detail) VALUES (?,?,?)').run(
    updated.phone,
    'REGISTER_COMPLETE',
    'Akun baru dibuat'
  );
  res.json({ ok: true, token: signUserToken(updated), user: publicUser(updated) });
});

// ---- Reset PIN after OTP verification ----
router.post('/pin/reset', (req, res) => {
  const { verify_token, pin } = req.body;
  if (!verify_token || !pin) return res.status(400).json({ error: 'Data tidak lengkap.' });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN harus 4-6 digit angka.' });
  let payload;
  try {
    payload = jwt.verify(verify_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Verifikasi kedaluwarsa, ulangi proses.' });
  }
  if (payload.purpose !== 'reset_pin' || !payload.verified) {
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(payload.phone);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(bcrypt.hashSync(pin, 10), user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ ok: true, token: signUserToken(updated), user: publicUser(updated) });
});

// ---- Login with phone + PIN ----
router.post('/login', (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin || '');
  if (!phone || !pin) return res.status(400).json({ error: 'Data tidak lengkap.' });

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !user.pin_hash) return res.status(401).json({ error: 'Nomor atau PIN salah.' });
  if (!bcrypt.compareSync(pin, user.pin_hash)) {
    return res.status(401).json({ error: 'Nomor atau PIN salah.' });
  }
  res.json({ ok: true, token: signUserToken(user), user: publicUser(user) });
});

router.get('/channel-info', (req, res) => {
  res.json({ channel: activeChannel() });
});

function publicUser(u) {
  return { id: u.id, phone: u.phone, name: u.name, email: u.email };
}

module.exports = router;
