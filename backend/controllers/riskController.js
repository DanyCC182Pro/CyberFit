const Risk = require('../models/Risk');

const SEED_RISKS = [
  { code: 'R-01', residualProbability: 2, residualImpact: 4, status: 'Implementado', asset: 'Cuentas y credenciales', threat: 'Intentos automatizados de acceso', vulnerability: 'Contraseñas débiles o reutilizadas', probability: 4, impact: 5, controls: 'Política de contraseñas, rate limiting, 2FA y monitoreo de autenticación', responsible: 'Equipo de desarrollo' },
  { code: 'R-02', residualProbability: 1, residualImpact: 5, status: 'Implementado', asset: 'Historial de entrenamientos', threat: 'Acceso indebido a registros de otros usuarios', vulnerability: 'Autorización insuficiente por recurso', probability: 3, impact: 5, controls: 'Autorización en backend, consultas filtradas por userId y pruebas de aislamiento', responsible: 'Backend' },
  { code: 'R-03', residualProbability: 2, residualImpact: 4, status: 'Implementado', asset: 'Sesiones de autenticación', threat: 'Secuestro de sesión', vulnerability: 'Configuración inadecuada de cookies o sesión', probability: 3, impact: 5, controls: 'HttpOnly, SameSite, Secure en HTTPS, regeneración de sesión y expiración', responsible: 'Backend' },
  { code: 'R-04', residualProbability: 2, residualImpact: 3, status: 'Implementado', asset: 'Archivos cargados', threat: 'Carga de archivos no autorizados', vulnerability: 'Validación insuficiente de tipo o tamaño', probability: 3, impact: 4, controls: 'Multer con límite de tamaño, filtro de MIME y nombres generados por servidor', responsible: 'Backend' },
  { code: 'R-05', residualProbability: 2, residualImpact: 3, status: 'Pendiente de verificación', asset: 'Configuración de servicios externos', threat: 'Error en OAuth', vulnerability: 'URI u origen autorizados incorrectamente', probability: 3, impact: 4, controls: 'Revisión de Google Cloud OAuth, URLs exactas y manejo de errores', responsible: 'Configuración' },
  { code: 'R-06', residualProbability: 2, residualImpact: 4, status: 'En implementación', asset: 'Datos personales y preferencias', threat: 'Pérdida o divulgación de información', vulnerability: 'Protecciones incompletas de almacenamiento y exposición', probability: 3, impact: 5, controls: 'Minimización, control de acceso, backups y protección de respuestas API', responsible: 'Equipo CyberFit' },
  { code: 'R-07', residualProbability: 1, residualImpact: 4, status: 'Implementado', asset: 'Entradas de la aplicación', threat: 'Inyección o manipulación de datos', vulnerability: 'Validación insuficiente en servidor', probability: 2, impact: 4, controls: 'Express-validator, esquemas Mongoose y sanitización de entradas', responsible: 'Backend' },
  { code: 'R-08', residualProbability: 1, residualImpact: 5, status: 'En implementación', asset: 'Secretos del servidor', threat: 'Exposición accidental', vulnerability: 'Credenciales en código, logs o repositorio', probability: 2, impact: 5, controls: 'Variables de entorno, .env ignorado y rotación de secretos', responsible: 'DevOps' },
];

function level(score) { return score >= 16 ? 'Crítico' : score >= 10 ? 'Alto' : score >= 5 ? 'Moderado' : 'Bajo'; }
function priority(score) { return score >= 16 ? 'Crítica' : score >= 10 ? 'Alta' : score >= 5 ? 'Media' : 'Baja'; }
function withComputed(risk) {
  const item = risk.toObject ? risk.toObject() : risk;
  item.score = item.probability * item.impact;
  item.level = level(item.score);
  item.residualScore = (item.residualProbability || 1) * (item.residualImpact || 1);
  item.residualLevel = level(item.residualScore);
  return item;
}

async function ensureSeed(userId) {
  const count = await Risk.countDocuments({ user: userId });
  if (count) return;
  await Risk.insertMany(SEED_RISKS.map((risk) => ({ ...risk, user: userId, treatmentPriority: priority(risk.probability * risk.impact) })));
}

async function listRisks(req, res) {
  try { await ensureSeed(req.session.userId); const risks = await Risk.find({ user: req.session.userId }).sort({ probability: -1, impact: -1 }).lean(); res.json(risks.map(withComputed)); }
  catch (error) { res.status(500).json({ error: 'No se pudo cargar la matriz de riesgos' }); }
}

async function updateRisk(req, res) {
  try {
    const risk = await Risk.findOne({ _id: req.params.id, user: req.session.userId });
    if (!risk) return res.status(404).json({ error: 'Riesgo no encontrado' });
    const fields = ['asset', 'threat', 'vulnerability', 'controls', 'responsible', 'status', 'treatmentPriority'];
    fields.forEach((field) => { if (req.body[field] !== undefined) risk[field] = String(req.body[field]).trim(); });
    ['probability', 'impact', 'residualProbability', 'residualImpact'].forEach((field) => { if (req.body[field] !== undefined) risk[field] = Math.max(1, Math.min(5, Number(req.body[field]))); });
    risk.treatmentPriority = priority(risk.probability * risk.impact);
    await risk.save();
    res.json({ message: 'Riesgo actualizado', risk: withComputed(risk) });
  } catch (error) { res.status(400).json({ error: 'No se pudo actualizar el riesgo' }); }
}

module.exports = { listRisks, updateRisk };
