const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const WINDOW_MS = 15 * 60 * 1000;
const ALERT_THRESHOLD = 5;
const hashEmail = (email) => (email ? crypto.createHash('sha256').update(String(email).toLowerCase().trim()).digest('hex') : null);

// Registra un evento. Nunca debe romper el flujo principal.
async function logEvent(req, type, { user = null, email = null, severity = 'info', detail = '' } = {}) {
  try {
    await AuditLog.create({
      user, emailHash: hashEmail(email), type, severity,
      ip: req?.ip || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 200), detail: String(detail).slice(0, 300),
    });
  } catch (e) { console.error('Audit log error:', e.message); }
}

// Detección básica (ISO/IEC 27002 8.16): ≥5 fallos en 15 min por IP o por cuenta => alerta.
async function detectBruteForce(req, email) {
  try {
    const since = new Date(Date.now() - WINDOW_MS);
    const [byIp, byAccount] = await Promise.all([
      AuditLog.countDocuments({ type: 'LOGIN_FAIL', ip: req.ip, createdAt: { $gte: since } }),
      email ? AuditLog.countDocuments({ type: 'LOGIN_FAIL', emailHash: hashEmail(email), createdAt: { $gte: since } }) : 0,
    ]);
    if (byIp >= ALERT_THRESHOLD || byAccount >= ALERT_THRESHOLD) {
      const already = await AuditLog.exists({ type: 'ALERTA_FUERZA_BRUTA', ip: req.ip, createdAt: { $gte: since } });
      if (!already) {
        console.warn(`🚨 [seguridad] Posible fuerza bruta: ip=${req.ip} fallosIP=${byIp} fallosCuenta=${byAccount}`);
        await logEvent(req, 'ALERTA_FUERZA_BRUTA', { email, severity: 'alert', detail: `Fallos en 15 min: IP=${byIp}, cuenta=${byAccount}` });
      }
    }
  } catch (e) { console.error('Detección error:', e.message); }
}

async function recentEvents(userId, limit = 30) {
  return AuditLog.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).select('type severity ip detail createdAt -_id').lean();
}
module.exports = { logEvent, detectBruteForce, recentEvents, hashEmail, ALERT_THRESHOLD };
