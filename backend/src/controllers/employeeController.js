import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Create new employee account
 * @route   POST /api/employees
 * @access  Private/Admin
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const {
    employeeName,
    employeeId,
    email,
    password,
    phoneNumber,
    address,
    designation,
    joiningDate,
    dateOfBirth,
    role = 'employee',
    accountStatus = 'active',
  } = req.body;

  // Check duplicate email
  const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingEmail) {
    throw ApiError.conflict('An employee with this email already exists');
  }

  // Check duplicate phone number
  if (phoneNumber && phoneNumber.trim()) {
    const rawPhone = phoneNumber.trim();
    const cleanPhone = rawPhone.replace(/[\s-]/g, '').replace(/^\+91/, '').slice(-10);
    const phoneFilter = cleanPhone.length === 10
      ? {
          $or: [
            { phoneNumber: cleanPhone },
            { phoneNumber: `+91${cleanPhone}` },
            { phoneNumber: `+91 ${cleanPhone}` },
            { phoneNumber: rawPhone },
          ],
        }
      : { phoneNumber: rawPhone };

    const existingPhone = await User.findOne(phoneFilter);
    if (existingPhone) {
      throw ApiError.conflict('An employee with this phone number already exists');
    }
  }

  // Check duplicate employee ID
  const existingId = await User.findOne({ employeeId: employeeId.toUpperCase().trim() });
  if (existingId) {
    throw ApiError.conflict('An employee with this Employee ID already exists');
  }

  const employee = await User.create({
    employeeName,
    employeeId: employeeId.toUpperCase().trim(),
    email: email.toLowerCase().trim(),
    password,
    phoneNumber: phoneNumber ? phoneNumber.trim() : '',
    address: req.body.location !== undefined ? req.body.location : (address || ''),
    location: req.body.location !== undefined ? req.body.location : (address || ''),
    designation,
    joiningDate: joiningDate ? new Date(joiningDate) : Date.now(),
    dateOfBirth: dateOfBirth || null,
    role: role === 'admin' ? 'admin' : 'employee',
    accountStatus,
    createdBy: req.user._id,
  });

  return ApiResponse.created(res, 'Employee account created successfully', {
    employee: employee.toJSON(),
  });
});

/**
 * @desc    Get all employees with pagination, search, and status filter
 * @route   GET /api/employees
 * @access  Private/Admin
 */
export const getEmployees = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const skip = (page - 1) * limit;

  const { search, status, role } = req.query;

  const filter = {
    email: { $nin: ['admin@gmail.com', 'mailtokabilan056@gmail.com'] },
    employeeId: { $ne: 'DEV001', $not: /^DEV/i },
    employeeName: { $ne: 'Developer Admin' },
    role: { $ne: 'admin' },
  };

  if (status) {
    filter.accountStatus = status;
  }

  if (role) {
    filter.role = role;
  }

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { employeeName: searchRegex },
      { employeeId: searchRegex },
      { email: searchRegex },
      { designation: searchRegex },
      { phoneNumber: searchRegex },
    ];
  }

  const [employees, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Employees retrieved successfully', {
    employees,
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
 * @desc    Get single employee details by ID
 * @route   GET /api/employees/:id
 * @access  Private (Admin or self)
 */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Authorization check: non-admin can only access own profile
  if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
    throw ApiError.forbidden('You are only authorized to access your own employee profile');
  }

  const employee = await User.findById(id);
  if (!employee || employee.email === 'admin@gmail.com') {
    throw ApiError.notFound('Employee not found');
  }

  return ApiResponse.success(res, 200, 'Employee details retrieved successfully', {
    employee,
  });
});

/**
 * @desc    Update employee profile details
 * @route   PUT /api/employees/:id
 * @access  Private/Admin
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    employeeName,
    email,
    phoneNumber,
    address,
    designation,
    joiningDate,
    dateOfBirth,
    role,
  } = req.body;

  const employee = await User.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  if (employeeName) employee.employeeName = employeeName;

  // Check duplicate email if changed
  if (email && email.trim()) {
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== employee.email) {
      const existingEmail = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });
      if (existingEmail) {
        throw ApiError.conflict('An employee with this email already exists');
      }
      employee.email = normalizedEmail;
    }
  }

  // Check duplicate phone number if changed
  if (phoneNumber !== undefined) {
    const rawPhone = phoneNumber.trim();
    if (rawPhone && rawPhone !== (employee.phoneNumber || '').trim()) {
      const cleanPhone = rawPhone.replace(/[\s-]/g, '').replace(/^\+91/, '').slice(-10);
      const phoneFilter = cleanPhone.length === 10
        ? {
            _id: { $ne: id },
            $or: [
              { phoneNumber: cleanPhone },
              { phoneNumber: `+91${cleanPhone}` },
              { phoneNumber: `+91 ${cleanPhone}` },
              { phoneNumber: rawPhone },
            ],
          }
        : { _id: { $ne: id }, phoneNumber: rawPhone };

      const existingPhone = await User.findOne(phoneFilter);
      if (existingPhone) {
        throw ApiError.conflict('An employee with this phone number already exists');
      }
      employee.phoneNumber = rawPhone;
    } else if (!rawPhone) {
      employee.phoneNumber = '';
    }
  }

  const locVal = req.body.location !== undefined ? req.body.location : address;
  if (locVal !== undefined) {
    employee.address = locVal;
    employee.location = locVal;
  }
  if (designation !== undefined) employee.designation = designation;
  if (joiningDate !== undefined) { employee.joiningDate = joiningDate ? new Date(joiningDate) : employee.joiningDate; }
  if (dateOfBirth !== undefined) employee.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (role && ['admin', 'employee', 'staff'].includes(role)) {
    employee.role = role === 'admin' ? 'admin' : 'employee';
  }

  await employee.save();

  return ApiResponse.success(res, 200, 'Employee updated successfully', {
    employee,
  });
});

/**
 * @desc    Update employee account status (active/inactive)
 * @route   PATCH /api/employees/:id/status
 * @access  Private/Admin
 */
export const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { accountStatus } = req.body;

  const employee = await User.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  // Safety check: protect against deactivating the last active Admin
  if (employee.role === 'admin' && accountStatus === 'inactive') {
    const activeAdminCount = await User.countDocuments({
      role: 'admin',
      accountStatus: 'active',
    });

    if (activeAdminCount <= 1 && employee.accountStatus === 'active') {
      throw ApiError.badRequest(
        'Cannot deactivate this account. At least one active Administrator must remain in the system.'
      );
    }
  }

  employee.accountStatus = accountStatus;
  await employee.save();

  return ApiResponse.success(res, 200, `Employee account ${accountStatus} successfully`, {
    employee,
  });
});

/**
 * @desc    Admin reset employee password
 * @route   PATCH /api/employees/:id/password
 * @access  Private/Admin
 */
export const resetEmployeePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const employee = await User.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  employee.password = newPassword;
  // Invalidate any active refresh tokens
  employee.refreshTokens = [];
  await employee.save();

  return ApiResponse.success(res, 200, 'Employee password has been reset successfully');
});

export default {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  resetEmployeePassword,
};
