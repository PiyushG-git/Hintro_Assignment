const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Meeting = require('../src/models/Meeting');
const ActionItem = require('../src/models/ActionItem');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => jest.fn());
jest.mock('../src/services/reminderJob', () => ({ start: jest.fn() }));
jest.mock('../src/services/aiService');

const { analyzeMeeting } = require('../src/services/aiService');

// Helper: create a fake JWT token
const makeToken = (userId = new mongoose.Types.ObjectId().toString()) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// Helper: sample meeting payload
const sampleMeeting = {
  title: 'Sprint Planning',
  participants: ['alice@example.com', 'bob@example.com'],
  meetingDate: '2026-05-20T10:00:00Z',
  transcript: [
    { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
    { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' },
  ],
};

describe('Meeting Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/meetings', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).post('/api/meetings').send(sampleMeeting);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 422 if title is missing', async () => {
      const token = makeToken();
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleMeeting, title: '' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 if participant email is invalid', async () => {
      const token = makeToken();
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleMeeting, participants: ['not-an-email'] });

      expect(res.status).toBe(422);
    });

    it('should return 422 if transcript is empty', async () => {
      const token = makeToken();
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleMeeting, transcript: [] });

      expect(res.status).toBe(422);
    });

    it('should return 201 on successful meeting creation', async () => {
      const token = makeToken();
      const fakeId = new mongoose.Types.ObjectId();

      jest.spyOn(Meeting, 'create').mockResolvedValueOnce({
        _id: fakeId,
        ...sampleMeeting,
        createdBy: 'user-id',
        createdAt: new Date(),
        toJSON: () => ({ _id: fakeId, ...sampleMeeting }),
      });

      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleMeeting);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('meeting');
      expect(res.body).toHaveProperty('traceId');
    });
  });

  describe('GET /api/meetings', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/meetings');
      expect(res.status).toBe(401);
    });

    it('should return pagination metadata', async () => {
      const token = makeToken();

      jest.spyOn(Meeting, 'find').mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValueOnce([]),
      });
      jest.spyOn(Meeting, 'countDocuments').mockResolvedValueOnce(0);

      const res = await request(app)
        .get('/api/meetings?page=1&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination).toHaveProperty('total');
      expect(res.body.data.pagination).toHaveProperty('page', 1);
    });
  });

  describe('POST /api/meetings/:id/analyze', () => {
    it('should return 404 for non-existent meeting', async () => {
      const token = makeToken();
      jest.spyOn(Meeting, 'findOne').mockResolvedValueOnce(null);

      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/meetings/${fakeId}/analyze`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return analysis with citations', async () => {
      const token = makeToken();
      const fakeId = new mongoose.Types.ObjectId();

      const mockMeeting = {
        _id: fakeId,
        ...sampleMeeting,
        analysis: null,
        analyzedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Meeting, 'findOne').mockResolvedValueOnce(mockMeeting);

      // Mock ActionItem.create at the spy level (not jest.mock)
      jest.spyOn(ActionItem, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        task: 'Prepare release notes',
        assignee: 'Alice',
        status: 'PENDING',
      });

      const mockAnalysis = {
        summary: [{ text: 'Team plans to launch.', citations: [{ timestamp: '00:10' }] }],
        actionItems: [
          {
            task: 'Prepare release notes',
            assignee: 'Alice',
            dueDate: null,
            citations: [{ timestamp: '00:20' }],
          },
        ],
        decisions: [],
        followUpSuggestions: [],
      };

      analyzeMeeting.mockResolvedValueOnce(mockAnalysis);

      const res = await request(app)
        .post(`/api/meetings/${fakeId}/analyze`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('analysis');
      expect(res.body.data.analysis.summary[0]).toHaveProperty('citations');
      expect(res.body.data.analysis.actionItems[0].citations[0].timestamp).toBe('00:20');
    });
  });
});
