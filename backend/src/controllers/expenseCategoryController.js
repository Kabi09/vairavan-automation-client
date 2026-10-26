import ExpenseCategory from '../models/ExpenseCategory.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Get expense categories
 * @route   GET /api/expense-categories
 * @access  Private
 */
export const getExpenseCategories = asyncHandler(async (req, res) => {
  const filter = { isDeleted: false };

  // Non-admins only see active categories
  if (req.user.role !== 'admin') {
    filter.status = 'active';
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const categories = await ExpenseCategory.find(filter).sort({ name: 1 });

  return ApiResponse.success(res, 200, 'Expense categories retrieved successfully', {
    categories,
  });
});

/**
 * @desc    Create a new expense category
 * @route   POST /api/expense-categories
 * @access  Private/Admin
 */
export const createExpenseCategory = asyncHandler(async (req, res) => {
  const { name, description = '', calculationMode = 'manual', unit = '', ratePerUnit = 0, status = 'active' } = req.body;

  if (!name || !name.trim()) {
    throw ApiError.badRequest('Category name is required');
  }

  const existing = await ExpenseCategory.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    isDeleted: false,
  });

  if (existing) {
    throw ApiError.conflict('An expense category with this name already exists');
  }

  const category = await ExpenseCategory.create({
    name: name.trim(),
    description: description.trim(),
    calculationMode,
    unit: unit.trim(),
    ratePerUnit: calculationMode === 'automatic' ? Number(ratePerUnit) : 0,
    status,
    createdBy: req.user._id,
  });

  return ApiResponse.created(res, 'Expense category created successfully', { category });
});

/**
 * @desc    Update an expense category
 * @route   PUT /api/expense-categories/:id
 * @access  Private/Admin
 */
export const updateExpenseCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, calculationMode, unit, ratePerUnit, status } = req.body;

  const category = await ExpenseCategory.findOne({ _id: id, isDeleted: false });
  if (!category) {
    throw ApiError.notFound('Expense category not found');
  }

  if (name && name.trim()) {
    const existing = await ExpenseCategory.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isDeleted: false,
    });
    if (existing) {
      throw ApiError.conflict('Another category with this name already exists');
    }
    category.name = name.trim();
  }

  if (description !== undefined) category.description = description.trim();
  if (calculationMode !== undefined) category.calculationMode = calculationMode;
  if (unit !== undefined) category.unit = unit.trim();
  if (ratePerUnit !== undefined) {
    category.ratePerUnit = (calculationMode || category.calculationMode) === 'automatic'
      ? Number(ratePerUnit)
      : 0;
  }
  if (status !== undefined) category.status = status;

  await category.save();

  return ApiResponse.success(res, 200, 'Expense category updated successfully', { category });
});

/**
 * @desc    Delete (soft delete) an expense category
 * @route   DELETE /api/expense-categories/:id
 * @access  Private/Admin
 */
export const deleteExpenseCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await ExpenseCategory.findOne({ _id: id, isDeleted: false });
  if (!category) {
    throw ApiError.notFound('Expense category not found');
  }

  category.isDeleted = true;
  await category.save();

  return ApiResponse.success(res, 200, 'Expense category deleted successfully');
});

export default {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
};
