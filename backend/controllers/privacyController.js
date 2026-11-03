const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Workout = require('../models/Workout');
const Meal = require('../models/Meal');
const Risk = require('../models/Risk');
const AuditLog = require('../models/AuditLog');
const { verifyCode, decryptSecret } = require('../utils/totp');
const { logEvent, hashEmail } = require('../utils/audit');
const { UPLOAD_DIR } = require('../middleware/upload');

const POLICY_VERSION = '2026-10';

async function status(req, res) {
  const user = await User.findById(req.session.userId).select('consent').lean();
  res.json({ policyVersion: POLICY_VERSION, accepted: Boolean(user?.consent?.acceptedAt), acceptedAt: user?.consent?.acceptedAt || null, version: user?.consent?.policyVersion || null });
}

async function setConsent(req, res) {
  const accept = req.body.accept === true;
  await User.updateOne({ _id: req.session.userId }, { $set: { consent: accept ? { acceptedAt: new Date(), policyVersion: POLICY_VERSION } : { acceptedAt: null, policyVersion: null } } });
  await logEvent(req, accept ? 'CONSENT_ACCEPTED' : 'CONSENT_REVOKED', { user: req.session.userId, detail: POLICY_VERSION });
  res.json({ message: accept ? 'Autorización registrada' : 'Autorización revocada: no se podrán registrar nuevos datos de salud', accepted: accept });
}

// Middleware: el tratamiento de datos de salud (sensibles) exige autorización expresa del titular (Ley 1581 de 2012).
async function requireConsent(req, res, next) {
  try {
    const user = await User.findById(req.session.userId).select('consent').lean();
    if (user?.consent?.acceptedAt) return next();
    return res.status(403).json({ error: 'Debes aceptar la política de tratamiento de datos para registrar información de salud (Privacidad).', code: 'CONSENT_REQUIRED' });
  } catch (e) { return res.status(500).json({ error: 'No se pudo verificar la autorización' }); }
}

// Derecho de acceso / portabilidad.
async function exportData(req, res) {
  const id = req.session.userId;
  const [user, workouts, meals, risks, events] = await Promise.all([
    User.findById(id).select('-passwordHash -twoFactorSecret -twoFactorRecoveryCodes -__v').lean(),
    Workout.find({ user: id }).select('-__v').lean(), Meal.find({ user: id }).select('-__v').lean(),
    Risk.find({ user: id }).select('-__v').lean(), AuditLog.find({ user: id }).select('-_id -__v').lean(),
  ]);
  await logEvent(req, 'DATA_EXPORT', { user: id });
  res.set('Content-Disposition', 'attachment; filename="cyberfit-mis-datos.json"').set('Cache-Control', 'no-store');
  res.json({ exportedAt: new Date().toISOString(), policyVersion: POLICY_VERSION, user, workouts, meals, risks, securityEvents: events });
}

// Derecho de supresión. Exige reautenticación (contraseña y/o TOTP) y confirmación escrita.
async function deleteAccount(req, res) {
  try {
    if (req.body.confirm !== 'ELIMINAR') return res.status(400).json({ error: 'Escribe ELIMINAR para confirmar' });
    const user = await User.findById(req.session.userId).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.passwordHash && !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'Contraseña incorrecta' });
    if (user.twoFactorEnabled && !verifyCode(decryptSecret(user.twoFactorSecret), req.body.code)) return res.status(401).json({ error: 'Código 2FA incorrecto' });
    const id = user._id;
    await Promise.all([Workout.deleteMany({ user: id }), Meal.deleteMany({ user: id }), Risk.deleteMany({ user: id }), AuditLog.deleteMany({ user: id })]);
    if (user.profileImage?.startsWith('/uploads/')) fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(user.profileImage))).catch(() => {});
    await User.deleteOne({ _id: id });
    await logEvent(req, 'ACCOUNT_DELETED', { email: user.email, detail: 'Supresión a solicitud del titular' }); // sin vínculo al usuario
    req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Cuenta y datos eliminados' }); });
  } catch (e) { console.error('Error eliminando cuenta:', e.message); res.status(500).json({ error: 'No se pudo eliminar la cuenta' }); }
}
module.exports = { status, setConsent, requireConsent, exportData, deleteAccount, POLICY_VERSION };
