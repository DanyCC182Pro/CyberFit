const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, trim: true, maxlength: 20 },
    asset: { type: String, required: true, trim: true, maxlength: 160 },
    threat: { type: String, required: true, trim: true, maxlength: 300 },
    vulnerability: { type: String, required: true, trim: true, maxlength: 300 },
    probability: { type: Number, min: 1, max: 5, required: true },
    impact: { type: Number, min: 1, max: 5, required: true },
    controls: { type: String, trim: true, maxlength: 1000, default: '' },
    responsible: { type: String, trim: true, maxlength: 120, default: 'Equipo CyberFit' },
    residualProbability: { type: Number, min: 1, max: 5, default: 2 },
    residualImpact: { type: Number, min: 1, max: 5, default: 2 },
    treatmentPriority: { type: String, enum: ['Baja', 'Media', 'Alta', 'Crítica'], default: 'Media' },
    status: { type: String, enum: ['Propuesto', 'En implementación', 'Implementado', 'Pendiente de verificación'], default: 'Propuesto' },
    academicEstimate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

riskSchema.index({ user: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Risk', riskSchema);
