const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();

// ── Zod Schemas ────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Helpers ────────────────────────────────────────────────────────

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── Routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User registration and login
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       409:
 *         description: Email already registered
 *       422:
 *         description: Validation error
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return errorResponse(res, 'DUPLICATE_KEY', 'Email is already registered', req.traceId, 409);
    }

    const user = await User.create({ name, email, passwordHash: password });
    const token = signToken(user._id);

    return successResponse(
      res,
      { token, user: { id: user._id, name: user.name, email: user.email } },
      req.traceId,
      201
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 example: SecurePass123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       422:
 *         description: Validation error
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return errorResponse(res, 'INVALID_CREDENTIALS', 'Invalid email or password', req.traceId, 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return errorResponse(res, 'INVALID_CREDENTIALS', 'Invalid email or password', req.traceId, 401);
    }

    const token = signToken(user._id);

    return successResponse(
      res,
      { token, user: { id: user._id, name: user.name, email: user.email } },
      req.traceId
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */
router.get('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, 'NOT_FOUND', 'User not found', req.traceId, 404);
    }
    return successResponse(res, { user }, req.traceId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
