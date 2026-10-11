import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';

let mongod = null;

export const setupTestDB = () => {
  // Increase timeout for downloading/starting mongodb-memory-server if needed
};

export const startMemoryServer = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  return uri;
};

export const stopMemoryServer = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
};

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

export const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    employeeName: 'Test Employee',
    employeeId: `EMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    email: `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@vairavan.com`,
    password: 'Password123!',
    role: 'employee',
    accountStatus: 'active',
    ...overrides,
  };

  const user = await User.create(defaultUser);
  const secret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_32_characters';
  const token = jwt.sign({ id: user._id, role: user.role, employeeId: user.employeeId }, secret, {
    expiresIn: '1d',
  });

  return { user, token, rawPassword: defaultUser.password };
};
