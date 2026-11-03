const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { logEvent } = require('../utils/audit');
const { UPLOAD_DIR } = require('../middleware/upload');

function publicUser(user) {
  return {
    id: user._id, name: user.name, email: user.email, role: user.role, provider: user.provider,
    authMethods: { password: Boolean(user.passwordHash), google: Boolean(user.googleId) },
    profileImage: user.profileImage, preferences: user.preferences, goals: user.goals,
    twoFactorEnabled: Boolean(user.twoFactorEnabled), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
  };
}

async function updateProfile(req, res) {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'El nombre debe tener entre 2 y 80 caracteres' });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.name = name;
    if (req.body.preferences) {
      const p = req.body.preferences;
      if (p.trainingGoal !== undefined) user.preferences.trainingGoal = String(p.trainingGoal).slice(0, 120);
      if (p.experience !== undefined) user.preferences.experience = String(p.experience).slice(0, 80);
      if (p.nutritionPreference !== undefined) user.preferences.nutritionPreference = String(p.nutritionPreference).slice(0, 120);
      if (p.animationLevel !== undefined && ['full', 'reduced'].includes(p.animationLevel)) user.preferences.animationLevel = p.animationLevel;
    }
    if (req.body.goals) {
      if (req.body.goals.weeklySessions !== undefined) user.goals.weeklySessions = Math.max(1, Math.min(14, Number(req.body.goals.weeklySessions)));
      if (req.body.goals.weeklyMinutes !== undefined) user.goals.weeklyMinutes = Math.max(1, Math.min(2000, Number(req.body.goals.weeklyMinutes)));
    }
    await user.save();
    await logEvent(req, 'PROFILE_UPDATED', { user: user._id });
    return res.json({ message: 'Perfil actualizado', user: publicUser(user) });
  } catch (error) { console.error('Error al actualizar perfil:', error.message); return res.status(500).json({ error: 'Error al actualizar el perfil' }); }
}

async function uploadProfileImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    const imageUrl = `/uploads/${req.file.filename}`;
    const before = await User.findById(req.session.userId).select('profileImage');
    const user = await User.findByIdAndUpdate(req.session.userId, { profileImage: imageUrl }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (before?.profileImage?.startsWith('/uploads/')) fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(before.profileImage))).catch(() => {});
    await logEvent(req, 'PROFILE_IMAGE_CHANGED', { user: user._id });
    return res.json({ message: 'Foto de perfil actualizada', profileImage: user.profileImage });
  } catch (error) { console.error('Error al subir imagen:', error.message); return res.status(500).json({ error: 'Error al subir la imagen' }); }
}

module.exports = { updateProfile, uploadProfileImage };
