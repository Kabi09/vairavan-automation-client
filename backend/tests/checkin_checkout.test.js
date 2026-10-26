import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Company from '../src/models/Company.js';
import Client from '../src/models/Client.js';
import Duty from '../src/models/Duty.js';

describe('Check-In, Check-Out & Client Workflows', () => {
  let adminUser, employee;
  let clientCompany, officeCompany;

  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    adminUser = await createTestUser({ role: 'admin' });
    employee = await createTestUser({ role: 'employee' });

    clientCompany = await Company.create({
      companyName: 'Apex Textiles Ltd',
      location: 'Tirupur',
      companyType: 'client',
      companyPhoneNumber: '9876543210',
      status: 'active',
      createdBy: adminUser.user._id,
    });

    officeCompany = await Company.create({
      companyName: 'Vairavan Head Office',
      location: 'Chennai HQ',
      companyType: 'office',
      companyPhoneNumber: '8883280816',
      status: 'active',
      createdBy: adminUser.user._id,
    });
  });

  it('Employee can add a client to an existing client company', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        companyId: clientCompany._id.toString(),
        clientName: 'Senthil Kumar (Plant Incharge)',
        clientPhoneNumber: '9876543211',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.client.clientName, 'Senthil Kumar (Plant Incharge)');
    assert.equal(res.body.data.client.company._id.toString(), clientCompany._id.toString());
  });

  it('Workflow 1: Client Company Check-In, Active Duty Detection, and Check-Out with Manpower', async () => {
    // 1. Add client
    const client = await Client.create({
      company: clientCompany._id,
      clientName: 'Ramesh Sundaram',
      clientPhoneNumber: '9876500001',
      createdBy: employee.user._id,
    });

    // 2. Perform Check-In
    const checkInRes = await request(app)
      .post('/api/duties/check-in')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        dutyDate: '2026-10-26',
        dutyType: 'client',
        companyId: clientCompany._id.toString(),
        clientId: client._id.toString(),
        latitude: 13.0827,
        longitude: 80.2707,
        accuracy: 10,
        address: 'Apex Factory, Tirupur, TN',
      });

    assert.equal(checkInRes.status, 201);
    assert.equal(checkInRes.body.success, true);
    const dutyId = checkInRes.body.data.duty._id;
    assert.equal(checkInRes.body.data.duty.status, 'checked_in');
    assert.equal(checkInRes.body.data.duty.customerName, 'Ramesh Sundaram');
    assert.ok(checkInRes.body.data.duty.checkInTime);
    assert.ok(checkInRes.body.data.duty.inTime);

    // 3. Duplicate check-in should be prevented
    const duplicateRes = await request(app)
      .post('/api/duties/check-in')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        companyId: clientCompany._id.toString(),
      });
    assert.equal(duplicateRes.status, 400);
    assert.equal(duplicateRes.body.success, false);

    // 4. Query active check-in
    const activeRes = await request(app)
      .get('/api/duties/active-checkin')
      .set('Authorization', `Bearer ${employee.token}`);
    assert.equal(activeRes.status, 200);
    assert.ok(activeRes.body.data.activeDuty);
    assert.equal(activeRes.body.data.activeDuty._id.toString(), dutyId);

    // 5. Submit Work Details & Checkout
    const checkOutRes = await request(app)
      .post('/api/duties/check-out')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        dutyId,
        machineName: 'Spindle Frame Unit #4',
        workType: 'Electrical',
        workDescription: 'Serviced main VFD drive controller and tightened motor contacts',
        manpowerMembers: [
          { name: 'Kabilan', phoneNumber: '8883280816', description: 'Lead Technician' },
          { name: 'Murugan', phoneNumber: '9876543212', description: 'Assistant' },
        ],
        latitude: 13.083,
        longitude: 80.271,
        address: 'Apex Factory Gate #2, Tirupur',
      });

    assert.equal(checkOutRes.status, 200);
    assert.equal(checkOutRes.body.success, true);
    assert.equal(checkOutRes.body.data.duty.status, 'submitted');
    assert.equal(checkOutRes.body.data.duty.machineName, 'Spindle Frame Unit #4');
    assert.equal(checkOutRes.body.data.duty.manpowerMembers.length, 2);
    assert.ok(checkOutRes.body.data.duty.checkOutTime);
    assert.ok(checkOutRes.body.data.duty.outTime);

    // 6. Active check-in should now be null
    const afterCheckoutRes = await request(app)
      .get('/api/duties/active-checkin')
      .set('Authorization', `Bearer ${employee.token}`);
    assert.equal(afterCheckoutRes.body.data.activeDuty, null);
  });

  it('Workflow 2: Office Duty Check-In (no client required) and Direct Checkout', async () => {
    // 1. Office Check-In
    const checkInRes = await request(app)
      .post('/api/duties/check-in')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        dutyDate: '2026-10-26',
        dutyType: 'office',
        companyId: officeCompany._id.toString(),
        latitude: 12.901,
        longitude: 80.227,
        address: 'Vairavan Automation HQ, Chennai',
      });

    assert.equal(checkInRes.status, 201);
    assert.equal(checkInRes.body.data.duty.customerName, 'Office');
    assert.equal(checkInRes.body.data.duty.dutyType, 'office');
    assert.equal(checkInRes.body.data.duty.status, 'checked_in');

    const dutyId = checkInRes.body.data.duty._id;

    // 2. Direct Checkout without filling extensive work details
    const directCheckoutRes = await request(app)
      .post('/api/duties/check-out')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({
        dutyId,
        machineName: 'Internal Office Desk',
        workType: 'Maintenance',
        workDescription: 'General office maintenance and system monitoring',
      });

    assert.equal(directCheckoutRes.status, 200);
    assert.equal(directCheckoutRes.body.data.duty.status, 'submitted');
    assert.ok(directCheckoutRes.body.data.duty.checkOutTime);
  });
});
