// Política de contraseñas alineada con NIST SP 800-63B: longitud mínima + rechazo de contraseñas comunes
// o derivadas del usuario (sin reglas de composición arbitrarias). Control ISO/IEC 27002 5.17.
const COMMON = new Set(`123456 1234567 12345678 123456789 1234567890 12345678910 password password1 password123 passw0rd qwerty qwerty123 qwertyuiop
abc123 abcd1234 111111 11111111 000000 00000000 123123 123321 654321 666666 121212 112233 iloveyou iloveyou1 admin admin123 administrator welcome welcome1
letmein monkey dragon master login princess sunshine football futbol baseball soccer superman batman trustno1 shadow michael jennifer
contrasena contraseña contrasena1 clave123 colombia colombia1 colombia123 bogota123 bogota hola1234 holamundo te4mo1234 123456a a123456 1q2w3e4r 1q2w3e
zaq12wsx asdfghjk asdf1234 qazwsxedc q1w2e3r4 gimnasio gimnasio1 cyberfit cyberfit1 cyberfit123 fitness123 entrenar123 mipassword mipassword1 pass1234 test1234 changeme`.split(/\s+/));

function validatePassword(password, { email = '', name = '' } = {}) {
  const pw = String(password || '');
  if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (pw.length > 128) return 'La contraseña no puede superar 128 caracteres';
  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return 'Esa contraseña es demasiado común. Elige una más difícil de adivinar';
  if (/^(.)\1+$/.test(pw)) return 'La contraseña no puede ser un solo carácter repetido';
  if ('abcdefghijklmnopqrstuvwxyz0123456789'.includes(lower) || '0123456789876543210'.includes(lower)) return 'La contraseña no puede ser una secuencia simple';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'La contraseña no debe contener tu correo';
  const first = String(name).trim().split(/\s+/)[0].toLowerCase();
  if (first.length >= 4 && lower.includes(first)) return 'La contraseña no debe contener tu nombre';
  return null;
}
module.exports = { validatePassword, COMMON };
