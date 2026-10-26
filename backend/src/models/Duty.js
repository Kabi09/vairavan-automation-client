import mongoose from 'mongoose';
import Counter from './Counter.js';

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
    dutyId: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
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
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    dutyType: {
      type: String,
      enum: ['client', 'office'],
      default: 'client',
      index: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    checkInLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      address: { type: String, default: '', trim: true },
      capturedAt: { type: Date, default: null },
    },
    checkOutLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      address: { type: String, default: '', trim: true },
      capturedAt: { type: Date, default: null },
    },
    totalDurationMinutes: {
      type: Number,
      default: 0,
    },
    customerName: {
      type: String,
      default: 'Office',
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    customerPhoneNumber: {
      type: String,
      default: '',
      trim: true,
    },
    machineName: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Machine name cannot exceed 100 characters'],
    },
    workType: {
      type: String,
      default: 'Maintenance',
      enum: {
        values: ['Electrical', 'Mechanical', 'Installation', 'Maintenance', 'Repair', 'Other'],
        message: '{VALUE} is not a supported work type',
      },
      index: true,
    },
    customWorkType: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Custom work type cannot exceed 200 characters'],
    },
    inTime: {
      type: String,
      default: '',
      trim: true,
    },
    outTime: {
      type: String,
      default: '',
      trim: true,
    },
    workDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Work description cannot exceed 2000 characters'],
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    manpowerMembers: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        phoneNumber: {
          type: String,
          default: '',
          trim: true,
        },
        description: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],
    customerSignature: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      key: { type: String, default: '' },
      signedAt: { type: Date, default: null },
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
      address: {
        type: String,
        default: '',
        trim: true,
      },
      capturedAt: {
        type: Date,
        default: Date.now,
      },
    },
    status: {
      type: String,
      enum: {
        values: ['checked_in', 'submitted', 'approved', 'rejected', 'correction_requested'],
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
        if (!ret.dutyId && ret._id) {
          ret.dutyId = `WORK-${ret._id.toString().slice(-4).toUpperCase()}`;
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to generate sequential 4-digit readable dutyId if not already set (e.g. WORK-1000, WORK-1001)
dutySchema.pre('save', async function (next) {
  if (!this.dutyId) {
    try {
      const seq = await Counter.getNextSequence('workId', 1000);
      this.dutyId = `WORK-${seq}`;
    } catch (err) {
      const idHex = (this._id || new mongoose.Types.ObjectId()).toString();
      this.dutyId = `WORK-${idHex.slice(-4).toUpperCase()}`;
    }
  }
  if (typeof next === 'function') next();
});

// Compound indexes for performant querying
dutySchema.index({ employee: 1, dutyDate: -1 });
dutySchema.index({ company: 1, dutyDate: -1 });
dutySchema.index({ status: 1, dutyDate: -1 });

const Duty = mongoose.model('Duty', dutySchema);

export default Duty;
