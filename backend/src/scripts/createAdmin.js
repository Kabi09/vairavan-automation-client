import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB, disconnectDB } from '../config/db.js';

const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vairavan.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminPhone = process.env.ADMIN_PHONE || '+919876543210';
  const adminEmployeeId = (process.env.ADMIN_EMPLOYEE_ID || 'ADM001').toUpperCase().trim();
  const adminDesignation = process.env.ADMIN_DESIGNATION || 'Head Administrator';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await connectDB();

    // Check if an admin already exists with this email or employee ID
    const existingAdmin = await User.findOne({
      $or: [{ email: adminEmail }, { employeeId: adminEmployeeId }, { role: 'admin' }],
    });

    if (existingAdmin) {
      console.log(`[Seed Notice] An administrator already exists:`);
      console.log(`  Name: ${existingAdmin.employeeName}`);
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Employee ID: ${existingAdmin.employeeId}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Status: ${existingAdmin.accountStatus}`);
      console.log(`[Seed Notice] Admin bootstrap skipped to avoid overriding existing credentials.`);
      await disconnectDB();
      process.exit(0);
    }

    console.log(`[Seed] Creating initial administrator: ${adminEmail} (${adminEmployeeId})...`);

    const newAdmin = await User.create({
      employeeName: adminName,
      employeeId: adminEmployeeId,
      email: adminEmail,
      password: adminPassword,
      phoneNumber: adminPhone,
      designation: adminDesignation,
      role: 'admin',
      accountStatus: 'active',
      joiningDate: new Date(),
    });

    console.log('========================================================');
    console.log('  Initial Administrator Created Successfully!');
    console.log(`  Name:        ${newAdmin.employeeName}`);
    console.log(`  Email:       ${newAdmin.email}`);
    console.log(`  Employee ID: ${newAdmin.employeeId}`);
    console.log(`  Role:        ${newAdmin.role}`);
    console.log('========================================================');
    console.log('  You can now log in using the configured password.');
    console.log('========================================================');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to create admin: ${error.message}`);
    await disconnectDB();
    process.exit(1);
  }
};

seedAdmin();
