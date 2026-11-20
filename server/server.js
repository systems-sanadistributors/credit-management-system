const { config } = require('./config/env');
const { connectDB } = require('./config/db');
const { app } = require('./app');
const { verifySmtp } = require('./services/emailService');

async function startServer() {
  try {
    await connectDB();
    app.listen(config.port, () => {
      console.log(`[SERVER] Listening on port ${config.port}`);
      verifySmtp();
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
