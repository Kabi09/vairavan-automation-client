import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
      index: true,
    },
    clientName: {
      type: String,
      required: [true, 'Client contact name is required'],
      trim: true,
      maxlength: [100, 'Client name cannot exceed 100 characters'],
      index: true,
    },
    clientPhoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} is not a valid status',
      },
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

clientSchema.index({ company: 1, isDeleted: 1 });
clientSchema.index({ clientName: 1, company: 1 });

const Client = mongoose.model('Client', clientSchema);

export default Client;
