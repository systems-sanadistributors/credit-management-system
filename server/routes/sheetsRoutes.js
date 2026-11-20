const express = require('express');
const sheetsController = require('../controllers/sheetsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/sync', requireAuth, requireRole(1), sheetsController.triggerFullSync);

module.exports = router;
