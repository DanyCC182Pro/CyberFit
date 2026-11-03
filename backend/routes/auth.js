const express = require('express');
const passport = require('passport');
const {
  register, login, verifyTwoFactorLogin, me, logout,
  securityStatus, setupTwoFactor, enableTwoFactor, disableTwoFactor, securityEvents,
} = require('../controllers/authController');
const requireAuth = require('../middleware/authMiddleware');
const { registerValidation, loginValidation, handleValidationErrors } = require('../middleware/validators');

const { issueToken } = require('../middleware/csrf');
const { logEvent } = require('../utils/audit');
const router = express.Router();
router.get('/csrf', issueToken);
router.post('/register', registerValidation, handleValidationErrors, register);
router.post('/login', loginValidation, handleValidationErrors, login);
router.post('/2fa/verify', verifyTwoFactorLogin);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);
router.get('/security', requireAuth, securityStatus);
router.get('/events', requireAuth, securityEvents);
router.post('/2fa/setup', requireAuth, setupTwoFactor);
router.post('/2fa/enable', requireAuth, enableTwoFactor);
router.post('/2fa/disable', requireAuth, disableTwoFactor);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login.html?error=google' }), async (req, res) => {
  try {
    if (req.user.twoFactorEnabled) {
      await new Promise((resolve, reject) => req.session.regenerate((e) => e ? reject(e) : resolve()));
      req.session.pending2faUserId = req.user._id.toString();
      return res.redirect('/login.html?mfa=1');
    }
    await new Promise((resolve, reject) => req.session.regenerate((e) => e ? reject(e) : resolve()));
    req.session.userId = req.user._id.toString();
    await req.user.updateOne({ lastLoginAt: new Date() });
    await logEvent(req, 'LOGIN_OK', { user: req.user._id, detail: 'Google' });
    if (!req.user.consent?.acceptedAt) return res.redirect('/privacy.html?consent=required');
    return res.redirect('/dashboard.html');
  } catch (error) { return res.redirect('/login.html?error=google'); }
});

module.exports = router;
