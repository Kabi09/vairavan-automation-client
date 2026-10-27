import mongoose from 'mongoose';

const compOffCreditSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    sundayDate: {
      type: Date,
      required: [true, 'Sunday date is required'],
    },
    sundayDateString: {
      type: String,
      required: [true, 'Sunday date string is required (YYYY-MM-DD)'],
      trim: true,
      index: true,
    },
    duty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Duty',
      default: null,
    },
    status: {
      type: String,
      enum: ['earned', 'used', 'expired'],
      default: 'earned',
      index: true,
    },
    earnedDate: {
      type: Date,
      default: Date.now,
    },
    usedInLeave: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Leave',
      default: null,
    },
    notes: {
      type: String,
      default: 'Earned from Sunday duty attendance',
      trim: true,
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

// Strict compound unique index: exactly ONE credit per employee per Sunday!
compOffCreditSchema.index({ employee: 1, sundayDateString: 1 }, { unique: true });

const CompOffCredit = mongoose.model('CompOffCredit', compOffCreditSchema);

export default CompOffCredit;
