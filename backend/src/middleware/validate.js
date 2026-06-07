const { ZodError } = require('zod');
const { errorResponse } = require('../utils/response');

/**
 * Factory function that returns a validation middleware for a given Zod schema.
 * Validates req.body by default.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} [source='body']
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed; // Replace with coerced/parsed values
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return errorResponse(res, 'VALIDATION_ERROR', message, req.traceId, 422);
      }
      next(err);
    }
  };
};

module.exports = validate;
