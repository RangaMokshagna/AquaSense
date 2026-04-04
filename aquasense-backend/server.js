require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const connectDB                = require('./src/config/db');
const logger                   = require('./src/utils/logger');
const { registerSocketHandlers } = require('./src/socket/socketHandler');
const mqttService              = require('./src/services/mqttService');
const { apiKeyAuth }           = require('./src/middleware/auth');

const readingsRouter  = require('./src/routes/readings');
const analyticsRouter = require('./src/routes/analytics');
const devicesRouter   = require('./src/routes/devices');

// ── App setup ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — 200 requests / 15 min per IP
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  })
);

// ── Health check (no auth) ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'AquaSense Backend',
    time:    new Date().toISOString(),
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/readings',  apiKeyAuth, readingsRouter);
app.use('/api',           apiKeyAuth, analyticsRouter);   // /api/predictions, /api/alerts
app.use('/api/devices',   apiKeyAuth, devicesRouter);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Bootstrap ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  registerSocketHandlers(io);

  // MQTT (IoT sensor stream) — only connect if broker is configured
  if (process.env.MQTT_BROKER_URL) {
    mqttService.connect(io);
  } else {
    logger.warn('MQTT_BROKER_URL not set — MQTT ingestion disabled. Use HTTP POST /api/readings instead.');
  }

  server.listen(PORT, () => {
    logger.info(`AquaSense backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });
};

start();

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  mqttService.disconnect();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
