import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config();

const devEmail = 'admin@gmail.com';
const devPassword = 'Zxcvbnm09#';
const devEmployeeId = 'DEV001';
const devName = 'Developer Admin';

const candidateDbs = ['vairavan_auto', 'vairavan_auto23', 'vairavan_automation', 'vairavan01', 'test'];

async function run() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(devPassword, salt);

  for (const dbName of candidateDbs) {
    const uri = `mongodb+srv://Dude_Quizz:Zxcvbnm09%23@dudeai.2c3kmqr.mongodb.net/${dbName}?appName=DudeAI`;
    try {
      const conn = await mongoose.createConnection(uri).asPromise();
      const usersCol = conn.collection('users');

      const existing = await usersCol.findOne({ email: devEmail });
      if (existing) {
        await usersCol.updateOne(
          { _id: existing._id },
          {
            $set: {
              password: hashedPassword,
              role: 'admin',
              accountStatus: 'active',
              employeeName: devName,
              employeeId: existing.employeeId || devEmployeeId,
            },
          }
        );
        console.log(`[${dbName}] Updated existing dev admin: ${devEmail}`);
      } else {
        await usersCol.insertOne({
          employeeName: devName,
          employeeId: devEmployeeId,
          email: devEmail,
          password: hashedPassword,
          phoneNumber: '+919999999999',
          designation: 'Developer',
          role: 'admin',
          accountStatus: 'active',
          joiningDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`[${dbName}] Created new dev admin: ${devEmail}`);
      }

      const allUsers = await usersCol
        .find({}, { projection: { email: 1, role: 1, employeeId: 1, employeeName: 1 } })
        .toArray();
      console.log(`[${dbName}] Current users:`, allUsers);

      await conn.close();
    } catch (err) {
      console.error(`[${dbName}] Error:`, err.message);
    }
  }
}

run()
  .then(() => {
    console.log('Seeding finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
