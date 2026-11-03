const crypto = require('crypto');
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input || '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0, value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error('Secreto TOTP inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateSecret() { return base32Encode(crypto.randomBytes(20)); }

function generateCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

function verifyCode(secret, code, window = 1) {
  const normalized = String(code || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  for (let i = -window; i <= window; i += 1) {
    const candidate = generateCode(secret, now + i * 30_000);
    const a = Buffer.from(candidate), b = Buffer.from(normalized);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

function otpauthUrl({ secret, email, issuer = 'CyberFit' }) {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function randomRecoveryCodes(count = 8) {
  // 64 bits de aleatoriedad, formato XXXX-XXXX-XXXX-XXXX
  return Array.from({ length: count }, () => crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g).join('-'));
}

const normalizeRecovery = (c) => String(c || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
// Formato v2$sal$hmac (sal aleatoria por código). Se mantiene compatibilidad con hashes SHA-256 antiguos.
function hashRecoveryCode(code, salt = crypto.randomBytes(16).toString('hex')) {
  return `v2$${salt}$${crypto.createHmac('sha256', salt).update(normalizeRecovery(code)).digest('hex')}`;
}
function verifyRecoveryCode(code, stored) {
  const s = String(stored || '');
  const expected = s.startsWith('v2$') ? hashRecoveryCode(code, s.split('$')[1]) : crypto.createHash('sha256').update(normalizeRecovery(code)).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { generateSecret, generateCode, verifyCode, otpauthUrl, randomRecoveryCodes, hashRecoveryCode, verifyRecoveryCode };

function encryptionKey() {
  if (process.env.NODE_ENV === 'production' && !process.env.TOTP_ENCRYPTION_KEY) throw new Error('TOTP_ENCRYPTION_KEY es obligatoria en producción');
  return crypto.createHash('sha256').update(process.env.TOTP_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'cyberfit-development-key').digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(value) {
  const [ivRaw, tagRaw, encryptedRaw] = String(value || '').split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Secreto TOTP almacenado inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
}

module.exports.encryptSecret = encryptSecret;
module.exports.decryptSecret = decryptSecret;
