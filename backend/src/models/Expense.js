import mongoose from 'mongoose';
import Counter from './Counter.js';

const expenseItemSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      default: null,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    calculationMode: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'manual',
    },
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    ratePerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    outboundDistance: {
      type: Number,
      default: 0,
      min: 0,
    },
    returnDistance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDistance: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Item amount must be non-negative'],
    },
    customTitle: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    attachments: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        key: { type: String, default: '' },
      },
    ],
  },
  { _id: true }
);

const expenseSchema = new mongoose.Schema(
  {
    expenseId: {
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
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    duty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Duty',
      default: null,
      index: true,
    },
    relatedDuty: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    generalDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'General description cannot exceed 1000 characters'],
    },
    items: {
      type: [expenseItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one expense item is required',
      },
    },
    grandTotal: {
      type: Number,
      required: true,
      min: [0, 'Grand total must be non-negative'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        if (!ret.expenseId && ret._id) {
          ret.expenseId = `EXP-${ret._id.toString().slice(-4).toUpperCase()}`;
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to generate sequential 4-digit readable expenseId (e.g. EXP-1000, EXP-1001)
expenseSchema.pre('save', async function (next) {
  if (!this.expenseId) {
    try {
      const seq = await Counter.getNextSequence('expenseId', 1000);
      this.expenseId = `EXP-${seq}`;
    } catch (err) {
      const idHex = (this._id || new mongoose.Types.ObjectId()).toString();
      this.expenseId = `EXP-${idHex.slice(-4).toUpperCase()}`;
    }
  }
  if (typeof next === 'function') next();
});

expenseSchema.index({ employee: 1, expenseDate: -1 });
expenseSchema.index({ createdAt: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
