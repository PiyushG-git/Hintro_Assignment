const { v4: uuidv4 } = require('uuid');

/**
 * Middleware that injects a trace ID into every request.
 * Uses X-Trace-Id header if provided by the client, otherwise generates a UUID.
 */
const traceIdMiddleware = (req, res, next) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
};

module.exports = traceIdMiddleware;
