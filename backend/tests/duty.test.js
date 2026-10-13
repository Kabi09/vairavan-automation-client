import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Company from '../src/models/Company.js';
import Duty from '../src/models/Duty.js';

describe('Duty Management Tests', () => {
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
      companyName: 'Precision Engineering Works',
      location: 'Coimbatore',
      companyPhoneNumber: '+919876543210',
      status: 'active',
      createdBy: adminUser.user._id,
    });
  });

  it('Employee should submit a duty report with automatic ownership', async () => {
    const res = await request(app)
      .post('/api/duties')
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({
        dutyDate: '2026-10-11',
        companyId: testCompany._id.toString(),
        customerName: 'Kabilan M',
        customerPhoneNumber: '+919876512345',
        machineName: 'CNC Milling Unit 3',
        workType: 'Maintenance',
        inTime: '09:30',
        outTime: '17:30',
        workDescription: 'Replaced hydraulic valves and calibrated sensor units',
        latitude: 11.0168,
        longitude: 76.9558,
        accuracy: 12.5,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.duty.customerName, 'Kabilan M');
    assert.equal(res.body.data.duty.employee._id.toString(), employee1.user._id.toString());
    assert.equal(res.body.data.duty.status, 'submitted');
  });

  it('Should reject submission if outTime is earlier than inTime (invalid same-day times)', async () => {
    const res = await request(app)
      .post('/api/duties')
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({
        dutyDate: '2026-10-11',
        companyId: testCompany._id.toString(),
        customerName: 'Kabilan M',
        customerPhoneNumber: '+919876512345',
        machineName: 'CNC Milling Unit 3',
        workType: 'Maintenance',
        inTime: '18:00',
        outTime: '09:00', // earlier than inTime
        workDescription: 'Work description',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Out time must be later than In time/i);
  });

  it('Employee should NOT be able to view another employee private duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'Private Client',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Confidential work',
      status: 'submitted',
    });

    const res = await request(app)
      .get(`/api/duties/${duty._id}`)
      .set('Authorization', `Bearer ${employee2.token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('Admin should be able to view and approve duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'Client Review',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Review work',
      status: 'submitted',
    });

    const res = await request(app)
      .patch(`/api/duties/${duty._id}/status`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        status: 'approved',
        remarks: 'Excellent work verified by client',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.duty.status, 'approved');
    assert.equal(res.body.data.duty.adminReview.remarks, 'Excellent work verified by client');
  });

  it('Employee cannot modify an approved duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'Locked Report',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Work completed',
      status: 'approved',
    });

    const res = await request(app)
      .put(`/api/duties/${duty._id}`)
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({
        workDescription: 'Attempt to tamper after approval',
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Approved duty reports cannot be modified/i);
  });

  it('Admin CAN modify an approved duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'Locked Report',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Work completed',
      status: 'approved',
    });

    const res = await request(app)
      .put(`/api/duties/${duty._id}`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        workDescription: 'Admin updated the description',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.duty.workDescription, 'Admin updated the description');
  });

  it('Admin should be able to delete a duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'To Be Deleted',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Work to delete',
      status: 'submitted',
    });

    const res = await request(app)
      .delete(`/api/duties/${duty._id}`)
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.deletedDutyId, duty._id.toString());

    const check = await Duty.findById(duty._id);
    assert.equal(check, null);
  });

  it('Employee cannot delete a duty report', async () => {
    const duty = await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date('2026-10-11'),
      company: testCompany._id,
      customerName: 'Employee Duty',
      customerPhoneNumber: '+919876543210',
      machineName: 'Lathe M1',
      workType: 'Repair',
      inTime: '10:00',
      outTime: '14:00',
      workDescription: 'Work description',
      status: 'submitted',
    });

    const res = await request(app)
      .delete(`/api/duties/${duty._id}`)
      .set('Authorization', `Bearer ${employee1.token}`);

    assert.equal(res.status, 403);
  });
});
