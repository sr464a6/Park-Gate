const path = require('path');
const fs = require('fs');
// Uses Node's built-in SQLite module (available in Node 22+, no native
// compilation / Visual Studio Build Tools required — works out of the box
// on Windows, Mac, Linux, including Node 24).
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'parkgate.sqlite3'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  pin_hash TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  brand_model TEXT,
  color TEXT,
  owner_name TEXT,
  address TEXT,
  stnk_photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'both',
  status TEXT NOT NULL DEFAULT 'ONLINE'
);

CREATE TABLE IF NOT EXISTS tariffs (
  vehicle_type TEXT PRIMARY KEY,
  amount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  plate TEXT NOT NULL,
  entry_gate_code TEXT,
  entry_time TEXT,
  exit_gate_code TEXT,
  exit_time TEXT,
  status TEXT NOT NULL DEFAULT 'PARKED',
  amount INTEGER,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_method TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const defaultTariffs = [
  ['motorcycle', 3000],
  ['car', 5000],
  ['truck', 5000],
  ['bus', 5000],
];
const insertTariff = db.prepare('INSERT OR IGNORE INTO tariffs (vehicle_type, amount) VALUES (?, ?)');
for (const [type, amount] of defaultTariffs) insertTariff.run(type, amount);

const defaultGates = [
  ['GATE-A', 'Main Entrance', 'entry'],
  ['GATE-B', 'Main Exit', 'exit'],
];
const insertGate = db.prepare('INSERT OR IGNORE INTO gates (code, name, kind) VALUES (?, ?, ?)');
for (const [code, name, kind] of defaultGates) insertGate.run(code, name, kind);

module.exports = db;
