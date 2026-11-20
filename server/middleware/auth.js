const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const VALID_ROLES = new Set([1, 2, 3, 4]);

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    });
    const role = Number(decoded.role);
    if (!Number.isInteger(role) || !VALID_ROLES.has(role)) {
      return res.status(401).json({ error: 'Invalid session role' });
    }
    req.user = { role };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient role permissions for this operation',
      });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
