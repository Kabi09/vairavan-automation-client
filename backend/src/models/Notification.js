import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['admin', 'employee', 'all'],
      default: null,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'leave_request',
        'leave_reviewed',
        'duty_submitted',
        'work_submitted',
        'holiday_created',
        'holiday',
        'announcement',
        'message',
        'expense_submitted',
        'expense_reviewed',
        'document_uploaded',
      ],
      default: 'leave_request',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: new mongoose.Schema(
      {
        leaveId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Leave',
        },
        employeeId: String,
        employeeName: String,
        reason: String,
        startDate: Date,
        endDate: Date,
        status: String,
        adminRemarks: String,
        holidayId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Holiday',
        },
        holidayName: String,
        holidayDate: String,
        workId: String,
        dutyId: String,
      },
      { _id: false, strict: false }
    ),
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
