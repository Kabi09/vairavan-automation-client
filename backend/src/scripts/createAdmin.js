import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config();

import User from '../models/User.js';
import { connectDB, disconnectDB } from '../config/db.js';

const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vairavan.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const adminPhone = process.env.ADMIN_PHONE || '+919876543210';
  const adminEmployeeId = (process.env.ADMIN_EMPLOYEE_ID || 'ADM001').toUpperCase().trim();
  const adminDesignation = process.env.ADMIN_DESIGNATION || 'System Administrator';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await connectDB();

    // Check if an admin already exists with this email or employee ID
    let existingAdmin = await User.findOne({
      $or: [{ email: adminEmail }, { employeeId: adminEmployeeId }, { role: 'admin' }],
    });

    if (existingAdmin) {
      console.log(`[Seed Notice] Administrator found (${existingAdmin.email}). Synchronizing credentials from .env...`);
      existingAdmin.employeeName = adminName;
      existingAdmin.email = adminEmail;
      existingAdmin.employeeId = adminEmployeeId;
      existingAdmin.password = adminPassword; // Triggers pre-save bcrypt hash
      existingAdmin.phoneNumber = adminPhone;
      existingAdmin.designation = adminDesignation;
      existingAdmin.role = 'admin';
      existingAdmin.accountStatus = 'active';

      await existingAdmin.save();

      console.log('========================================================');
      console.log('  Administrator Credentials Synchronized Successfully!');
      console.log(`  Name:        ${existingAdmin.employeeName}`);
      console.log(`  Email:       ${existingAdmin.email}`);
      console.log(`  Employee ID: ${existingAdmin.employeeId}`);
      console.log(`  Role:        ${existingAdmin.role}`);
      console.log(`  Status:      ${existingAdmin.accountStatus}`);
      console.log('========================================================');
      console.log(`  You can now log in using password: ${adminPassword}`);
      console.log('========================================================');
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
    console.log(`  You can now log in using password: ${adminPassword}`);
    console.log('========================================================');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] Failed to seed administrator: ${error.message}`);
    await disconnectDB();
    process.exit(1);
  }
};

seedAdmin();
