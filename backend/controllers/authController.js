const bcrypt = require('bcrypt');
const User = require('../models/User');
const { generateSecret, verifyCode, otpauthUrl, randomRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, encryptSecret, decryptSecret } = require('../utils/totp');
const { logEvent, detectBruteForce, recentEvents } = require('../utils/audit');
const { isLocked, registerFailure, clearFailures } = require('../utils/lockout');
const { POLICY_VERSION } = require('./privacyController');

const SALT_ROUNDS = 12;

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    provider: user.provider,
    authMethods: { password: Boolean(user.passwordHash), google: Boolean(user.googleId) },
    profileImage: user.profileImage,
    preferences: user.preferences,
    goals: user.goals,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ error: 'Ya existe una cuenta con este correo' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({ name, email: normalizedEmail, passwordHash, provider: 'local', role: 'user', consent: { acceptedAt: new Date(), policyVersion: POLICY_VERSION } });
    await logEvent(req, 'REGISTER', { user: newUser._id, detail: 'Cuenta local + autorización de datos' });
    return res.status(201).json({ message: 'Usuario registrado correctamente', user: publicUser(newUser) });
  } catch (error) {
    console.error('Error en registro:', error.message);
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+failedLoginAttempts +lockUntil');
    if (isLocked(user)) { await logEvent(req, 'LOGIN_LOCKED', { user: user._id, severity: 'warning' }); return res.status(429).json({ error: 'Demasiados intentos para esta cuenta. Inténtalo de nuevo en unos minutos.' }); }
    const valid = user && user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) {
      if (user) { const st = await registerFailure(User, user); if (st.lockUntil) await logEvent(req, 'ACCOUNT_LOCKED', { user: user._id, severity: 'alert', detail: `Bloqueo hasta ${st.lockUntil.toISOString()}` }); }
      await logEvent(req, 'LOGIN_FAIL', { user: user?._id, email, severity: 'warning' });
      await detectBruteForce(req, email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (user.twoFactorEnabled) {
      req.session.pending2faUserId = user._id.toString();
      return res.status(200).json({ requires2fa: true, message: 'Se requiere el segundo factor de autenticación' });
    }

    await regenerateSession(req);
    req.session.userId = user._id.toString();
    user.lastLoginAt = new Date();
    await user.save({ validateModifiedOnly: true });
    await clearFailures(User, user);
    await logEvent(req, 'LOGIN_OK', { user: user._id });
    return res.status(200).json({ message: 'Inicio de sesión exitoso', user: publicUser(user) });
  } catch (error) {
    console.error('Error en login:', error.message);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function verifyTwoFactorLogin(req, res) {
  try {
    const pendingId = req.session.pending2faUserId;
    if (!pendingId) return res.status(401).json({ error: 'No hay una autenticación pendiente' });
    const user = await User.findById(pendingId).select('+twoFactorSecret +twoFactorRecoveryCodes +failedLoginAttempts +lockUntil');
    if (isLocked(user)) return res.status(429).json({ error: 'Demasiados intentos para esta cuenta. Inténtalo de nuevo en unos minutos.' });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return res.status(401).json({ error: 'Autenticación 2FA no disponible' });

    const totpSecret = decryptSecret(user.twoFactorSecret);
    let accepted = verifyCode(totpSecret, req.body.code);
    let usedRecoveryCode = null;
    if (!accepted && req.body.recoveryCode) {
      const index = user.twoFactorRecoveryCodes.findIndex((stored) => verifyRecoveryCode(req.body.recoveryCode, stored));
      if (index >= 0) {
        accepted = true;
        usedRecoveryCode = index;
        user.twoFactorRecoveryCodes.splice(index, 1);
      }
    }
    if (!accepted) { await registerFailure(User, user); await logEvent(req, '2FA_FAIL', { user: user._id, severity: 'warning' }); return res.status(401).json({ error: 'Código de verificación incorrecto' }); }
    await clearFailures(User, user);
    if (usedRecoveryCode !== null) await logEvent(req, '2FA_RECOVERY_USED', { user: user._id, severity: 'warning' });

    await regenerateSession(req);
    req.session.userId = user._id.toString();
    user.lastLoginAt = new Date();
    await user.save({ validateModifiedOnly: true });
    await logEvent(req, 'LOGIN_OK', { user: user._id, detail: 'con 2FA' });
    return res.status(200).json({ message: 'Segundo factor verificado', user: publicUser(user), recoveryCodesRemaining: user.twoFactorRecoveryCodes.length });
  } catch (error) {
    console.error('Error en verificación 2FA:', error.message);
    return res.status(500).json({ error: 'No se pudo verificar el segundo factor' });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.session.userId).select('-passwordHash -twoFactorSecret -twoFactorRecoveryCodes');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.status(200).json(publicUser(user));
  } catch (error) {
    console.error('Error en /me:', error.message);
    return res.status(500).json({ error: 'Error al obtener el usuario' });
  }
}

async function securityStatus(req, res) {
  try {
    const user = await User.findById(req.session.userId).select('+twoFactorRecoveryCodes');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({
      twoFactorEnabled: user.twoFactorEnabled,
      authMethods: { password: Boolean(user.passwordHash), google: Boolean(user.googleId) },
      recoveryCodesRemaining: user.twoFactorRecoveryCodes.length,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) { return res.status(500).json({ error: 'No se pudo obtener el estado de seguridad' }); }
}

async function setupTwoFactor(req, res) {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.twoFactorEnabled) return res.status(409).json({ error: '2FA ya está activado' });

    const secret = generateSecret();
    req.session.pending2faSetupSecret = secret;
    const url = otpauthUrl({ secret, email: user.email });
    return res.json({ otpauthUrl: url, secret, issuer: 'CyberFit', email: user.email });
  } catch (error) { return res.status(500).json({ error: 'No se pudo preparar 2FA' }); }
}

async function enableTwoFactor(req, res) {
  try {
    const secret = req.session.pending2faSetupSecret;
    if (!secret) return res.status(400).json({ error: 'Primero inicia la configuración de 2FA' });
    if (!verifyCode(secret, req.body.code)) return res.status(401).json({ error: 'El código no coincide. Revisa tu aplicación autenticadora.' });

    const user = await User.findById(req.session.userId).select('+twoFactorSecret +twoFactorRecoveryCodes');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const recoveryCodes = randomRecoveryCodes(8);
    user.twoFactorSecret = encryptSecret(secret);
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = recoveryCodes.map((c) => hashRecoveryCode(c));
    await user.save();
    delete req.session.pending2faSetupSecret;
    await logEvent(req, '2FA_ENABLED', { user: user._id });

    return res.json({ message: '2FA activado correctamente', recoveryCodes });
  } catch (error) { return res.status(500).json({ error: 'No se pudo activar 2FA' }); }
}

async function disableTwoFactor(req, res) {
  try {
    const user = await User.findById(req.session.userId).select('+twoFactorSecret +twoFactorRecoveryCodes');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return res.status(400).json({ error: '2FA ya está desactivado' });

    const totpSecret = decryptSecret(user.twoFactorSecret);
    let accepted = verifyCode(totpSecret, req.body.code);
    if (!accepted && user.passwordHash && req.body.password) accepted = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!accepted) return res.status(401).json({ error: 'Verificación requerida para desactivar 2FA' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();
    await logEvent(req, '2FA_DISABLED', { user: user._id, severity: 'warning' });
    return res.json({ message: '2FA desactivado' });
  } catch (error) { return res.status(500).json({ error: 'No se pudo desactivar 2FA' }); }
}

async function logout(req, res) {
  await logEvent(req, 'LOGOUT', { user: req.session.userId });
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    return res.status(200).json({ message: 'Sesión cerrada correctamente' });
  });
}

async function securityEvents(req, res) {
  try { return res.json(await recentEvents(req.session.userId, 30)); }
  catch (e) { return res.status(500).json({ error: 'No se pudo cargar la actividad' }); }
}

module.exports = { securityEvents, register, login, verifyTwoFactorLogin, me, logout, securityStatus, setupTwoFactor, enableTwoFactor, disableTwoFactor, publicUser };
