import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'cancelled'],
        message: '{VALUE} is not a valid leave status',
      },
      default: 'pending',
      index: true,
    },
    leaveType: {
      type: String,
      enum: {
        values: ['casual_leave', 'comp_off'],
        message: '{VALUE} is not a valid leave type',
      },
      default: 'casual_leave',
      index: true,
    },
    daysCount: {
      type: Number,
      default: 1,
      min: [0.5, 'Days count must be at least 0.5'],
    },
    leaveYear: {
      type: Number,
      default: () => new Date().getFullYear(),
      index: true,
    },
    adminReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
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

// Compound index for overlap checks and employee list queries
leaveSchema.index({ employee: 1, startDate: 1, endDate: 1, status: 1 });
leaveSchema.index({ employee: 1, leaveType: 1, status: 1, leaveYear: 1 });

const Leave = mongoose.model('Leave', leaveSchema);

export default Leave;
