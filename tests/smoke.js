const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { generateSecret, generateCode, verifyCode, encryptSecret, decryptSecret } = require('../backend/utils/totp');

const root = path.join(__dirname, '..');
const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full.endsWith('.js')) jsFiles.push(full);
  }
}
walk(root);
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Sintaxis inválida en ${path.relative(root, file)}: ${result.stderr}`);
}

process.env.TOTP_ENCRYPTION_KEY = 'cyberfit-smoke-test-key';
const secret = generateSecret();
const code = generateCode(secret);
if (!verifyCode(secret, code)) throw new Error('La verificación TOTP falló');
const encrypted = encryptSecret(secret);
if (decryptSecret(encrypted) !== secret) throw new Error('El cifrado TOTP falló');

for (const required of ['frontend/index.html','frontend/dashboard.html','frontend/security.html','frontend/risks.html','frontend/privacy.html','backend/models/AuditLog.js','backend/middleware/csrf.js','backend/models/Workout.js','backend/models/Meal.js','backend/models/Risk.js']) {
  if (!fs.existsSync(path.join(root, required))) throw new Error(`Falta ${required}`);
}

console.log(`Smoke tests OK: ${jsFiles.length} archivos JS verificados + TOTP + estructura.`);
