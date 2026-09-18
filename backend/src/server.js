require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { initSocket } = require('./config/socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect MongoDB
  await connectDB();

  const server = http.createServer(app);

  // Init Socket.io
  await initSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);

    // ── Keep-alive ping to prevent Render free-tier cold starts ──────────────
    // Render spins down after ~15min of inactivity. This self-ping every 14min
    // keeps the server warm so payment/AI calls never hit cold-start timeouts.
    if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
      const keepAliveUrl = `${process.env.RENDER_EXTERNAL_URL}/health`;
      setInterval(async () => {
        try {
          const res = await fetch(keepAliveUrl, { signal: AbortSignal.timeout(10000) });
          logger.info(`[Keep-alive] Pinged ${keepAliveUrl} — ${res.status}`);
        } catch (e) {
          logger.warn(`[Keep-alive] Ping failed: ${e.message}`);
        }
      }, 14 * 60 * 1000); // 14 minutes
      logger.info(`[Keep-alive] Self-ping enabled → ${keepAliveUrl}`);
    }
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled rejection:', err);
    logger.error('Unhandled rejection:', err.message);
    shutdown('unhandledRejection');
  });
  
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    logger.error('Uncaught exception:', err.stack);
    process.exit(1);
  });
};

start();
