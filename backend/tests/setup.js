// Set required environment variables before any module is loaded in tests
process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.JWT_EXPIRES_IN = '1d';
process.env.MISTRAL_API_KEY = 'test-mistral-key';
process.env.MISTRAL_MODEL = 'mistral-medium-latest';
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'test@example.com';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/hintro_test';
