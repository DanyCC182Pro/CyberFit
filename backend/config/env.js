// Validación de variables de entorno al arrancar (control 8.9 / 5.17).
// En producción el servidor se niega a iniciar con secretos ausentes o de ejemplo.
function validateEnv(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];
  const isPlaceholder = (v) => !v || /replace_with|your_|changeme/i.test(v);
  if (!env.MONGODB_URI) errors.push('MONGODB_URI es obligatoria');
  if (isPlaceholder(env.SESSION_SECRET)) errors.push('SESSION_SECRET es obligatoria y no puede ser el valor de ejemplo');
  else if (env.SESSION_SECRET.length < 32) (prod ? errors : warnings).push('SESSION_SECRET debería tener al menos 32 caracteres');
  if (isPlaceholder(env.TOTP_ENCRYPTION_KEY)) (prod ? errors : warnings).push('TOTP_ENCRYPTION_KEY no está definida: define una clave propia para cifrar el secreto 2FA');
  if (prod && !/^https:/i.test(env.FRONTEND_ORIGIN || '')) warnings.push('FRONTEND_ORIGIN debería usar HTTPS en producción');
  warnings.forEach((w) => console.warn('⚠️  [config]', w));
  if (errors.length) throw new Error(`Configuración insegura:\n - ${errors.join('\n - ')}`);
  return { prod, warnings };
}
module.exports = { validateEnv };
