const express = require('express');
const { z } = require('zod');
const ActionItem = require('../models/ActionItem');
const { ACTION_ITEM_STATUSES } = require('../models/ActionItem');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();

// All action item routes require authentication
router.use(authenticate);

// ── Zod Schemas ────────────────────────────────────────────────────

const createActionItemSchema = z.object({
  meetingId: z.string().min(1, 'meetingId is required'),
  task: z.string().min(1, 'Task description is required').max(500),
  assignee: z.string().min(1, 'Assignee is required'),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 date-time' }),
  citations: z
    .array(z.object({ timestamp: z.string() }))
    .optional()
    .default([]),
});

const updateStatusSchema = z.object({
  status: z.enum(ACTION_ITEM_STATUSES, {
    errorMap: () => ({
      message: `Status must be one of: ${ACTION_ITEM_STATUSES.join(', ')}`,
    }),
  }),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(ACTION_ITEM_STATUSES).optional(),
  assignee: z.string().optional(),
  meetingId: z.string().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: ActionItems
 *   description: Action item management and tracking
 */

/**
 * @swagger
 * /api/action-items/overdue:
 *   get:
 *     summary: Get all overdue action items (status != COMPLETED and dueDate < now)
 *     tags: [ActionItems]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue action items
 */
// IMPORTANT: /overdue MUST be registered before /:id to avoid route conflict
router.get('/overdue', async (req, res, next) => {
  try {
    const overdueItems = await ActionItem.find({
      status: { $ne: 'COMPLETED' },
      dueDate: { $lt: new Date() },
    })
      .populate('meetingId', 'title meetingDate')
      .sort({ dueDate: 1 });

    return successResponse(
      res,
      {
        overdue: overdueItems,
        count: overdueItems.length,
      },
      req.traceId
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items:
 *   post:
 *     summary: Create a new action item
 *     tags: [ActionItems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meetingId, task, assignee, dueDate]
 *             properties:
 *               meetingId:
 *                 type: string
 *               task:
 *                 type: string
 *                 example: Prepare release notes
 *               assignee:
 *                 type: string
 *                 example: Alice
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-25T00:00:00Z"
 *               citations:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Citation'
 *     responses:
 *       201:
 *         description: Action item created
 *       422:
 *         description: Validation error
 */
router.post('/', validate(createActionItemSchema), async (req, res, next) => {
  try {
    const actionItem = await ActionItem.create({
      ...req.body,
      createdBy: req.user.id,
    });
    return successResponse(res, { actionItem }, req.traceId, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items:
 *   get:
 *     summary: List action items with filtering and pagination
 *     tags: [ActionItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED]
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *       - in: query
 *         name: meetingId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of action items
 */
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, status, assignee, meetingId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (assignee) filter.assignee = { $regex: assignee, $options: 'i' };
    if (meetingId) filter.meetingId = meetingId;

    const [actionItems, total] = await Promise.all([
      ActionItem.find(filter)
        .populate('meetingId', 'title meetingDate')
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limit),
      ActionItem.countDocuments(filter),
    ]);

    return successResponse(
      res,
      {
        actionItems,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
      req.traceId
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items/{id}/status:
 *   patch:
 *     summary: Update the status of an action item
 *     tags: [ActionItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Action item not found
 *       422:
 *         description: Invalid status value
 */
router.patch('/:id/status', validate(updateStatusSchema), async (req, res, next) => {
  try {
    const actionItem = await ActionItem.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!actionItem) {
      return errorResponse(res, 'NOT_FOUND', 'Action item not found', req.traceId, 404);
    }

    return successResponse(res, { actionItem }, req.traceId);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/action-items/{id}:
 *   get:
 *     summary: Get a single action item by ID
 *     tags: [ActionItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action item details
 *       404:
 *         description: Not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const actionItem = await ActionItem.findById(req.params.id).populate(
      'meetingId',
      'title meetingDate participants'
    );
    if (!actionItem) {
      return errorResponse(res, 'NOT_FOUND', 'Action item not found', req.traceId, 404);
    }
    return successResponse(res, { actionItem }, req.traceId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
