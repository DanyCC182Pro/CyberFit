const mongoose = require('mongoose');
// Bitácora de eventos de seguridad (ISO/IEC 27002 8.15). Retención: 180 días (índice TTL).
const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  emailHash: { type: String, default: null, index: true }, // hash del correo: no se guarda el correo de intentos fallidos
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['info', 'warning', 'alert'], default: 'info' },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null, maxlength: 200 },
  detail: { type: String, default: '', maxlength: 300 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
}, { versionKey: false });
auditSchema.index({ type: 1, ip: 1, createdAt: -1 });
module.exports = mongoose.model('AuditLog', auditSchema);
