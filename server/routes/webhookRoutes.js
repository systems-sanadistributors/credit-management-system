const express = require('express');
const sheetsController = require('../controllers/sheetsController');
const { requireWebhookSecret } = require('../middleware/webhookAuth');
const { webhookRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/sheets',
  webhookRateLimiter,
  requireWebhookSecret,
  sheetsController.handleWebhook
);

module.exports = router;
