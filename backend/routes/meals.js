const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const { createMeal, listMeals } = require('../controllers/mealController');
const { requireConsent } = require('../controllers/privacyController');
const router = express.Router();
router.use(requireAuth);
router.get('/', listMeals);
router.post('/', requireConsent, createMeal);
module.exports = router;
