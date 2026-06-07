const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches decoded user payload to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(
      res,
      'UNAUTHORIZED',
      'Authentication token is required. Provide Authorization: Bearer <token>',
      req.traceId,
      401
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Authentication token has expired'
        : 'Invalid authentication token';
    return errorResponse(res, 'UNAUTHORIZED', message, req.traceId, 401);
  }
};

module.exports = authenticate;
