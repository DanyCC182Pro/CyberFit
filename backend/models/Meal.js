const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mealType: { type: String, enum: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'], required: true },
    food: { type: String, required: true, trim: true, maxlength: 300 },
    portion: { type: String, trim: true, maxlength: 120, default: '' },
    calories: { type: Number, min: 0, max: 10000, default: null },
    protein: { type: Number, min: 0, max: 1000, default: null },
    carbs: { type: Number, min: 0, max: 1000, default: null },
    fats: { type: Number, min: 0, max: 1000, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    eatenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mealSchema.index({ user: 1, eatenAt: -1 });
module.exports = mongoose.model('Meal', mealSchema);
