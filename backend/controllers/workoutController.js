const Workout = require('../models/Workout');

function cleanExercises(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((e) => ({
    name: String(e.name || '').trim().slice(0, 120),
    sets: Math.max(0, Math.min(100, Number(e.sets) || 0)),
    reps: Math.max(0, Math.min(1000, Number(e.reps) || 0)),
    weight: Math.max(0, Math.min(1000, Number(e.weight) || 0)),
    durationSeconds: Math.max(0, Math.min(86400, Number(e.durationSeconds) || 0)),
    notes: String(e.notes || '').trim().slice(0, 500),
  })).filter((e) => e.name);
}

async function createWorkout(req, res) {
  try {
    const { routineName, startedAt, endedAt, durationSeconds, status, exerciseType, observations } = req.body;
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return res.status(400).json({ error: 'Fechas de sesión inválidas' });
    const workout = await Workout.create({
      user: req.session.userId,
      routineName: String(routineName || 'Sesión libre').trim().slice(0, 120),
      startedAt: start,
      endedAt: end,
      durationSeconds: Math.max(0, Math.min(86400, Number(durationSeconds) || Math.round((end - start) / 1000))),
      status: ['completed', 'cancelled'].includes(status) ? status : 'completed',
      exerciseType: String(exerciseType || '').slice(0, 50),
      exercises: cleanExercises(req.body.exercises),
      observations: String(observations || '').trim().slice(0, 1000),
    });
    res.status(201).json({ message: 'Entrenamiento guardado', workout });
  } catch (error) { console.error('Error creando workout:', error.message); res.status(500).json({ error: 'No se pudo guardar el entrenamiento' }); }
}

async function listWorkouts(req, res) {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const workouts = await Workout.find({ user: req.session.userId }).sort({ startedAt: -1 }).limit(limit).lean();
    res.json(workouts);
  } catch (error) { res.status(500).json({ error: 'No se pudo cargar el historial' }); }
}

async function summary(req, res) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0);
    const [monthly, recent, total] = await Promise.all([
      Workout.find({ user: req.session.userId, startedAt: { $gte: since }, status: 'completed' }).sort({ startedAt: 1 }).lean(),
      Workout.find({ user: req.session.userId, status: 'completed' }).sort({ startedAt: -1 }).limit(5).lean(),
      Workout.countDocuments({ user: req.session.userId, status: 'completed' }),
    ]);
    const totalMinutes30 = Math.round(monthly.reduce((sum, w) => sum + (w.durationSeconds || 0), 0) / 60);
    const uniqueDays = new Set(monthly.map((w) => new Date(w.startedAt).toISOString().slice(0, 10)));
    res.json({ totalSessions: total, sessions30: monthly.length, minutes30: totalMinutes30, activeDays30: uniqueDays.size, recent: recent.map((w) => ({ id: w._id, routineName: w.routineName, startedAt: w.startedAt, durationSeconds: w.durationSeconds, exerciseType: w.exerciseType })) });
  } catch (error) { res.status(500).json({ error: 'No se pudo calcular el resumen' }); }
}

module.exports = { createWorkout, listWorkouts, summary };
