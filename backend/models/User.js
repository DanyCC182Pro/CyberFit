const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: {
      type: String,
      default: null,
      required: function () { return this.provider === 'local'; },
    },
    provider: { type: String, enum: ['local', 'google'], required: true, default: 'local' },
    googleId: { type: String, default: null, sparse: true, index: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    profileImage: { type: String, default: null },
    preferences: {
      trainingGoal: { type: String, default: 'Mejorar condición física' },
      experience: { type: String, default: 'Principiante' },
      nutritionPreference: { type: String, default: 'Sin preferencia' },
      animationLevel: { type: String, enum: ['full', 'reduced'], default: 'full' },
    },
    goals: {
      weeklySessions: { type: Number, min: 1, max: 14, default: 4 },
      weeklyMinutes: { type: Number, min: 1, max: 2000, default: 180 },
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorRecoveryCodes: { type: [String], default: [], select: false },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    consent: { acceptedAt: { type: Date, default: null }, policyVersion: { type: String, default: null } },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
