import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import User from '../src/models/User.js';

describe('Authentication & Authorization Tests', () => {
  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('Health Check endpoint should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'UP');
  });

  it('POST /api/auth/login should authenticate active user and return JWT', async () => {
    const { user, rawPassword } = await createTestUser({
      email: 'john@vairavan.com',
      password: 'SecurePassword123!',
      role: 'employee',
      accountStatus: 'active',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@vairavan.com', password: 'SecurePassword123!' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, 'john@vairavan.com');
    assert.equal(res.body.data.user.password, undefined, 'Password must not be returned');
  });

  it('POST /api/auth/login with incorrect password should return 401', async () => {
    await createTestUser({
      email: 'john@vairavan.com',
      password: 'SecurePassword123!',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@vairavan.com', password: 'WrongPassword!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('POST /api/auth/login with inactive user should return 403 Forbidden', async () => {
    await createTestUser({
      email: 'inactive@vairavan.com',
      password: 'SecurePassword123!',
      accountStatus: 'inactive',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@vairavan.com', password: 'SecurePassword123!' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /deactivated/i);
  });

  it('GET /api/auth/me should return current authenticated user profile', async () => {
    const { token, user } = await createTestUser({
      email: 'me@vairavan.com',
      role: 'employee',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, 'me@vairavan.com');
  });

  it('Role Authorization: Employee should be forbidden from accessing Admin routes', async () => {
    const { token } = await createTestUser({ role: 'employee' });

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Forbidden/i);
  });
});
