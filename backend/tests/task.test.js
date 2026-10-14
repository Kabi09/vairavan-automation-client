import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Company from '../src/models/Company.js';
import Task from '../src/models/Task.js';
import Notification from '../src/models/Notification.js';

describe('Task Management Tests', () => {
  let adminUser, employee1, employee2;
  let testCompany;

  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    adminUser = await createTestUser({ role: 'admin' });
    employee1 = await createTestUser({ role: 'employee' });
    employee2 = await createTestUser({ role: 'employee' });

    testCompany = await Company.create({
      companyName: 'L&T Technology Services',
      location: 'Coimbatore Plant',
      companyPhoneNumber: '+919876543210',
      status: 'active',
      createdBy: adminUser.user._id,
    });
  });

  it('Admin should create and assign a task to multiple employees', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        taskName: 'PLC Firmware Upgrade',
        companyId: testCompany._id.toString(),
        description: 'Upgrade firmware to v4.2 and inspect communication modules',
        assignedEmployees: [employee1.user._id.toString(), employee2.user._id.toString()],
        priority: 'high',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.task.taskName, 'PLC Firmware Upgrade');
    assert.equal(res.body.data.task.assignedEmployees.length, 2);
    assert.equal(res.body.data.task.status, 'pending');

    // Verify in-app notifications generated for both employees
    const notifications = await Notification.find({ type: 'task_assigned' });
    assert.equal(notifications.length, 2);
  });

  it('Employee should NOT be allowed to create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({
        taskName: 'Unauthorized Task',
        companyId: testCompany._id.toString(),
        assignedEmployees: [employee1.user._id.toString()],
      });

    assert.equal(res.status, 403);
  });

  it('Employee should see only tasks assigned to them', async () => {
    // Task 1 assigned to employee 1 only
    await Task.create({
      taskName: 'Employee 1 Task',
      company: testCompany._id,
      assignedEmployees: [employee1.user._id],
      createdBy: adminUser.user._id,
    });

    // Task 2 assigned to employee 2 only
    await Task.create({
      taskName: 'Employee 2 Task',
      company: testCompany._id,
      assignedEmployees: [employee2.user._id],
      createdBy: adminUser.user._id,
    });

    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${employee1.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.tasks.length, 1);
    assert.equal(res.body.data.tasks[0].taskName, 'Employee 1 Task');
  });

  it('Assigned employee can update task status to in_progress and completed', async () => {
    const task = await Task.create({
      taskName: 'Motor Alignment',
      company: testCompany._id,
      assignedEmployees: [employee1.user._id],
      createdBy: adminUser.user._id,
    });

    // Update to in_progress
    const res1 = await request(app)
      .patch(`/api/tasks/${task._id}/status`)
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({ status: 'in_progress' });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.task.status, 'in_progress');

    // Update to completed
    const res2 = await request(app)
      .patch(`/api/tasks/${task._id}/status`)
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({ status: 'completed' });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.task.status, 'completed');
    assert.ok(res2.body.data.task.completedAt);
  });
});
