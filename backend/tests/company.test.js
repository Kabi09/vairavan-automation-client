import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Company from '../src/models/Company.js';

describe('Company Management Tests', () => {
  let adminToken;
  let employeeToken;

  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    const admin = await createTestUser({ role: 'admin' });
    const employee = await createTestUser({ role: 'employee' });
    adminToken = admin.token;
    employeeToken = employee.token;
  });

  it('Admin should be able to create a company', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Apex Robotics Ltd',
        location: 'Coimbatore, Tamil Nadu',
        companyPhoneNumber: '+919876501234',
        status: 'active',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.company.companyName, 'Apex Robotics Ltd');
  });

  it('Should prevent duplicate company creation', async () => {
    await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Apex Robotics Ltd',
        location: 'Coimbatore, Tamil Nadu',
        companyPhoneNumber: '+919876501234',
      });

    const duplicateRes = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Apex Robotics Ltd',
        location: 'Chennai, Tamil Nadu',
        companyPhoneNumber: '+919876509999',
      });

    assert.equal(duplicateRes.status, 409);
    assert.equal(duplicateRes.body.success, false);
  });

  it('Employee should be able to create a company', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        companyName: 'Employee Added Co',
        location: 'Salem',
        companyPhoneNumber: '+919876543210',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.company.companyName, 'Employee Added Co');
  });

  it('Admin can soft-delete a company', async () => {
    const createRes = await request(app)
      .post('/api/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyName: 'Delete Me Industries',
        location: 'Madurai',
        companyPhoneNumber: '+919876501234',
      });

    const companyId = createRes.body.data.company._id;

    const delRes = await request(app)
      .delete(`/api/companies/${companyId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(delRes.status, 200);

    const check = await Company.findById(companyId);
    assert.equal(check.isDeleted, true);
    assert.equal(check.status, 'inactive');
  });
});
