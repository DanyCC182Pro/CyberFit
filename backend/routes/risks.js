const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const { listRisks, updateRisk } = require('../controllers/riskController');
const router = express.Router();
router.use(requireAuth);
router.get('/', listRisks);
router.put('/:id', updateRisk);
module.exports = router;
