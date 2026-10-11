import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Leave from '../src/models/Leave.js';

describe('Leave Management Tests', () => {
  let adminUser, employeeUser;

  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    adminUser = await createTestUser({ role: 'admin' });
    employeeUser = await createTestUser({ role: 'employee' });
  });

  it('Employee should submit a valid leave request', async () => {
    const res = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Family function in home town',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.leave.status, 'pending');
  });

  it('Should reject leave if endDate is earlier than startDate (422 Unprocessable)', async () => {
    const res = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Invalid date range test',
        startDate: '2026-10-25',
        endDate: '2026-10-20',
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.message.includes('End date cannot be earlier than start date')));
  });

  it('Should prevent overlapping leave requests (409 Conflict)', async () => {
    // First request
    await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Personal leave',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
      });

    // Overlapping request
    const duplicateRes = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Overlapping request',
        startDate: '2026-11-03',
        endDate: '2026-11-07',
      });

    assert.equal(duplicateRes.status, 409);
    assert.equal(duplicateRes.body.success, false);
    assert.match(duplicateRes.body.message, /already have a (pending|approved) leave/i);
  });

  it('Admin should approve a leave request with remarks', async () => {
    const leave = await Leave.create({
      employee: employeeUser.user._id,
      reason: 'Medical checkup',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-02'),
      status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/leaves/${leave._id}/review`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        status: 'approved',
        adminRemarks: 'Approved as requested. Take care.',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.leave.status, 'approved');
    assert.equal(res.body.data.leave.adminRemarks, 'Approved as requested. Take care.');
  });

  it('Employee should cancel their own pending leave request', async () => {
    const leave = await Leave.create({
      employee: employeeUser.user._id,
      reason: 'Trip planned',
      startDate: new Date('2026-12-10'),
      endDate: new Date('2026-12-12'),
      status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/leaves/${leave._id}/cancel`)
      .set('Authorization', `Bearer ${employeeUser.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.leave.status, 'cancelled');
  });
});
