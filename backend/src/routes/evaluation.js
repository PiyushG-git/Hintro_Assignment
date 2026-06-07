const express = require('express');
const { successResponse } = require('../utils/response');

const router = express.Router();

/**
 * @swagger
 * /api/evaluation:
 *   get:
 *     summary: Candidate evaluation endpoint
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Candidate and project information
 */
router.get('/evaluation', (req, res) => {
  return successResponse(
    res,
    {
      candidateName: process.env.CANDIDATE_NAME || 'Piyush Gupta',
      email: process.env.CANDIDATE_EMAIL || 'piyush@example.com',
      repositoryUrl: process.env.REPOSITORY_URL || 'https://github.com/yourusername/hintro-meeting-intelligence',
      deployedUrl: process.env.DEPLOYED_URL || 'https://hintro-meeting-intelligence.onrender.com',
      externalIntegration: 'Resend Email API',
      features: [
        'JWT Authentication',
        'Meeting Management with Transcript Storage',
        'AI Analysis with Google Gemini (citation-grounded)',
        'Action Item Management (CRUD + Status)',
        'Overdue Detection',
        'Scheduled Reminder Job (node-cron)',
        'SendGrid Email Reminders',
        'Unified API Response Format',
        'Request Trace ID',
        'Structured Logging (Winston)',
        'Input Validation (Zod)',
        'Global Error Handling',
        'Swagger / OpenAPI Docs',
        'Pagination & Filtering',
        'Docker Support',
        'Render Deployment',
      ],
    },
    req.traceId
  );
});

module.exports = router;
