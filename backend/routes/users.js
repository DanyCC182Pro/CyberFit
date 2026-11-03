const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { updateProfile, uploadProfileImage } = require('../controllers/userController');

const router = express.Router();

router.put('/profile', requireAuth, updateProfile);
router.post('/profile-image', requireAuth, upload.single('image'), upload.validateImage, uploadProfileImage);

module.exports = router;