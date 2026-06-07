const express = require('express');
const { z } = require('zod');
const Meeting = require('../models/Meeting');
const ActionItem = require('../models/ActionItem');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { analyzeMeeting } = require('../services/aiService');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();

// All meeting routes require authentication
router.use(authenticate);

// ── Zod Schemas ────────────────────────────────────────────────────

const transcriptEntrySchema = z.object({
  timestamp: z.string().min(1, 'Timestamp is required'),
  speaker: z.string().min(1, 'Speaker is required'),
  text: z.string().min(1, 'Text is required'),
});

const createMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').max(200),
  participants: z
    .array(z.string().email('Each participant must be a valid email'))
    .min(1, 'At least one participant is required'),
  meetingDate: z.string().datetime({ message: 'meetingDate must be a valid ISO 8601 date-time' }),
  transcript: z
    .array(transcriptEntrySchema)
    .min(1, 'Transcript must contain at least one entry'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  title: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Meetings
 *   description: Meeting management
 */

/**
 * @swagger
 * /api/meetings:
 *   post:
 *     summary: Create a new meeting with transcript
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, participants, meetingDate, transcript]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Sprint Planning
 *               participants:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 example: ["alice@example.com", "bob@example.com"]
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-05-20T10:00:00Z"
 *               transcript:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TranscriptEntry'
 *     responses:
 *       201:
 *         description: Meeting created successfully
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post('/', validate(createMeetingSchema), async (req, res, next) => {
  try {
    const meeting = await Meeting.create({
      ...req.body,
      createdBy: req.user.id,
    });
    return successResponse(res, { meeting }, req.traceId, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: List meetings with pagination
 *     tags: [Meetings]
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
 *         name: title
 *         schema:
 *           type: string
 *         description: Filter by title (partial match)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter meetings from this date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter meetings up to this date
 *     responses:
 *       200:
 *         description: Paginated list of meetings
 */
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, title, from, to } = req.query;
    const skip = (page - 1) * limit;

    const filter = { createdBy: req.user.id };
    if (title) filter.title = { $regex: title, $options: 'i' };
    if (from || to) {
      filter.meetingDate = {};
      if (from) filter.meetingDate.$gte = new Date(from);
      if (to) filter.meetingDate.$lte = new Date(to);
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-transcript'), // Exclude transcript from list view for performance
      Meeting.countDocuments(filter),
    ]);

    return successResponse(
      res,
      {
        meetings,
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
 * /api/meetings/{id}:
 *   get:
 *     summary: Get a meeting by ID (includes transcript and analysis)
 *     tags: [Meetings]
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
 *         description: Meeting details
 *       404:
 *         description: Meeting not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });
    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found', req.traceId, 404);
    }
    return successResponse(res, { meeting }, req.traceId);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/meetings/{id}/analyze:
 *   post:
 *     summary: Analyze a meeting using AI to extract insights and action items
 *     tags: [Meetings]
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
 *         description: Analysis completed with summary, action items, decisions, and follow-ups
 *       404:
 *         description: Meeting not found
 *       502:
 *         description: AI service error
 */
router.post('/:id/analyze', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
    });

    if (!meeting) {
      return errorResponse(res, 'NOT_FOUND', 'Meeting not found', req.traceId, 404);
    }

    // FIX 1: Guard against re-analysis — return cached result if already analyzed
    if (meeting.analyzedAt) {
      return successResponse(
        res,
        {
          analysis: meeting.analysis,
          analyzedAt: meeting.analyzedAt,
          cached: true,
          message: 'This meeting has already been analyzed. Returning cached result.',
        },
        req.traceId
      );
    }
    try {
      analysis = await analyzeMeeting(meeting);
    } catch (aiErr) {
      return errorResponse(res, 'AI_SERVICE_ERROR', aiErr.message, req.traceId, 502);
    }

    // Persist analysis to meeting
    meeting.analysis = analysis;
    meeting.analyzedAt = new Date();
    await meeting.save();

    // Auto-create ActionItem documents from AI-extracted action items
    // FIX 2: Create action items even if assignee is null (was silently dropped before)
    const createdActionItems = [];
    for (const item of analysis.actionItems) {
      if (item.task) {
        const actionItem = await ActionItem.create({
          meetingId: meeting._id,
          task: item.task,
          assignee: item.assignee || null,
          dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          citations: item.citations || [],
          createdBy: req.user.id,
        });
        createdActionItems.push(actionItem);
      }
    }

    return successResponse(
      res,
      {
        analysis,
        analyzedAt: meeting.analyzedAt,
        actionItemsCreated: createdActionItems.length,
      },
      req.traceId
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
