const Meal = require('../models/Meal');

async function createMeal(req, res) {
  try {
    const meal = await Meal.create({
      user: req.session.userId,
      mealType: req.body.mealType,
      food: String(req.body.food || '').trim().slice(0, 300),
      portion: String(req.body.portion || '').trim().slice(0, 120),
      calories: req.body.calories === '' || req.body.calories == null ? null : Number(req.body.calories),
      protein: req.body.protein === '' || req.body.protein == null ? null : Number(req.body.protein),
      carbs: req.body.carbs === '' || req.body.carbs == null ? null : Number(req.body.carbs),
      fats: req.body.fats === '' || req.body.fats == null ? null : Number(req.body.fats),
      notes: String(req.body.notes || '').trim().slice(0, 500),
      eatenAt: req.body.eatenAt ? new Date(req.body.eatenAt) : new Date(),
    });
    if (!meal.food) return res.status(400).json({ error: 'El alimento es obligatorio' });
    res.status(201).json({ message: 'Comida guardada', meal });
  } catch (error) { res.status(400).json({ error: 'No se pudo guardar la comida' }); }
}

async function listMeals(req, res) {
  try {
    const dateParam = req.query.date;
    const filter = { user: req.session.userId };
    if (dateParam) {
      const start = new Date(`${dateParam}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + 1);
      filter.eatenAt = { $gte: start, $lt: end };
    }
    const meals = await Meal.find(filter).sort({ eatenAt: -1 }).limit(100).lean();
    res.json(meals);
  } catch (error) { res.status(500).json({ error: 'No se pudo cargar la alimentación' }); }
}

module.exports = { createMeal, listMeals };
