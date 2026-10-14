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

  it('POST /api/auth/login should authenticate user with 10-digit phone number', async () => {
    await createTestUser({
      email: 'phoneuser@vairavan.com',
      phoneNumber: '9876543210',
      password: 'SecurePassword123!',
      role: 'employee',
      accountStatus: 'active',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '9876543210', password: 'SecurePassword123!' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, 'phoneuser@vairavan.com');
  });

  it('POST /api/auth/login should authenticate user with +91 phone number', async () => {
    await createTestUser({
      email: 'plus91user@vairavan.com',
      phoneNumber: '9845612340',
      password: 'SecurePassword123!',
      role: 'employee',
      accountStatus: 'active',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '+919845612340', password: 'SecurePassword123!' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.email, 'plus91user@vairavan.com');
  });

  it('POST /api/employees should reject duplicate phone number with 409 Conflict', async () => {
    const { token: adminToken } = await createTestUser({ role: 'admin' });

    await createTestUser({
      email: 'existing_phone@vairavan.com',
      phoneNumber: '9988776655',
    });

    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeName: 'Duplicate Phone User',
        employeeId: 'EMP_DUP_PH',
        email: 'new_unique_email@vairavan.com',
        password: 'Password123!',
        phoneNumber: '9988776655',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /phone number already exists/i);
  });

  it('PUT /api/employees/:id should reject duplicate phone number on update', async () => {
    const { token: adminToken } = await createTestUser({ role: 'admin' });

    await createTestUser({
      email: 'phone_taken@vairavan.com',
      phoneNumber: '9123456789',
    });

    const { user: userToUpdate } = await createTestUser({
      email: 'to_update@vairavan.com',
      phoneNumber: '9888888888',
    });

    const res = await request(app)
      .put(`/api/employees/${userToUpdate._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        phoneNumber: '9123456789',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /phone number already exists/i);
  });

  it('PATCH /api/auth/profile should reject duplicate phone number on self update', async () => {
    await createTestUser({
      email: 'user_a@vairavan.com',
      phoneNumber: '9000000001',
    });

    const { token: userBToken } = await createTestUser({
      email: 'user_b@vairavan.com',
      phoneNumber: '9000000002',
    });

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        phoneNumber: '9000000001',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /phone number is already in use/i);
  });
});

