import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Notification from '../src/models/Notification.js';
import SharedDocument from '../src/models/SharedDocument.js';
import {
  startMemoryServer,
  stopMemoryServer,
  createTestUser,
} from './setup.js';

describe('Shared Document & Upload Tests', () => {
  let employeeUser;
  let employeeToken;
  let adminUser;
  let adminToken;
  let otherEmployeeUser;
  let otherEmployeeToken;

  before(async () => {
    await startMemoryServer();

    const emp1 = await createTestUser({ role: 'employee', employeeName: 'Ravi Kumar' });
    employeeUser = emp1.user;
    employeeToken = emp1.token;

    const adm = await createTestUser({ role: 'admin', employeeName: 'Super Admin' });
    adminUser = adm.user;
    adminToken = adm.token;

    const emp2 = await createTestUser({ role: 'employee', employeeName: 'Priya Sharma' });
    otherEmployeeUser = emp2.user;
    otherEmployeeToken = emp2.token;
  });

  after(async () => {
    await stopMemoryServer();
  });

  let uploadedDocId;

  it('POST /api/documents should allow employee to upload multiple files with title & description', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('title', 'Project Manual & Blueprints')
      .field('description', 'Comprehensive field servicing blueprints and user guide')
      .attach('files', Buffer.from('mock-pdf-content'), 'service_manual.pdf')
      .attach('files', Buffer.from('mock-excel-content'), 'cost_sheet.xlsx');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.document._id);
    assert.strictEqual(res.body.data.document.title, 'Project Manual & Blueprints');
    assert.strictEqual(res.body.data.document.uploaderName, 'Ravi Kumar');
    assert.strictEqual(res.body.data.document.uploaderRole, 'employee');
    assert.strictEqual(res.body.data.document.files.length, 2);
    assert.strictEqual(res.body.data.document.files[0].fileType, 'pdf');
    assert.strictEqual(res.body.data.document.files[1].fileType, 'sheet');

    uploadedDocId = res.body.data.document._id;

    // Verify in-app notification was generated for all users
    const notif = await Notification.findOne({
      type: 'document_uploaded',
      'data.documentId': uploadedDocId,
    });
    assert.ok(notif, 'Notification should be created');
    assert.strictEqual(notif.recipientRole, 'all');
    assert.ok(notif.readBy.some((uid) => uid.toString() === employeeUser._id.toString()));
  });

  it('GET /api/documents should list shared documents for all users', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.documents));
    assert.ok(res.body.data.documents.length >= 1);
    assert.strictEqual(res.body.data.documents[0].title, 'Project Manual & Blueprints');
  });

  it('GET /api/documents with search query should filter documents by title or file name', async () => {
    const res = await request(app)
      .get('/api/documents?search=blueprints')
      .set('Authorization', `Bearer ${otherEmployeeToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.documents.length, 1);

    const noMatch = await request(app)
      .get('/api/documents?search=nonexistent_xyz')
      .set('Authorization', `Bearer ${otherEmployeeToken}`);
    assert.strictEqual(noMatch.body.data.documents.length, 0);
  });

  it('GET /api/documents with role filter should filter by uploader role', async () => {
    const res = await request(app)
      .get('/api/documents?role=employee')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.documents.length, 1);

    const adminFilter = await request(app)
      .get('/api/documents?role=admin')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(adminFilter.body.data.documents.length, 0);
  });

  it('Other employee cannot delete document uploaded by someone else', async () => {
    const res = await request(app)
      .delete(`/api/documents/${uploadedDocId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  it('Admin CAN delete any shared document', async () => {
    const res = await request(app)
      .delete(`/api/documents/${uploadedDocId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify soft delete
    const docInDb = await SharedDocument.findById(uploadedDocId);
    assert.strictEqual(docInDb.isDeleted, true);

    // Verify it is excluded from GET /api/documents
    const getRes = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(getRes.body.data.documents.length, 0);
  });

  it('Employee CAN delete their own uploaded document', async () => {
    // Upload a new doc by otherEmployee
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${otherEmployeeToken}`)
      .field('title', 'Weekly Report')
      .attach('files', Buffer.from('report-data'), 'weekly.pdf');

    assert.strictEqual(uploadRes.status, 201);
    const docId = uploadRes.body.data.document._id;

    // Delete by author
    const delRes = await request(app)
      .delete(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`);

    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
  });
});
