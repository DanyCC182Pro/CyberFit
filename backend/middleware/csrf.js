const crypto = require('crypto');
// Protección CSRF con token sincronizado a la sesión (complementa SameSite=lax).
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
function issueToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: req.session.csrfToken });
}
function csrfProtection(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const expected = req.session && req.session.csrfToken;
  const received = String(req.get('x-csrf-token') || '');
  const a = Buffer.from(expected || ''), b = Buffer.from(received);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Token CSRF inválido o ausente', code: 'CSRF' });
  next();
}
module.exports = { csrfProtection, issueToken };
