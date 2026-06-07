const logger = require('../utils/logger');

/**
 * Middleware that logs every incoming request and its response.
 * Captures: method, path, status, duration, traceId.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logPayload = {
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logPayload);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logPayload);
    } else {
      logger.info('Request completed', logPayload);
    }
  });

  next();
};

module.exports = requestLogger;
