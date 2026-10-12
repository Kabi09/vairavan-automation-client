import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    taskName: {
      type: String,
      required: [true, 'Task name is required'],
      trim: true,
      maxlength: [150, 'Task name cannot exceed 150 characters'],
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned employee is required'],
    },
    date: {
      type: Date,
      required: [true, 'Task scheduled date is required'],
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
      match: [/^(?:\+91)?[0-9]{10}$/, 'Phone number must be exactly 10 digits'],
    },
    work: {
      type: String,
      required: [true, 'Work details / title is required'],
      trim: true,
      maxlength: [200, 'Work details cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'assigned',
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin assigner is required'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ employee: 1, date: -1, status: 1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
