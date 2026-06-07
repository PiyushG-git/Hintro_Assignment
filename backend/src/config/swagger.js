const swaggerJsDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hintro Meeting Intelligence API',
      version: '1.0.0',
      description:
        'AI-powered Meeting Intelligence Service — manage meetings, extract actionable insights, and track follow-ups.',
      contact: {
        name: 'Piyush Gupta',
        email: process.env.CANDIDATE_EMAIL || 'piyush@example.com',
      },
    },
    servers: [
      {
        url: process.env.DEPLOYED_URL || `http://localhost:${process.env.PORT || 3000}`,
        description: 'Primary server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide the JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            traceId: { type: 'string', example: 'a1b2c3d4-e5f6-...' },
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            traceId: { type: 'string', example: 'a1b2c3d4-e5f6-...' },
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Meeting title is required' },
              },
            },
          },
        },
        TranscriptEntry: {
          type: 'object',
          required: ['timestamp', 'speaker', 'text'],
          properties: {
            timestamp: { type: 'string', example: '00:10' },
            speaker: { type: 'string', example: 'Alice' },
            text: { type: 'string', example: 'I will prepare the release notes.' },
          },
        },
        Citation: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', example: '00:20' },
          },
        },
        Meeting: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'Sprint Planning' },
            participants: {
              type: 'array',
              items: { type: 'string', format: 'email' },
            },
            meetingDate: { type: 'string', format: 'date-time' },
            transcript: {
              type: 'array',
              items: { $ref: '#/components/schemas/TranscriptEntry' },
            },
            analysis: { type: 'object', nullable: true },
            analyzedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ActionItem: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            meetingId: { type: 'string' },
            task: { type: 'string', example: 'Prepare release notes' },
            assignee: { type: 'string', example: 'Alice' },
            dueDate: { type: 'string', format: 'date-time' },
            status: {
              type: 'string',
              enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
            },
            citations: {
              type: 'array',
              items: { $ref: '#/components/schemas/Citation' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsDoc(options);

module.exports = swaggerSpec;
