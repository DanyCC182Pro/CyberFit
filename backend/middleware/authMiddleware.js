const User = require('../models/User');

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'No autenticado' });
  try {
    const user = await User.findById(req.session.userId).select('_id');
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Sesión no válida' });
    }
    next();
  } catch (error) { return res.status(500).json({ error: 'No se pudo validar la sesión' }); }
}
module.exports = requireAuth;
