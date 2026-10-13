import mongoose from 'mongoose';

const auditTrailSchema = new mongoose.Schema(
  {
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const dutySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    dutyDate: {
      type: Date,
      required: [true, 'Duty date is required'],
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    customerPhoneNumber: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
    },
    machineName: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
      maxlength: [100, 'Machine name cannot exceed 100 characters'],
    },
    workType: {
      type: String,
      required: [true, 'Work type is required'],
      enum: {
        values: ['Electrical', 'Mechanical', 'Installation', 'Maintenance', 'Repair', 'Other'],
        message: '{VALUE} is not a supported work type',
      },
      index: true,
    },
    inTime: {
      type: String,
      required: [true, 'In time is required'],
      trim: true,
    },
    outTime: {
      type: String,
      required: [true, 'Out time is required'],
      trim: true,
    },
    workDescription: {
      type: String,
      required: [true, 'Work description is required'],
      trim: true,
      maxlength: [2000, 'Work description cannot exceed 2000 characters'],
    },
    customerSignature: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      key: { type: String, default: '' },
    },
    customerProofPhotos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        key: { type: String, default: '' },
      },
    ],
    location: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
        default: null,
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
        default: null,
      },
      accuracy: {
        type: Number,
        min: [0, 'Accuracy must be a positive number'],
        default: null,
      },
      capturedAt: {
        type: Date,
        default: Date.now,
      },
    },
    status: {
      type: String,
      enum: {
        values: ['submitted', 'approved', 'rejected', 'correction_requested'],
        message: '{VALUE} is not a valid duty status',
      },
      default: 'submitted',
      index: true,
    },
    adminReview: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      remarks: {
        type: String,
        default: '',
        trim: true,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
    },
    auditTrail: {
      type: [auditTrailSchema],
      default: [],
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

// Compound indexes for performant querying
dutySchema.index({ employee: 1, dutyDate: -1 });
dutySchema.index({ company: 1, dutyDate: -1 });
dutySchema.index({ status: 1, dutyDate: -1 });

const Duty = mongoose.model('Duty', dutySchema);

export default Duty;
