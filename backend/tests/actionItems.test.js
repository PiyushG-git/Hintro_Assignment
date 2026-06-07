const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const ActionItem = require('../src/models/ActionItem');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => jest.fn());
jest.mock('../src/services/reminderJob', () => ({ start: jest.fn() }));

const makeToken = () =>
  jwt.sign(
    { id: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

const sampleActionItem = {
  meetingId: new mongoose.Types.ObjectId().toString(),
  task: 'Prepare release notes',
  assignee: 'Alice',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  citations: [{ timestamp: '00:20' }],
};

describe('ActionItem Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api/action-items', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).post('/api/action-items').send(sampleActionItem);
      expect(res.status).toBe(401);
    });

    it('should return 422 if task is missing', async () => {
      const token = makeToken();
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleActionItem, task: '' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 if dueDate is invalid', async () => {
      const token = makeToken();
      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...sampleActionItem, dueDate: 'not-a-date' });

      expect(res.status).toBe(422);
    });

    it('should create action item successfully', async () => {
      const token = makeToken();
      jest.spyOn(ActionItem, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        ...sampleActionItem,
        status: 'PENDING',
        toJSON: () => ({ ...sampleActionItem, status: 'PENDING' }),
      });

      const res = await request(app)
        .post('/api/action-items')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleActionItem);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actionItem.status).toBe('PENDING');
    });
  });

  describe('PATCH /api/action-items/:id/status', () => {
    it('should return 422 for invalid status', async () => {
      const token = makeToken();
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/action-items/${fakeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent action item', async () => {
      const token = makeToken();
      const fakeId = new mongoose.Types.ObjectId();

      jest.spyOn(ActionItem, 'findByIdAndUpdate').mockResolvedValueOnce(null);

      const res = await request(app)
        .patch(`/api/action-items/${fakeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(404);
    });

    it('should update status successfully', async () => {
      const token = makeToken();
      const fakeId = new mongoose.Types.ObjectId();

      jest.spyOn(ActionItem, 'findByIdAndUpdate').mockResolvedValueOnce({
        _id: fakeId,
        ...sampleActionItem,
        status: 'IN_PROGRESS',
        toJSON: () => ({ status: 'IN_PROGRESS' }),
      });

      const res = await request(app)
        .patch(`/api/action-items/${fakeId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.data.actionItem.status).toBe('IN_PROGRESS');
    });
  });

  describe('GET /api/action-items/overdue', () => {
    it('should return overdue items list', async () => {
      const token = makeToken();

      jest.spyOn(ActionItem, 'find').mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValueOnce([]),
      });

      const res = await request(app)
        .get('/api/action-items/overdue')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('overdue');
      expect(res.body.data).toHaveProperty('count');
    });
  });

  describe('GET /api/action-items', () => {
    it('should support status filter', async () => {
      const token = makeToken();

      jest.spyOn(ActionItem, 'find').mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce([]),
      });
      jest.spyOn(ActionItem, 'countDocuments').mockResolvedValueOnce(0);

      const res = await request(app)
        .get('/api/action-items?status=PENDING')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('actionItems');
    });

    it('should return 422 for invalid status filter', async () => {
      const token = makeToken();
      const res = await request(app)
        .get('/api/action-items?status=BOGUS')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });
  });
});
