import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Client from '../models/Client.js';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * @desc    Submit a new multi-item expense claim
 * @route   POST /api/expenses
 * @access  Private (Employee, Staff, Admin)
 */
export const createExpense = asyncHandler(async (req, res) => {
  const {
    expenseDate,
    companyId,
    company,
    clientId,
    client,
    dutyId,
    duty,
    relatedDuty,
    generalDescription = '',
    items = [],
  } = req.body;

  const targetCompanyId = companyId || company;
  const targetClientId = clientId || client;
  const targetDutyId = dutyId || duty || (mongoose.Types.ObjectId.isValid(relatedDuty) ? relatedDuty : null);

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Please add at least one expense item');
  }

  // 1. Verify company & client if provided
  let validatedCompany = null;
  if (targetCompanyId) {
    validatedCompany = await Company.findOne({ _id: targetCompanyId, isDeleted: false });
  }

  let validatedClient = null;
  if (targetClientId) {
    validatedClient = await Client.findOne({ _id: targetClientId, isDeleted: false });
  }

  // 2. Fetch all active categories to validate automatic rates
  const activeCategories = await ExpenseCategory.find({ isDeleted: false });
  const categoryMap = new Map();
  activeCategories.forEach((cat) => {
    categoryMap.set(cat.name.toLowerCase().trim(), cat);
    categoryMap.set(cat._id.toString(), cat);
  });

  // 3. Process and strictly validate each expense item on the backend
  let grandTotal = 0;
  const processedItems = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const categoryName = (item.categoryName || '').trim();

    if (!categoryName) {
      throw ApiError.badRequest(`Expense item #${i + 1} must have a category name`);
    }

    const matchedCat =
      categoryMap.get(categoryName.toLowerCase()) ||
      (item.category ? categoryMap.get(String(item.category)) : null);

    const calculationMode = matchedCat ? matchedCat.calculationMode : (item.calculationMode || 'manual');
    let itemAmount = 0;
    let appliedRate = matchedCat ? matchedCat.ratePerUnit : (Number(item.ratePerUnit || item.appliedRate) || 0);
    const unit = matchedCat ? matchedCat.unit : (item.unit || '');

    let outboundDistance = Number(item.outboundDistance ?? item.outboundDistanceKm) || 0;
    let returnDistance = Number(item.returnDistance ?? item.returnDistanceKm) || 0;
    let totalDistance = Number(item.totalDistance) || 0;
    let quantity = Number(item.quantity) || 0;

    if (calculationMode === 'automatic') {
      // Automatic category: recalculate amount from distance / quantity and configured rate
      if (totalDistance <= 0 && (outboundDistance > 0 || returnDistance > 0)) {
        totalDistance = outboundDistance + returnDistance;
      }
      const unitsToCharge = totalDistance > 0 ? totalDistance : (quantity > 0 ? quantity : 0);

      if (unitsToCharge <= 0) {
        throw ApiError.badRequest(
          `Item #${i + 1} (${categoryName}) requires a distance or quantity greater than zero`
        );
      }

      itemAmount = Math.round(unitsToCharge * appliedRate * 100) / 100;
    } else {
      // Manual category or Others
      itemAmount = Number(item.amount) || 0;
      if (itemAmount <= 0) {
        throw ApiError.badRequest(`Item #${i + 1} (${categoryName}) amount must be greater than zero`);
      }
    }

    grandTotal += itemAmount;

    // Attachments sanitization
    const sanitizedAttachments = Array.isArray(item.attachments)
      ? item.attachments
          .filter((att) => att && (att.url || typeof att === 'string'))
          .map((att) => ({
            url: typeof att === 'string' ? att : att.url,
            publicId: att.publicId || '',
            key: att.key || '',
          }))
      : [];

    const customTitle = (item.customTitle || item.customCategoryName || '').trim();

    processedItems.push({
      category: matchedCat ? matchedCat._id : null,
      categoryName: matchedCat ? matchedCat.name : categoryName,
      calculationMode,
      unit,
      ratePerUnit: appliedRate,
      outboundDistance,
      returnDistance,
      totalDistance,
      quantity,
      amount: itemAmount,
      customTitle,
      description: item.description ? item.description.trim() : '',
      attachments: sanitizedAttachments,
    });
  }

  grandTotal = Math.round(grandTotal * 100) / 100;

  // 4. Create expense submission record
  const expense = await Expense.create({
    employee: req.user._id,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    company: validatedCompany ? validatedCompany._id : null,
    client: validatedClient ? validatedClient._id : null,
    duty: targetDutyId,
    generalDescription: generalDescription ? generalDescription.trim() : '',
    items: processedItems,
    grandTotal,
  });

  const populatedExpense = await Expense.findById(expense._id)
    .populate('employee', 'employeeName employeeId email designation avatar')
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status');

  // 5. Notify administrators
  const formattedTotal = Number(grandTotal).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  await Notification.create({
    recipientRole: 'admin',
    sender: req.user._id,
    type: 'expense_submitted',
    title: `New Expense: ${formattedTotal}`,
    message: `${req.user.employeeName} submitted an expense of ${formattedTotal} (${processedItems.length} items)`,
    data: {
      expenseId: expense._id,
      expenseCode: expense.expenseId,
      grandTotal,
      itemCount: processedItems.length,
    },
  });

  notificationService
    .notifyAdmins(
      {
        title: `New Expense: ${formattedTotal}`,
        body: `${req.user.employeeName} submitted an expense claim of ${formattedTotal}.`,
      },
      {
        type: 'expense_submitted',
        expenseId: expense._id.toString(),
      }
    )
    .catch((err) => console.error('[FCM] Error notifying admins of expense:', err.message));

  return ApiResponse.created(res, 'Expense submitted successfully', {
    expense: populatedExpense,
  });
});

/**
 * @desc    Get authenticated employee's own expenses
 * @route   GET /api/expenses/my
 * @access  Private
 */
export const getMyExpenses = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { category, startDate, endDate, search, companyId } = req.query;

  const filter = { employee: req.user._id };

  if (companyId && companyId !== 'all') {
    filter.company = companyId;
  }

  if (category && category !== 'all') {
    filter['items.categoryName'] = category;
  }

  if (startDate || endDate) {
    filter.expenseDate = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setUTCHours(0, 0, 0, 0);
      filter.expenseDate.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setUTCHours(23, 59, 59, 999);
      filter.expenseDate.$lte = e;
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { expenseId: searchRegex },
      { generalDescription: searchRegex },
      { 'items.categoryName': searchRegex },
      { 'items.customTitle': searchRegex },
      { 'items.description': searchRegex },
    ];
  }

  // Calculate monthly & total metrics for employee (IST-aware date boundaries)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const istYear = istDate.getUTCFullYear();
  const istMonth = istDate.getUTCMonth();
  const istDay = istDate.getUTCDate();

  const startOfMonth = new Date(Date.UTC(istYear, istMonth, 1) - istOffset);
  const startOfDay = new Date(Date.UTC(istYear, istMonth, istDay) - istOffset);

  const [expenses, total, stats] = await Promise.all([
    Expense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('company', 'companyName location companyPhoneNumber companyType')
      .populate('client', 'clientName clientPhoneNumber status'),
    Expense.countDocuments(filter),
    Expense.aggregate([
      { $match: { employee: req.user._id } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$grandTotal' },
          totalCount: { $sum: 1 },
          thisMonthAmount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfMonth] }, '$grandTotal', 0],
            },
          },
          thisMonthCount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfMonth] }, 1, 0],
            },
          },
          todayAmount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfDay] }, '$grandTotal', 0],
            },
          },
          todayCount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfDay] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const rawStats = stats[0] || {};
  const summary = {
    totalAmount: rawStats.totalAmount || 0,
    totalCount: rawStats.totalCount || 0,
    thisMonthAmount: rawStats.thisMonthAmount || 0,
    monthAmount: rawStats.thisMonthAmount || 0,
    thisMonthCount: rawStats.thisMonthCount || 0,
    monthCount: rawStats.thisMonthCount || 0,
    todayAmount: rawStats.todayAmount || 0,
    todayCount: rawStats.todayCount || 0,
  };

  return ApiResponse.success(res, 200, 'My expenses retrieved successfully', {
    expenses,
    summary,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @desc    Get all expenses (Admin Panel Expense Dashboard)
 * @route   GET /api/expenses
 * @access  Private/Admin
 */
export const getAllExpenses = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { employeeId, companyId, clientId, category, startDate, endDate, search } = req.query;

  const targetEmployeeId = employeeId || req.query.employee;
  const targetCompanyId = companyId || req.query.company;
  const targetClientId = clientId || req.query.client;
  const targetCategory = category || req.query.categoryId;

  const filter = {};

  if (targetEmployeeId && targetEmployeeId !== 'all') {
    filter.employee = targetEmployeeId;
  }
  if (targetCompanyId && targetCompanyId !== 'all') {
    filter.company = targetCompanyId;
  }
  if (targetClientId && targetClientId !== 'all') {
    filter.client = targetClientId;
  }

  if (targetCategory && targetCategory !== 'all') {
    if (mongoose.Types.ObjectId.isValid(targetCategory)) {
      const catObj = await ExpenseCategory.findById(targetCategory);
      if (catObj) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { 'items.category': new mongoose.Types.ObjectId(targetCategory) },
            { 'items.categoryName': catObj.name },
            { 'items.categoryName': new RegExp(`^${catObj.name}$`, 'i') },
          ],
        });
      } else {
        filter['items.category'] = new mongoose.Types.ObjectId(targetCategory);
      }
    } else {
      filter['items.categoryName'] = new RegExp(targetCategory.trim(), 'i');
    }
  }

  if (startDate || endDate) {
    filter.expenseDate = {};
    if (startDate) {
      const dateParts = String(startDate).split('T')[0].split('-');
      if (dateParts.length === 3) {
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10) - 1;
        const d = parseInt(dateParts[2], 10);
        // Start of day in IST (00:00:00 IST -> UTC)
        const startIST = new Date(Date.UTC(y, m, d) - 5.5 * 60 * 60 * 1000);
        filter.expenseDate.$gte = startIST;
      } else {
        const s = new Date(startDate);
        s.setUTCHours(0, 0, 0, 0);
        filter.expenseDate.$gte = s;
      }
    }
    if (endDate) {
      const dateParts = String(endDate).split('T')[0].split('-');
      if (dateParts.length === 3) {
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10) - 1;
        const d = parseInt(dateParts[2], 10);
        // End of day in IST (23:59:59.999 IST -> UTC)
        const endIST = new Date(Date.UTC(y, m, d + 1) - 5.5 * 60 * 60 * 1000 - 1);
        filter.expenseDate.$lte = endIST;
      } else {
        const e = new Date(endDate);
        e.setUTCHours(23, 59, 59, 999);
        filter.expenseDate.$lte = e;
      }
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [matchingEmployees, matchingCompanies, matchingClients] = await Promise.all([
      User.find({
        $or: [
          { employeeName: searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex },
        ],
      }).select('_id'),
      Company.find({
        companyName: searchRegex,
      }).select('_id'),
      Client.find({
        clientName: searchRegex,
      }).select('_id'),
    ]);

    const matchingEmployeeIds = matchingEmployees.map((e) => e._id);
    const matchingCompanyIds = matchingCompanies.map((c) => c._id);
    const matchingClientIds = matchingClients.map((c) => c._id);

    const searchOrConditions = [
      { expenseId: searchRegex },
      { generalDescription: searchRegex },
      { 'items.categoryName': searchRegex },
      { 'items.customTitle': searchRegex },
      { 'items.description': searchRegex },
    ];

    if (matchingEmployeeIds.length > 0) {
      searchOrConditions.push({ employee: { $in: matchingEmployeeIds } });
    }
    if (matchingCompanyIds.length > 0) {
      searchOrConditions.push({ company: { $in: matchingCompanyIds } });
    }
    if (matchingClientIds.length > 0) {
      searchOrConditions.push({ client: { $in: matchingClientIds } });
    }

    if (filter.$and) {
      filter.$and.push({ $or: searchOrConditions });
    } else {
      filter.$and = [{ $or: searchOrConditions }];
    }
  }

  // Calculate Admin Expense Dashboard Metrics:
  // - Total Expenses Submitted (and totalExpensesCount)
  // - Total Expense Amount (and totalExpensesAmount)
  // - Total Expenses Today (and todayExpensesAmount, todayExpensesCount)
  // - Total Expenses This Month (and monthExpensesAmount, monthExpensesCount)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const istYear = istDate.getUTCFullYear();
  const istMonth = istDate.getUTCMonth();
  const istDay = istDate.getUTCDate();

  const startOfMonth = new Date(Date.UTC(istYear, istMonth, 1) - istOffset);
  const startOfDay = new Date(Date.UTC(istYear, istMonth, istDay) - istOffset);

  const [expenses, total, stats] = await Promise.all([
    Expense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeName employeeId email designation avatar phoneNumber')
      .populate('company', 'companyName location companyPhoneNumber companyType')
      .populate('client', 'clientName clientPhoneNumber status')
      .populate('duty', 'dutyId machineName workType'),
    Expense.countDocuments(filter),
    Expense.aggregate([
      {
        $group: {
          _id: null,
          totalExpensesSubmitted: { $sum: 1 },
          totalExpenseAmount: { $sum: '$grandTotal' },
          totalExpensesTodayCount: {
            $sum: { $cond: [{ $gte: ['$expenseDate', startOfDay] }, 1, 0] },
          },
          totalExpensesTodayAmount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfDay] }, '$grandTotal', 0],
            },
          },
          totalExpensesThisMonthCount: {
            $sum: { $cond: [{ $gte: ['$expenseDate', startOfMonth] }, 1, 0] },
          },
          totalExpensesThisMonthAmount: {
            $sum: {
              $cond: [{ $gte: ['$expenseDate', startOfMonth] }, '$grandTotal', 0],
            },
          },
        },
      },
    ]),
  ]);

  const rawMetrics = stats[0] || {};
  const dashboardMetrics = {
    totalExpensesSubmitted: rawMetrics.totalExpensesSubmitted || 0,
    totalExpenseAmount: rawMetrics.totalExpenseAmount || 0,
    totalExpensesTodayCount: rawMetrics.totalExpensesTodayCount || 0,
    totalExpensesTodayAmount: rawMetrics.totalExpensesTodayAmount || 0,
    totalExpensesThisMonthCount: rawMetrics.totalExpensesThisMonthCount || 0,
    totalExpensesThisMonthAmount: rawMetrics.totalExpensesThisMonthAmount || 0,

    // Frontend-expected aliases (AdminExpensesScreen)
    totalExpensesCount: rawMetrics.totalExpensesSubmitted || 0,
    totalExpensesAmount: rawMetrics.totalExpenseAmount || 0,
    todayExpensesCount: rawMetrics.totalExpensesTodayCount || 0,
    todayExpensesAmount: rawMetrics.totalExpensesTodayAmount || 0,
    monthExpensesCount: rawMetrics.totalExpensesThisMonthCount || 0,
    monthExpensesAmount: rawMetrics.totalExpensesThisMonthAmount || 0,
  };

  return ApiResponse.success(res, 200, 'Expense dashboard data retrieved successfully', {
    expenses,
    metrics: dashboardMetrics,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

/**
 * @desc    Get single expense record details
 * @route   GET /api/expenses/:id
 * @access  Private
 */
export const getExpenseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await Expense.findById(id)
    .populate('employee', 'employeeName employeeId email designation avatar phoneNumber')
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('duty', 'dutyId machineName workType');

  if (!expense) {
    throw ApiError.notFound('Expense record not found');
  }

  // Permissions: employees can view only their own expense records
  if (req.user.role !== 'admin' && expense.employee._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You are not authorized to view this expense record');
  }

  return ApiResponse.success(res, 200, 'Expense record details retrieved successfully', {
    expense,
  });
});

/**
 * @desc    Delete expense record
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
export const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await Expense.findById(id);
  if (!expense) {
    throw ApiError.notFound('Expense record not found');
  }

  if (req.user.role !== 'admin' && expense.employee.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You can only delete your own expense records');
  }

  await Expense.findByIdAndDelete(id);

  return ApiResponse.success(res, 200, 'Expense record deleted successfully', {
    deletedExpenseId: id,
  });
});

export default {
  createExpense,
  getMyExpenses,
  getAllExpenses,
  getExpenseById,
  deleteExpense,
};
