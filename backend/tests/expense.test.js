import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { startMemoryServer, stopMemoryServer, clearDatabase, createTestUser } from './setup.js';
import ExpenseCategory from '../src/models/ExpenseCategory.js';
import Expense from '../src/models/Expense.js';

describe('Expense Management Tests', () => {
  let adminUser, employee1, employee2;

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

    // Seed default categories
    await ExpenseCategory.seedDefaults();
  });

  it('Default categories should be seeded and accessible to employee', async () => {
    const res = await request(app)
      .get('/api/expense-categories')
      .set('Authorization', `Bearer ${employee1.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.categories.length >= 6);

    const kmCat = res.body.data.categories.find((c) => c.name === 'Travel – Kilometer');
    assert.ok(kmCat);
    assert.equal(kmCat.calculationMode, 'automatic');
    assert.equal(kmCat.ratePerUnit, 3);
  });

  it('Admin can add and update custom expense categories with custom rates', async () => {
    const createRes = await request(app)
      .post('/api/expense-categories')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        name: 'Courier & Freight',
        description: 'Shipping parts to client site',
        calculationMode: 'manual',
        status: 'active',
      });

    assert.equal(createRes.status, 201);
    const catId = createRes.body.data.category._id;

    // Admin updates the rate on Travel – Kilometer to ₹4/km
    const kmCat = await ExpenseCategory.findOne({ name: 'Travel – Kilometer' });
    const updateRes = await request(app)
      .put(`/api/expense-categories/${kmCat._id}`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({
        ratePerUnit: 4,
      });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.category.ratePerUnit, 4);
  });

  it('Employee should submit multiple expense items with automatic & manual calculations', async () => {
    const kmCat = await ExpenseCategory.findOne({ name: 'Travel – Kilometer' });

    const submissionData = {
      expenseDate: '2026-10-26',
      generalDescription: 'Field visit to Tirupur site',
      items: [
        {
          category: kmCat._id.toString(),
          categoryName: 'Travel – Kilometer',
          calculationMode: 'automatic',
          outboundDistance: 10,
          returnDistance: 10,
          totalDistance: 20, // 20 km * 3 = 60
          ratePerUnit: 3,
          description: 'Bike travel to site and back',
        },
        {
          categoryName: 'Food',
          calculationMode: 'manual',
          amount: 300,
          description: 'Lunch for team',
        },
        {
          categoryName: 'Others',
          calculationMode: 'manual',
          customTitle: 'Parking Fee',
          amount: 50,
          description: 'Station parking',
        },
      ],
    };

    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${employee1.token}`)
      .send(submissionData);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.expense.expenseId.startsWith('EXP-'));
    assert.equal(res.body.data.expense.items.length, 3);
    // Grand Total: 60 + 300 + 50 = 410
    assert.equal(res.body.data.expense.grandTotal, 410);

    // Verify item calculation preserved
    const autoItem = res.body.data.expense.items[0];
    assert.equal(autoItem.amount, 60);
    assert.equal(autoItem.totalDistance, 20);
    assert.equal(autoItem.ratePerUnit, 3);
  });

  it('Admin Expense Dashboard should return accurate metrics and records', async () => {
    // Create an expense for employee1 (₹500)
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${employee1.token}`)
      .send({
        expenseDate: new Date().toISOString(),
        items: [
          {
            categoryName: 'Food',
            calculationMode: 'manual',
            amount: 500,
          },
        ],
      });

    // Create an expense for employee2 (₹1000)
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${employee2.token}`)
      .send({
        expenseDate: new Date().toISOString(),
        items: [
          {
            categoryName: 'Travel – Bus',
            calculationMode: 'manual',
            amount: 1000,
          },
        ],
      });

    // Admin queries all expenses
    const adminRes = await request(app)
      .get('/api/expenses')
      .set('Authorization', `Bearer ${adminUser.token}`);

    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.data.metrics.totalExpensesSubmitted, 2);
    assert.equal(adminRes.body.data.metrics.totalExpenseAmount, 1500);
    assert.equal(adminRes.body.data.metrics.totalExpensesTodayAmount, 1500);
    // Verify frontend aliases:
    assert.equal(adminRes.body.data.metrics.totalExpensesCount, 2);
    assert.equal(adminRes.body.data.metrics.totalExpensesAmount, 1500);
    assert.equal(adminRes.body.data.metrics.todayExpensesAmount, 1500);
    assert.equal(adminRes.body.data.metrics.monthExpensesAmount, 1500);

    // Employee1 should only see their own expense (1 record, ₹500)
    const empRes = await request(app)
      .get('/api/expenses/my')
      .set('Authorization', `Bearer ${employee1.token}`);

    assert.equal(empRes.status, 200);
    assert.equal(empRes.body.data.expenses.length, 1);
    assert.equal(empRes.body.data.summary.totalAmount, 500);
    assert.equal(empRes.body.data.summary.monthAmount, 500);
  });
});
