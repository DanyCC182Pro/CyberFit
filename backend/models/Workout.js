const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sets: { type: Number, min: 0, max: 100, default: 1 },
    reps: { type: Number, min: 0, max: 1000, default: 0 },
    weight: { type: Number, min: 0, max: 1000, default: 0 },
    durationSeconds: { type: Number, min: 0, max: 86400, default: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false }
);

const workoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    routineName: { type: String, trim: true, maxlength: 120, default: 'Sesión libre' },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationSeconds: { type: Number, min: 0, max: 86400, default: 0 },
    status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
    exerciseType: { type: String, default: null },
    exercises: { type: [exerciseSchema], default: [] },
    observations: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

workoutSchema.index({ user: 1, startedAt: -1 });
module.exports = mongoose.model('Workout', workoutSchema);
