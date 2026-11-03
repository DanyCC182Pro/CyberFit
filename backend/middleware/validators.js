const { body, validationResult } = require('express-validator');
const { validatePassword } = require('../utils/passwordPolicy');

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('El nombre debe tener entre 2 y 80 caracteres'),
  body('email').trim().isEmail().withMessage('Correo electrónico inválido').normalizeEmail(),
  body('password').custom((value, { req }) => { const m = validatePassword(value, { email: req.body.email, name: req.body.name }); if (m) throw new Error(m); return true; }),
  body('acceptPrivacy').custom((v) => v === true).withMessage('Debes autorizar el tratamiento de tus datos personales (Ley 1581 de 2012)'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Correo electrónico inválido').normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}
module.exports = { registerValidation, loginValidation, handleValidationErrors };
