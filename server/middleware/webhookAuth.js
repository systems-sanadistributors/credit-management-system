const crypto = require('crypto');
const { config } = require('../config/env');

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function requireWebhookSecret(req, res, next) {
  const provided = req.headers['x-webhook-secret'];
  if (typeof provided !== 'string' || provided.trim().length === 0) {
    return res.status(401).json({ error: 'Missing webhook secret' });
  }

  const providedDigest = sha256Buffer(provided.trim());
  const expectedDigest = sha256Buffer(config.sheets.webhookSecret);

  if (!crypto.timingSafeEqual(providedDigest, expectedDigest)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  return next();
}

module.exports = { requireWebhookSecret };
