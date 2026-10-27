import mongoose from 'mongoose';

const leaveConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
    },
    defaultCasualLeaveAllowance: {
      type: Number,
      default: 12,
      min: [1, 'Casual leave allowance must be at least 1 day'],
      max: [365, 'Casual leave allowance cannot exceed 365 days'],
    },
    leaveYear: {
      type: Number,
      default: () => new Date().getFullYear(),
    },
    weeklyHoliday: {
      type: String,
      default: 'Sunday',
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const LeaveConfig = mongoose.model('LeaveConfig', leaveConfigSchema);

export default LeaveConfig;
