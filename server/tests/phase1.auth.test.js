const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const { app } = require('../app');
const { config, validateEnv } = require('../config/env');
const { cleanValue } = require('../middleware/sanitize');
const { createLoginRateLimiter } = require('../middleware/rateLimiter');
const { login } = require('../controllers/authController');

describe('Phase 1: Backend Setup, Env Validation, Security Middleware & Passkey Auth', () => {
  it('exits with code 1 when any required .env variable is missing', () => {
    let exitCode = null;
    const originalExit = process.exit;
    const originalError = console.error;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('EXIT_INTERCEPTED');
    };
    console.error = () => {};

    try {
      assert.throws(() => {
        validateEnv({ PORT: '5000', MONGO_URI: 'mongodb://localhost/test' });
      }, /EXIT_INTERCEPTED/);
      assert.equal(exitCode, 1);
    } finally {
      process.exit = originalExit;
      console.error = originalError;
    }
  });

  it('strips NoSQL injection operators ($ and .) from nested objects and arrays', () => {
    const malicious = {
      passkey: { $ne: null, 'nested.key': 'bad', validKey: 'ok' },
      $where: '1 == 1',
      'a.b': 'dotted',
      items: [{ $gt: 5, label: 'Qty' }],
    };

    const sanitized = cleanValue(malicious);
    assert.equal(sanitized.$where, undefined);
    assert.equal(sanitized['a.b'], undefined);
    assert.deepEqual(sanitized.passkey, { validKey: 'ok' });
    assert.deepEqual(sanitized.items, [{ label: 'Qty' }]);
  });

  it('sets Helmet security headers and strict CORS origin with credentials', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', config.clientUrl);

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['access-control-allow-origin'], config.clientUrl);
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('authenticates each of the 4 passkeys and sets an HttpOnly SameSite=Lax JWT cookie', async () => {
    for (const role of [1, 2, 3, 4]) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ passkey: config.passkeys[role] });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.role, role);

      const cookies = loginRes.headers['set-cookie'];
      assert.ok(Array.isArray(cookies) && cookies.length > 0);
      const tokenCookie = cookies.find((c) => c.startsWith('token='));
      assert.ok(tokenCookie, 'Expected token cookie to be set');
      assert.match(tokenCookie, /HttpOnly/i);
      assert.match(tokenCookie, /SameSite=Lax/i);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', tokenCookie);
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.role, role);
    }
  });

  it('rejects invalid passkeys and NoSQL object injection on /api/auth/login', async () => {
    const wrongRes = await request(app)
      .post('/api/auth/login')
      .send({ passkey: 'wrong-passkey-value' });
    assert.equal(wrongRes.status, 401);

    const injectionRes = await request(app)
      .post('/api/auth/login')
      .send({ passkey: { $ne: '' } });
    assert.equal(injectionRes.status, 400);
  });

  it('enforces rate limiting on the login endpoint', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post('/api/auth/login', createLoginRateLimiter(3), login);

    for (let i = 0; i < 3; i++) {
      const res = await request(testApp)
        .post('/api/auth/login')
        .send({ passkey: 'wrong' });
      assert.equal(res.status, 401);
    }

    const blockedRes = await request(testApp)
      .post('/api/auth/login')
      .send({ passkey: 'wrong' });
    assert.equal(blockedRes.status, 429);
  });

  it('sets HttpOnly, Secure, SameSite=None cookie attributes in production mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../controllers/authController')];
    const prodAuthController = require('../controllers/authController');

    try {
      const prodApp = express();
      prodApp.use(express.json());
      prodApp.post('/api/auth/login', prodAuthController.login);

      const res = await request(prodApp)
        .post('/api/auth/login')
        .send({ passkey: config.passkeys[1] });

      assert.equal(res.status, 200);
      const setCookie = res.headers['set-cookie']?.[0] || '';
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      assert.match(setCookie, /SameSite=None/i);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      delete require.cache[require.resolve('../controllers/authController')];
    }
  });
});
