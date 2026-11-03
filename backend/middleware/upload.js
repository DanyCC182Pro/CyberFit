const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '../uploads'); // fuera de la carpeta pública del frontend
const SIGNATURES = [
  { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.gif', test: (b) => ['GIF87a', 'GIF89a'].includes(b.slice(0, 6).toString('latin1')) },
  { ext: '.webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
];
const detectImageType = (buffer) => (buffer && buffer.length > 12 ? (SIGNATURES.find((s) => s.test(buffer)) || {}).ext || null : null);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo se permiten imágenes'))),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Valida la firma real del archivo, fija la extensión desde una lista permitida y genera un nombre aleatorio.
function validateImage(req, res, next) {
  if (!req.file) return next();
  const ext = detectImageType(req.file.buffer);
  if (!ext) return res.status(400).json({ error: 'Solo se permiten imágenes' });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${req.session.userId}-${crypto.randomBytes(16).toString('hex')}${ext}`;
  fs.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer, { mode: 0o640 }, (err) => {
    if (err) return next(err);
    req.file.filename = filename;
    next();
  });
}
module.exports = upload;
module.exports.validateImage = validateImage;
module.exports.detectImageType = detectImageType;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
