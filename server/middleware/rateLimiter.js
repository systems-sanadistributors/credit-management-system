const rateLimit = require('express-rate-limit');

function createLoginRateLimiter(maxAttempts) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxAttempts || Number(process.env.LOGIN_RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many login attempts. Please wait 15 minutes before retrying.',
    },
  });
}

function createWebhookRateLimiter(maxAttempts) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxAttempts || Number(process.env.WEBHOOK_RATE_LIMIT_MAX) || 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many webhook requests. Please retry shortly.',
    },
  });
}

const loginRateLimiter = createLoginRateLimiter();
const webhookRateLimiter = createWebhookRateLimiter();

module.exports = {
  loginRateLimiter,
  createLoginRateLimiter,
  webhookRateLimiter,
  createWebhookRateLimiter,
};
