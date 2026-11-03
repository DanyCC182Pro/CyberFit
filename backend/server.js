require('dotenv').config();
require('./config/env').validateEnv();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const connectDB = require('./config/database');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workoutRoutes = require('./routes/workouts');
const mealRoutes = require('./routes/meals');
const riskRoutes = require('./routes/risks');
const privacyRoutes = require('./routes/privacy');
const requireAuth = require('./middleware/authMiddleware');
const { csrfProtection } = require('./middleware/csrf');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const frontendOrigin = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

if (IS_PRODUCTION) app.set('trust proxy', 1);
app.disable('x-powered-by');
connectDB();

app.use(helmet({
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: false, // MediaPipe/Chart.js/Google se cargan de CDN en el prototipo.
}));
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: 60 * 60 * 24 }),
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

// Archivos subidos: solo el propietario autenticado puede verlos; nombre validado contra path traversal.
app.get('/uploads/:file', requireAuth, (req, res) => {
  const { file } = req.params;
  if (!/^[a-f0-9]{24}-[a-f0-9]{32}\.(jpg|png|gif|webp)$/.test(file) || !file.startsWith(`${req.session.userId}-`)) return res.status(404).end();
  res.set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, max-age=3600');
  res.sendFile(file, { root: uploadsPath, dotfiles: 'deny' }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
});

app.use(passport.initialize());
app.use(passport.session());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const mfaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Demasiados intentos de verificación. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/2fa/verify', mfaLimiter);

// CSRF: toda petición de escritura a la API requiere el token de la sesión (GET /api/auth/csrf).
app.use('/api', csrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/risks', riskRoutes);

app.get('/api/ping', (req, res) => res.json({ message: 'CyberFit backend funcionando correctamente', time: new Date().toISOString() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'cyberfit', environment: process.env.NODE_ENV || 'development' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta API no encontrada' });
  next();
});

app.use((error, req, res, next) => {
  console.error('Error no controlado:', error.message);
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La imagen supera el máximo de 5 MB' });
  if (error.message === 'Solo se permiten imágenes') return res.status(400).json({ error: error.message });
  return res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CyberFit corriendo en el puerto ${PORT}`);
});
