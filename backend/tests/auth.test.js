const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

// Use an in-memory-like test DB or mock mongoose
jest.mock('../src/config/db', () => jest.fn());
jest.mock('../src/services/reminderJob', () => ({ start: jest.fn() }));

describe('Auth Routes', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should return 422 if name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 if email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'Password123' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: 'short' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include traceId in response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad' });

      expect(res.body).toHaveProperty('traceId');
      expect(typeof res.body.traceId).toBe('string');
    });

    it('should return 201 on successful registration', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(User, 'create').mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        name: testUser.name,
        email: testUser.email,
        toJSON: () => ({ name: testUser.name, email: testUser.email }),
      });

      const res = await request(app).post('/api/auth/register').send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 409 if email already registered', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValueOnce({ email: testUser.email });

      const res = await request(app).post('/api/auth/register').send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_KEY');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 422 if email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(422);
    });

    it('should return 401 if user not found', async () => {
      jest.spyOn(User, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});

describe('Health Check', () => {
  it('GET /health should return { status: "UP" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
