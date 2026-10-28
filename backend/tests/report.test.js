import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import Company from '../src/models/Company.js';
import Client from '../src/models/Client.js';
import Duty from '../src/models/Duty.js';
import Leave from '../src/models/Leave.js';
import Expense from '../src/models/Expense.js';
import CompOffCredit from '../src/models/CompOffCredit.js';
import ExcelJS from 'exceljs';

describe('All-in-One Report API Tests', () => {
  let adminUser, employee1, employee2;
  let testCompany, testClient;

  before(async () => {
    await startMemoryServer();
  });

  after(async () => {
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    adminUser = await createTestUser({ role: 'admin' });
    employee1 = await createTestUser({ role: 'employee', employeeName: 'Ravi Kumar', employeeId: 'EMP-001' });
    employee2 = await createTestUser({ role: 'employee', employeeName: 'Suresh Babu', employeeId: 'EMP-002' });

    testCompany = await Company.create({
      companyName: 'L&T Heavy Engineering',
      location: 'Coimbatore',
      companyType: 'client',
      createdBy: adminUser.user._id,
    });

    testClient = await Client.create({
      company: testCompany._id,
      clientName: 'Gopalakrishnan',
      clientPhoneNumber: '9876543210',
      createdBy: adminUser.user._id,
    });

    // Create duty records
    // 1. Regular 8h duty
    await Duty.create({
      employee: employee1.user._id,
      dutyDate: new Date(),
      company: testCompany._id,
      client: testClient._id,
      dutyType: 'client',
      inTime: '09:00',
      outTime: '17:00',
      totalDurationMinutes: 480, // 8 hours
      machineName: 'CNC Machine 1',
      workType: 'Maintenance',
      workDescription: 'Hydraulic pump servicing',
      status: 'approved',
    });

    // 2. Overtime duty: 10 hours (600 mins -> 2h OT)
    await Duty.create({
      employee: employee2.user._id,
      dutyDate: new Date(),
      company: testCompany._id,
      client: testClient._id,
      dutyType: 'client',
      inTime: '08:00',
      outTime: '18:00',
      totalDurationMinutes: 600, // 10 hours -> 2h OT
      machineName: 'Lathe Unit A',
      workType: 'Repair',
      workDescription: 'Spindle bearing replacement',
      status: 'submitted',
    });

    // Create a leave record
    await Leave.create({
      employee: employee1.user._id,
      leaveType: 'casual_leave',
      startDate: new Date(),
      endDate: new Date(),
      daysCount: 1,
      reason: 'Personal medical checkup',
      status: 'approved',
      adminReviewer: adminUser.user._id,
      adminRemarks: 'Approved',
    });

    // Create Sunday Comp-Off credit
    await CompOffCredit.create({
      employee: employee1.user._id,
      sundayDate: new Date(),
      sundayDateString: new Date().toISOString().split('T')[0],
      status: 'earned',
      notes: 'Earned from Sunday duty attendance',
    });

    // Create Expense claim
    await Expense.create({
      employee: employee1.user._id,
      expenseDate: new Date(),
      company: testCompany._id,
      client: testClient._id,
      generalDescription: 'Site visit fuel & breakfast',
      items: [
        {
          categoryName: 'Travel – Kilometer',
          calculationMode: 'automatic',
          unit: 'km',
          ratePerUnit: 3,
          outboundDistance: 20,
          returnDistance: 20,
          totalDistance: 40,
          amount: 120,
        },
      ],
      grandTotal: 120,
    });
  });

  it('GET /api/reports/all-in-one should reject non-admin users with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/reports/all-in-one')
      .set('Authorization', `Bearer ${employee1.token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('GET /api/reports/all-in-one should return comprehensive report for admin', async () => {
    const res = await request(app)
      .get('/api/reports/all-in-one?dateRange=this_month')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.summary);
    assert.equal(res.body.data.summary.totalWorkRecords, 2);
    assert.equal(res.body.data.summary.totalLeaveDays, 1);
    assert.equal(res.body.data.summary.totalCompOffRecords, 1);
    assert.equal(res.body.data.summary.totalOtHours, 2.0); // 600m - 480m = 120m = 2.0h
    assert.equal(res.body.data.summary.totalExpenses, 120);

    // Verify sections
    assert.ok(Array.isArray(res.body.data.companies));
    assert.ok(Array.isArray(res.body.data.duties));
    assert.ok(Array.isArray(res.body.data.employees));
    assert.ok(Array.isArray(res.body.data.leaves));
    assert.ok(Array.isArray(res.body.data.compOffCredits));
    assert.ok(Array.isArray(res.body.data.overtimeRecords));
    assert.equal(res.body.data.overtimeRecords.length, 1);
    assert.equal(res.body.data.overtimeRecords[0].otHours, 2.0);
  });

  it('GET /api/reports/all-in-one should support filtering by employee', async () => {
    const res = await request(app)
      .get(`/api/reports/all-in-one?employeeId=${employee2.user._id}&dateRange=this_month`)
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.totalWorkRecords, 1);
    assert.equal(res.body.data.duties[0].employee._id.toString(), employee2.user._id.toString());
    assert.ok(res.body.data.employeeCalendar);
    assert.ok(Array.isArray(res.body.data.employeeCalendar.calendarDays));
  });

  it('GET /api/reports/all-in-one/excel should generate a multi-worksheet Excel file with base64', async () => {
    const res = await request(app)
      .get('/api/reports/all-in-one/excel?dateRange=this_month')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.filename.endsWith('.xlsx'));
    assert.ok(res.body.data.base64);

    // Verify the generated Excel can be parsed and has the expected worksheets
    const buffer = Buffer.from(res.body.data.base64, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    assert.ok(sheetNames.includes('Summary'));
    assert.ok(sheetNames.includes('Companies & Clients'));
    assert.ok(sheetNames.includes('Work Details'));
    assert.ok(sheetNames.includes('Employee Details'));
    assert.ok(sheetNames.includes('Attendance & Working Days'));
    assert.ok(sheetNames.includes('Leave & Comp-Off'));
    assert.ok(sheetNames.includes('Overtime (OT)'));
    assert.ok(sheetNames.includes('Expenses'));
  });
});

