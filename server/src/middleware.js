const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login diperlukan.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang.' });
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login admin diperlukan.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi admin tidak valid.' });
  }
}

function requireGateKey(req, res, next) {
  const key = req.headers['x-gate-key'];
  if (!key || key !== process.env.GATE_API_KEY) {
    return res.status(401).json({ error: 'Gate API key tidak valid.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireGateKey };
