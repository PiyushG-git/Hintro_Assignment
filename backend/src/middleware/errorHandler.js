const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

/**
 * Global error handler middleware.
 * Catches all errors passed via next(err) and returns a consistent error response.
 * Ensures the application never crashes due to unhandled errors.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const traceId = req.traceId || 'unknown';

  logger.error('Unhandled error', {
    traceId,
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
    return errorResponse(res, 'VALIDATION_ERROR', message, traceId, 422);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return errorResponse(
      res,
      'INVALID_ID',
      `Invalid format for field: ${err.path}`,
      traceId,
      400
    );
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(
      res,
      'DUPLICATE_KEY',
      `A record with this ${field} already exists`,
      traceId,
      409
    );
  }

  // JWT errors (shouldn't reach here but just in case)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return errorResponse(res, 'UNAUTHORIZED', 'Invalid or expired token', traceId, 401);
  }

  // Default: Internal Server Error
  return errorResponse(
    res,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
    traceId,
    500
  );
};

module.exports = errorHandler;
