import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Notification from '../src/models/Notification.js';

describe('In-App Notification Tests', () => {
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

  it('Submitting a leave request should generate an in-app notification for admins', async () => {
    // 1. Employee submits leave
    const leaveRes = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Medical checkup',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
      });

    assert.equal(leaveRes.status, 201);
    const leaveId = leaveRes.body.data.leave._id;

    // 2. Admin queries notifications
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(notifRes.status, 200);
    assert.equal(notifRes.body.success, true);
    assert.equal(notifRes.body.data.notifications.length, 1);
    assert.equal(notifRes.body.data.unreadCount, 1);

    const notification = notifRes.body.data.notifications[0];
    assert.equal(notification.type, 'leave_request');
    assert.equal(notification.recipientRole, 'admin');
    // data.leaveId is populated with the Leave object
    assert.equal(notification.data.leaveId._id, leaveId.toString());
    assert.equal(notification.data.reason, 'Medical checkup');
  });

  it('Admin can mark a notification as read and mark all as read', async () => {
    // Create two notifications
    const n1 = await Notification.create({
      title: 'Test Notification 1',
      message: 'Body message 1',
      sender: adminUser.user._id,
      recipientRole: 'admin',
      type: 'leave_request',
    });
    const n2 = await Notification.create({
      title: 'Test Notification 2',
      message: 'Body message 2',
      sender: adminUser.user._id,
      recipientRole: 'admin',
      type: 'leave_request',
    });

    // Mark single notification read
    const readRes = await request(app)
      .patch(`/api/notifications/${n1._id}/read`)
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(readRes.status, 200);
    assert.equal(readRes.body.data.notification.isRead, true);

    // Mark all as read
    const markAllRes = await request(app)
      .patch('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(markAllRes.status, 200);

    // Verify unread count is 0
    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(listRes.body.data.unreadCount, 0);
  });

  it('Admin approving a leave request notifies the employee', async () => {
    // 1. Employee submits leave
    const leaveRes = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({
        reason: 'Wedding event',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
      });

    const leaveId = leaveRes.body.data.leave._id;

    // 2. Admin approves leave
    const reviewRes = await request(app)
      .patch(`/api/leaves/${leaveId}/review`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        status: 'approved',
        adminRemarks: 'Approved, enjoy the event!',
      });

    assert.equal(reviewRes.status, 200);

    // 3. Employee checks their notifications
    const empNotifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employeeUser.token}`);

    assert.equal(empNotifRes.status, 200);
    assert.equal(empNotifRes.body.data.notifications.length, 1);
    const empNotif = empNotifRes.body.data.notifications[0];
    assert.equal(empNotif.type, 'leave_reviewed');
    assert.equal(empNotif.data.status, 'approved');
  });

  it('Admin can broadcast message to all employees and specific employee, and employee can view it', async () => {
    // 1. Employee should NOT be allowed to send admin messages (403)
    const empSendRes = await request(app)
      .post('/api/notifications/send-message')
      .set('Authorization', `Bearer ${employeeUser.token}`)
      .send({ message: 'Unauthorized message' });
    assert.equal(empSendRes.status, 403);

    // 2. Admin broadcasts message to all employees
    const broadcastRes = await request(app)
      .post('/api/notifications/send-message')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        message: 'Team meeting tomorrow at 10 AM',
        sendToAll: true,
      });

    assert.equal(broadcastRes.status, 201);
    assert.equal(broadcastRes.body.success, true);
    assert.equal(broadcastRes.body.data.target, 'all');

    // 3. Employee checks notifications filtered by type=message
    const empMsgRes = await request(app)
      .get('/api/notifications?type=message')
      .set('Authorization', `Bearer ${employeeUser.token}`);

    assert.equal(empMsgRes.status, 200);
    assert.equal(empMsgRes.body.data.notifications.length, 1);
    assert.equal(empMsgRes.body.data.notifications[0].type, 'message');
    assert.equal(empMsgRes.body.data.notifications[0].message, 'Team meeting tomorrow at 10 AM');
    assert.equal(empMsgRes.body.data.unreadCount, 1);
    assert.equal(empMsgRes.body.data.unreadMessageCount, 1);

    // Admin sender should NOT have the broadcast message counted as unread
    const adminCheckRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminUser.token}`);
    assert.equal(adminCheckRes.body.data.unreadMessageCount, 0);

    // 4. Admin sends direct message to specific employee
    const directRes = await request(app)
      .post('/api/notifications/send-message')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        message: 'Please review client site documentation',
        recipientIds: [employeeUser.user._id],
      });

    assert.equal(directRes.status, 201);
    assert.equal(directRes.body.data.target, 'selected');

    // 5. Employee now sees 2 messages and unread count is 2
    const empMsgsUpdated = await request(app)
      .get('/api/notifications?type=message')
      .set('Authorization', `Bearer ${employeeUser.token}`);

    assert.equal(empMsgsUpdated.body.data.notifications.length, 2);
    assert.equal(empMsgsUpdated.body.data.unreadCount, 2);
    assert.equal(empMsgsUpdated.body.data.unreadMessageCount, 2);

    // 6. Mark one message as read
    const notifToRead = empMsgsUpdated.body.data.notifications[0];
    const markReadRes = await request(app)
      .patch(`/api/notifications/${notifToRead._id}/read`)
      .set('Authorization', `Bearer ${employeeUser.token}`);
    assert.equal(markReadRes.status, 200);
    assert.equal(markReadRes.body.data.notification.isRead, true);

    // Verify unreadMessageCount drops to 1
    const empAfterRead = await request(app)
      .get('/api/notifications?type=message')
      .set('Authorization', `Bearer ${employeeUser.token}`);
    assert.equal(empAfterRead.body.data.unreadMessageCount, 1);
  });
});
