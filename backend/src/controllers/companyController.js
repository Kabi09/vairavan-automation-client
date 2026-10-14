import Company from '../models/Company.js';
import Duty from '../models/Duty.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Create new company
 * @route   POST /api/companies
 * @access  Private/Admin
 */
export const createCompany = asyncHandler(async (req, res) => {
  const {
    companyName,
    location,
    companyPhoneNumber,
    status = 'active',
    companyType = 'client',
  } = req.body;

  // Prevent duplicate company with same name (case-insensitive)
  const existing = await Company.findOne({
    companyName: new RegExp(`^${companyName.trim()}$`, 'i'),
    isDeleted: false,
  });

  if (existing) {
    throw ApiError.conflict(`A company named '${companyName.trim()}' already exists`);
  }

  const company = await Company.create({
    companyName: companyName.trim(),
    location: location.trim(),
    companyPhoneNumber: companyPhoneNumber ? companyPhoneNumber.trim() : '',
    companyType: companyType === 'office' ? 'office' : 'client',
    status,
    createdBy: req.user._id,
  });

  return ApiResponse.created(res, 'Company created successfully', { company });
});

/**
 * @desc    Get companies (Admin sees all with filters; Employees see active companies)
 * @route   GET /api/companies
 * @access  Private (Admin / Employee)
 */
export const getCompanies = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { search, status, companyType } = req.query;

  const filter = { isDeleted: false };

  // If user is employee, restrict to active companies only
  if (req.user.role === 'employee') {
    filter.status = 'active';
  } else if (status) {
    filter.status = status;
  }

  if (companyType) {
    filter.companyType = companyType;
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { companyName: searchRegex },
      { location: searchRegex },
      { companyPhoneNumber: searchRegex },
    ];
  }

  const [companies, total] = await Promise.all([
    Company.find(filter)
      .sort({ companyType: -1, companyName: 1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'employeeName employeeId email'),
    Company.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Companies retrieved successfully', {
    companies,
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
 * @desc    Get single company by ID
 * @route   GET /api/companies/:id
 * @access  Private (Admin / Employee)
 */
export const getCompanyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const company = await Company.findOne({ _id: id, isDeleted: false }).populate(
    'createdBy',
    'employeeName employeeId'
  );

  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  return ApiResponse.success(res, 200, 'Company retrieved successfully', { company });
});

/**
 * @desc    Update company details
 * @route   PUT /api/companies/:id
 * @access  Private/Admin
 */
export const updateCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { companyName, location, companyPhoneNumber, status, companyType } = req.body;

  const company = await Company.findOne({ _id: id, isDeleted: false });
  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  if (companyName && companyName.trim() !== company.companyName) {
    // Check if new name conflicts with another active company
    const duplicate = await Company.findOne({
      _id: { $ne: id },
      companyName: new RegExp(`^${companyName.trim()}$`, 'i'),
      isDeleted: false,
    });
    if (duplicate) {
      throw ApiError.conflict(`Another company named '${companyName.trim()}' already exists`);
    }
    company.companyName = companyName.trim();
  }

  if (location) company.location = location.trim();
  if (companyPhoneNumber !== undefined) company.companyPhoneNumber = (companyPhoneNumber || '').trim();
  if (status) company.status = status;
  if (companyType && ['office', 'client'].includes(companyType)) {
    company.companyType = companyType;
  }

  await company.save();

  return ApiResponse.success(res, 200, 'Company updated successfully', { company });
});

/**
 * @desc    Deactivate or soft-delete company
 * @route   DELETE /api/companies/:id
 * @access  Private/Admin
 */
export const deleteCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const company = await Company.findOne({ _id: id, isDeleted: false });
  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  // Check if company is referenced in existing duty reports
  const dutyCount = await Duty.countDocuments({ company: id });

  if (dutyCount > 0) {
    // Cannot hard delete: soft-delete and mark inactive
    company.status = 'inactive';
    company.isDeleted = true;
    await company.save();

    return ApiResponse.success(
      res,
      200,
      `Company has ${dutyCount} associated duty report(s). It has been deactivated and archived instead of permanently deleted.`,
      { company }
    );
  }

  // Safe to soft-delete
  company.status = 'inactive';
  company.isDeleted = true;
  await company.save();

  return ApiResponse.success(res, 200, 'Company deactivated successfully');
});

export default {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};
