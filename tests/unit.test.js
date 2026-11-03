// Pruebas unitarias (node --test). No requieren conexión a MongoDB.
process.env.TOTP_ENCRYPTION_KEY = 'clave-de-pruebas';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const Module = require('module');
const totp = require('../backend/utils/totp');
const { validatePassword } = require('../backend/utils/passwordPolicy');
const { nextLockState, isLocked } = require('../backend/utils/lockout');
const { csrfProtection, issueToken } = require('../backend/middleware/csrf');
const { detectImageType } = require('../backend/middleware/upload');
const { validateEnv } = require('../backend/config/env');

test('TOTP cumple el vector de prueba de la RFC 6238 (t=59 s)', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890" en base32
  assert.equal(totp.generateCode(secret, 59_000), '287082');
});
test('TOTP: verificación y cifrado AES-256-GCM del secreto', () => {
  const s = totp.generateSecret();
  assert.ok(totp.verifyCode(s, totp.generateCode(s)));
  assert.ok(!totp.verifyCode(s, '000000') || totp.generateCode(s) === '000000');
  assert.equal(totp.decryptSecret(totp.encryptSecret(s)), s);
});
test('Códigos de recuperación: con sal, un solo uso y compatibles con el formato antiguo', () => {
  const [c] = totp.randomRecoveryCodes(1);
  assert.match(c, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
  const h1 = totp.hashRecoveryCode(c), h2 = totp.hashRecoveryCode(c);
  assert.notEqual(h1, h2); // sal distinta
  assert.ok(totp.verifyRecoveryCode(c.toLowerCase().replace(/-/g, ' '), h1));
  assert.ok(!totp.verifyRecoveryCode('0000-0000-0000-0000', h1));
  const legacy = require('crypto').createHash('sha256').update('ABCDEF0123').digest('hex');
  assert.ok(totp.verifyRecoveryCode('abcdef0123', legacy));
});
test('Política de contraseñas (NIST 800-63B)', () => {
  assert.ok(validatePassword('corta'));
  assert.ok(validatePassword('password123'));
  assert.ok(validatePassword('aaaaaaaaaa'));
  assert.ok(validatePassword('12345678'));
  assert.ok(validatePassword('danielcubillos99', { email: 'x@y.com', name: 'Daniel Cubillos' }));
  assert.equal(validatePassword('caballo-bateria-grapa-7', { email: 'a@b.com', name: 'Ana' }), null);
});
test('Bloqueo por cuenta tras 5 intentos fallidos', () => {
  assert.equal(nextLockState(3).lockUntil, null);
  const s = nextLockState(4, 1_000_000);
  assert.equal(s.lockUntil.getTime(), 1_000_000 + 15 * 60 * 1000);
  assert.ok(isLocked({ lockUntil: new Date(Date.now() + 5000) }));
  assert.ok(!isLocked({ lockUntil: new Date(Date.now() - 5000) }));
});
test('Validación de firma real de imágenes', () => {
  const pad = Buffer.alloc(20);
  assert.equal(detectImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), '.jpg');
  assert.equal(detectImageType(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), '.png');
  assert.equal(detectImageType(Buffer.from('<?php echo 1; ?>' + ' '.repeat(20))), null);
  assert.equal(detectImageType(Buffer.from('<svg onload=alert(1)></svg>' + ' '.repeat(20))), null);
});
test('Validación de entorno: rechaza secretos de ejemplo en producción', () => {
  assert.throws(() => validateEnv({ NODE_ENV: 'production', MONGODB_URI: 'x', SESSION_SECRET: 'replace_with_a_long_random_secret' }), /Configuración insegura/);
  assert.doesNotThrow(() => validateEnv({ NODE_ENV: 'production', MONGODB_URI: 'x', SESSION_SECRET: 'a'.repeat(40), TOTP_ENCRYPTION_KEY: 'b'.repeat(40), FRONTEND_ORIGIN: 'https://x.co' }));
});
test('CSRF: rechaza escrituras sin token y acepta el token de la sesión', async () => {
  const app = express();
  app.use((req, _res, next) => { req.session = global.__s || (global.__s = {}); next(); });
  app.get('/csrf', issueToken);
  app.use(csrfProtection);
  app.post('/w', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0); const port = server.address().port;
  const call = (method, path, headers = {}) => new Promise((resolve) => { const r = http.request({ port, method, path, headers }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d })); }); r.end(); });
  try {
    assert.equal((await call('POST', '/w')).status, 403);
    assert.equal((await call('POST', '/w', { 'x-csrf-token': 'falso' })).status, 403);
    const { csrfToken } = JSON.parse((await call('GET', '/csrf')).body);
    assert.equal((await call('POST', '/w', { 'x-csrf-token': csrfToken })).status, 200);
  } finally { server.close(); }
});
test('Aislamiento entre usuarios: toda consulta se filtra por el usuario autenticado', async () => {
  const seen = [];
  const fakeQuery = (rows) => { const q = { sort: () => q, limit: () => q, lean: () => Promise.resolve(rows), then: (r) => r(rows) }; return q; };
  const fakeModel = (name) => ({ find: (f) => { seen.push([name, f]); return fakeQuery([]); }, countDocuments: (f) => { seen.push([name, f]); return Promise.resolve(0); } });
  const original = Module._load;
  Module._load = function (request, ...rest) {
    if (/models\/(Workout|Meal)$/.test(request)) return fakeModel(request.split('/').pop());
    return original.call(this, request, ...rest);
  };
  try {
    const wk = require('../backend/controllers/workoutController'), ml = require('../backend/controllers/mealController');
    const res = { json: () => {}, status: () => ({ json: () => {} }) };
    await wk.listWorkouts({ query: {}, session: { userId: 'usuario-A' } }, res);
    await wk.summary({ query: {}, session: { userId: 'usuario-A' } }, res);
    await ml.listMeals({ query: {}, session: { userId: 'usuario-A' } }, res);
  } finally { Module._load = original; }
  assert.ok(seen.length >= 4);
  for (const [name, filter] of seen) assert.equal(filter.user, 'usuario-A', `${name} sin filtro por usuario`);
});
