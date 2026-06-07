/**
 * Unified API response builder.
 * All API responses must go through these helpers to maintain a consistent structure.
 */

/**
 * @param {import('express').Response} res
 * @param {object} data
 * @param {string} traceId
 * @param {number} [statusCode=200]
 */
const successResponse = (res, data, traceId, statusCode = 200) => {
  return res.status(statusCode).json({
    traceId,
    success: true,
    data,
  });
};

/**
 * @param {import('express').Response} res
 * @param {string} code - Machine-readable error code e.g. "VALIDATION_ERROR"
 * @param {string} message - Human-readable error message
 * @param {string} traceId
 * @param {number} [statusCode=400]
 */
const errorResponse = (res, code, message, traceId, statusCode = 400) => {
  return res.status(statusCode).json({
    traceId,
    success: false,
    error: {
      code,
      message,
    },
  });
};

module.exports = { successResponse, errorResponse };
