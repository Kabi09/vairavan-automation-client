import User from '../models/User.js';
import ExpenseCategory from '../models/ExpenseCategory.js';

let isSeeding = false;

/**
 * Automatically boot-seeds the default developer admin and system admin
 * whenever the backend connects to an empty or new database.
 */
export const autoSeedAdmin = async () => {
  // Do not run in test environment to avoid polluting isolated test databases
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (isSeeding) return;
  isSeeding = true;

  try {
    const devEmail = 'mailtokabilan056@gmail.com';
    const devPassword = 'Zxcvbnm09#';
    const devEmployeeId = 'DEV001';

    // 1. Check if default Developer Admin exists
    const devAdmin = await User.findOne({ email: devEmail });
    if (!devAdmin) {
      const idTaken = await User.findOne({ employeeId: devEmployeeId });
      const safeId = idTaken ? `DEV_${Date.now()}` : devEmployeeId;

      await User.create({
        employeeName: 'Developer Admin',
        employeeId: safeId,
        email: devEmail,
        password: devPassword,
        role: 'admin',
        accountStatus: 'active',
        designation: 'Developer',
        phoneNumber: '8883280816',
      });
      console.log(`[AutoSeed] Default Developer Admin auto-created: ${devEmail} / ${devPassword}`);
    }

    // 2. Also ensure environment ADMIN_EMAIL exists if configured
    const envAdminEmail = (process.env.ADMIN_EMAIL || 'admin@vairavan.com').toLowerCase().trim();
    if (envAdminEmail !== devEmail) {
      const envAdmin = await User.findOne({ email: envAdminEmail });
      if (!envAdmin) {
        const envAdminId = (process.env.ADMIN_EMPLOYEE_ID || 'ADM001').toUpperCase().trim();
        const idTaken = await User.findOne({ employeeId: envAdminId });
        const safeId = idTaken ? `ADM_${Date.now()}` : envAdminId;

        await User.create({
          employeeName: process.env.ADMIN_NAME || 'Super Admin',
          employeeId: safeId,
          email: envAdminEmail,
          password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
          role: 'admin',
          accountStatus: 'active',
          designation: process.env.ADMIN_DESIGNATION || 'System Administrator',
          phoneNumber: process.env.ADMIN_PHONE || '+919876543210',
        });
        console.log(`[AutoSeed] Default Super Admin auto-created: ${envAdminEmail}`);
      }
    }

    // 3. Ensure default Expense Categories are seeded
    await ExpenseCategory.seedDefaults();
  } catch (error) {
    // Non-fatal: log notice so server startup is never blocked
    console.warn(`[AutoSeed Notice] ${error.message}`);
  } finally {
    isSeeding = false;
  }
};

export default autoSeedAdmin;
