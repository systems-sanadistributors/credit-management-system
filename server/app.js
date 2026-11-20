const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const { sanitizeRequest } = require('./middleware/sanitize');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const formRoutes = require('./routes/formRoutes');
const sheetsRoutes = require('./routes/sheetsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const customerRoutes = require('./routes/customerRoutes');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = String(config.clientUrl || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin && origin !== '*');

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins.length <= 1 ? allowedOrigins[0] : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Webhook route enforces a strict 5mb JSON limit and payload sanitization
  app.use(
    '/api/webhooks',
    express.json({ limit: '5mb' }),
    sanitizeRequest,
    webhookRoutes
  );

  app.use(express.json({ limit: '12mb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/forms', formRoutes);
  app.use('/api/sheets', sheetsRoutes);
  app.use('/api/customers', customerRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use(errorHandler);
  return app;
}

const app = createApp();

module.exports = { app, createApp };
