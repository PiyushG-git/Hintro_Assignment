require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const connectDB = require('./config/db');
const swaggerSpec = require('./config/swagger');
const traceIdMiddleware = require('./middleware/traceId');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { successResponse, errorResponse } = require('./utils/response');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const actionItemRoutes = require('./routes/actionItems');
const evaluationRoutes = require('./routes/evaluation');
const reminderJob = require('./services/reminderJob');

// ── App Setup ──────────────────────────────────────────────────────

const app = express();

// Connect to MongoDB
connectDB();

// ── Security ───────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false, // Allow Swagger UI to load
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
    exposedHeaders: ['X-Trace-Id'],
  })
);

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later.',
      req.traceId,
      429
    );
  },
});
app.use(limiter);

// ── Body Parsing ───────────────────────────────────────────────────

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Observability ──────────────────────────────────────────────────

app.use(traceIdMiddleware);
app.use(requestLogger);

// ── API Documentation ──────────────────────────────────────────────

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Hintro API Docs',
    customCss: '.swagger-ui .topbar { background-color: #6366f1; }',
    swaggerOptions: { persistAuthorization: true },
  })
);

// Expose raw OpenAPI JSON for tooling
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Health Check ───────────────────────────────────────────────────

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 */
app.get('/health', (req, res) => {
  res.json({ status: 'UP' });
});

// ── Routes ─────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/action-items', actionItemRoutes);
app.use('/api', evaluationRoutes);

// ── 404 Handler ────────────────────────────────────────────────────

app.use((req, res) => {
  return errorResponse(
    res,
    'NOT_FOUND',
    `Route ${req.method} ${req.originalUrl} not found`,
    req.traceId,
    404
  );
});

// ── Global Error Handler ───────────────────────────────────────────

app.use(errorHandler);

// ── Scheduler ──────────────────────────────────────────────────────

// Only start the scheduler when not running tests
if (process.env.NODE_ENV !== 'test') {
  reminderJob.start();
}

// ── Server ─────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🚀 Hintro Meeting Intelligence API running on port ${PORT}`);
    logger.info(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
    logger.info(`❤️  Health: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
