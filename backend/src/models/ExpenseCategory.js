import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    calculationMode: {
      type: String,
      enum: {
        values: ['automatic', 'manual'],
        message: '{VALUE} is not a valid calculation mode',
      },
      default: 'manual',
      required: true,
    },
    unit: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Unit cannot exceed 50 characters'],
    },
    ratePerUnit: {
      type: Number,
      default: 0,
      min: [0, 'Rate per unit cannot be negative'],
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

expenseCategorySchema.index({ name: 1, isDeleted: 1 });

/**
 * Default categories seed function
 */
expenseCategorySchema.statics.seedDefaults = async function () {
  const defaultCategories = [
    {
      name: 'Travel – Kilometer',
      description: 'Vehicle travel reimbursed per kilometer at configured rate',
      calculationMode: 'automatic',
      unit: 'km',
      ratePerUnit: 3,
      status: 'active',
    },
    {
      name: 'Travel – Bus',
      description: 'Public or private bus fare reimbursement',
      calculationMode: 'manual',
      unit: '',
      ratePerUnit: 0,
      status: 'active',
    },
    {
      name: 'Travel – Rapido',
      description: 'Bike taxi / cab ride reimbursement',
      calculationMode: 'manual',
      unit: '',
      ratePerUnit: 0,
      status: 'active',
    },
    {
      name: 'Food',
      description: 'Daily field work lunch, dinner, or refreshment allowance',
      calculationMode: 'manual',
      unit: '',
      ratePerUnit: 0,
      status: 'active',
    },
    {
      name: 'Recharge',
      description: 'Mobile or internet data recharge for duty communication',
      calculationMode: 'manual',
      unit: '',
      ratePerUnit: 0,
      status: 'active',
    },
    {
      name: 'Others',
      description: 'Custom expenses (parking fees, toll, consumables, etc.)',
      calculationMode: 'manual',
      unit: '',
      ratePerUnit: 0,
      status: 'active',
    },
  ];

  for (const cat of defaultCategories) {
    const existing = await this.findOne({ name: cat.name, isDeleted: false });
    if (!existing) {
      await this.create(cat);
    }
  }
};

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);

export default ExpenseCategory;
