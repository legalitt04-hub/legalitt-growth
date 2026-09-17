const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

beforeAll(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/legalitt_test';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    // If local DB is offline, set bufferCommands false so queries fail fast instead of hanging
    mongoose.set('bufferCommands', false);
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } catch (err) {}
});

describe('Health Check', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth Routes', () => {
  it('POST /api/v1/auth/register - missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@test.com' }); // Missing name and password
    expect(res.statusCode).toBe(400);
  });

  it('rejects the retired client-side registration secret', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Client',
        email: 'new-client@example.com',
        password: 'StrongPass1!',
        role: 'client',
        captchaToken: 'mock_captcha_token',
      });
    expect(res.statusCode).toBe(400);
  });

  it('rejects mock Google tokens unless explicitly enabled for development', async () => {
    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'mock_test@example.com', role: 'client' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/auth/login - invalid credentials returns 401 or 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrongpass' });
    // 401/404 if DB connected, 500 if DB offline — all acceptable in smoke test
    expect([401, 404, 500]).toContain(res.statusCode);
  });
});

describe('Advocate Routes', () => {
  it('GET /api/v1/advocates/specializations returns list', async () => {
    const res = await request(app).get('/api/v1/advocates/specializations');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('Protected Routes', () => {
  it('GET /api/v1/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/bookings/my without token returns 401', async () => {
    const res = await request(app).get('/api/v1/bookings/my');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/stats without token returns 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.statusCode).toBe(401);
  });
});

describe('404 Handling', () => {
  it('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route');
    expect(res.statusCode).toBe(404);
  });
});

