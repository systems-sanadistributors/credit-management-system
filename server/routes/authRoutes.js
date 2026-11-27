const express = require('express');
const { login, logout, getMe, getSession } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.post('/logout', logout);
router.get('/session', getSession);
router.get('/me', requireAuth, requireRole(1, 2, 3, 4, 5), getMe);

module.exports = router;
