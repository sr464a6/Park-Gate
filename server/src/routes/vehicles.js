const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../middleware');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `stnk_${req.user.sub}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('File harus berupa gambar.'));
    cb(null, true);
  },
});

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY id DESC').all(req.user.sub);
  res.json({ vehicles: rows });
});

router.post('/', requireAuth, (req, res, next) => {
  upload.single('stnk_photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const { plate, vehicle_type, brand_model, color, owner_name, address } = req.body;
  if (!plate || !vehicle_type) return res.status(400).json({ error: 'Plat nomor dan jenis kendaraan wajib diisi.' });
  const validTypes = ['motorcycle', 'car', 'truck', 'bus'];
  if (!validTypes.includes(vehicle_type)) return res.status(400).json({ error: 'Jenis kendaraan tidak valid.' });

  const info = db
    .prepare(
      `INSERT INTO vehicles (user_id, plate, vehicle_type, brand_model, color, owner_name, address, stnk_photo_path)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      req.user.sub,
      plate.toUpperCase().trim(),
      vehicle_type,
      brand_model || null,
      color || null,
      owner_name || null,
      address || null,
      req.file ? `/uploads/${req.file.filename}` : null
    );
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, vehicle });
});

router.delete('/:id', requireAuth, (req, res) => {
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!vehicle) return res.status(404).json({ error: 'Kendaraan tidak ditemukan.' });
  const active = db
    .prepare("SELECT id FROM sessions WHERE vehicle_id = ? AND status NOT IN ('EXITED')")
    .get(vehicle.id);
  if (active) return res.status(409).json({ error: 'Kendaraan sedang aktif parkir, tidak bisa dihapus.' });
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(vehicle.id);
  res.json({ ok: true });
});

module.exports = router;
