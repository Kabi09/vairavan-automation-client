import mongoose from 'mongoose';
import Duty from '../models/Duty.js';
import Company from '../models/Company.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

/**
 * Helper to convert Date to HH:mm 24-hour string
 */
export const formatTimeToHHmm = (date = new Date()) => {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Helper to validate time logic (inTime < outTime unless overnight is explicitly permitted)
 */
const validateDutyTimes = (inTime, outTime) => {
  const allowOvernight = process.env.ALLOW_OVERNIGHT_DUTY === 'true';
  if (!allowOvernight && inTime && outTime) {
    const [inHours, inMins] = inTime.split(':').map(Number);
    const [outHours, outMins] = outTime.split(':').map(Number);
    const inTotal = inHours * 60 + inMins;
    const outTotal = outHours * 60 + outMins;

    if (outTotal <= inTotal) {
      throw ApiError.badRequest(
        'Out time must be later than In time for same-day duty visits. Overnight shifts must be enabled by administrator policy.'
      );
    }
  }
};


/**
 * @desc    Submit a new duty report
 * @route   POST /api/duties
 * @access  Private/Employee
 */
export const createDuty = asyncHandler(async (req, res) => {
  const {
    dutyDate,
    companyId,
    clientId,
    dutyType,
    customerName,
    customerPhoneNumber,
    machineName,
    workType,
    customWorkType,
    inTime,
    outTime,
    workDescription,
    features = [],
    manpowerMembers = [],
    customerSignature,
    customerProofPhotos = [],
    latitude,
    longitude,
    accuracy,
    address,
  } = req.body;

  // Validate location requirement policy
  const requireLocation = process.env.REQUIRE_DUTY_LOCATION === 'true';
  if (requireLocation && (latitude === undefined || longitude === undefined || latitude === null || longitude === null)) {
    throw ApiError.badRequest('Service visit GPS coordinates (latitude and longitude) are required by company policy');
  }

  // Validate time range
  validateDutyTimes(inTime, outTime);

  // Validate company existence and active status
  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    throw ApiError.badRequest('Specified company does not exist');
  }
  if (company.status !== 'active') {
    throw ApiError.badRequest('Cannot submit duty report for an inactive company');
  }

  const signatureObj = customerSignature
    ? {
        url: customerSignature.url || '',
        publicId: customerSignature.publicId || '',
        key: customerSignature.key || '',
        signedAt: customerSignature.signedAt ? new Date(customerSignature.signedAt) : new Date(),
      }
    : { url: '', publicId: '', key: '', signedAt: null };

  const isOffice = dutyType === 'office' || company.companyType === 'office';
  const finalCustomerName = isOffice ? 'Office' : (customerName || 'N/A').trim();
  const finalCustomerPhoneNumber = isOffice
    ? (company.companyPhoneNumber || customerPhoneNumber || '')
    : (customerPhoneNumber || '').trim();

  let linkedClient = null;
  if (!isOffice && clientId) {
    linkedClient = await Client.findOne({ _id: clientId, isDeleted: false });
  }

  const sanitizedFeatures = Array.isArray(features)
    ? features.filter((f) => f && String(f).trim()).map((f) => String(f).trim())
    : [];

  const sanitizedManpower = Array.isArray(manpowerMembers)
    ? manpowerMembers
        .filter((m) => m && m.name && m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          phoneNumber: m.phoneNumber ? String(m.phoneNumber).trim() : '',
          description: m.description ? String(m.description).trim() : '',
        }))
    : [];

  const dutyData = {
    employee: req.user._id, // Authenticated user ID (never client-supplied)
    dutyDate,
    dutyType: isOffice ? 'office' : 'client',
    company: companyId,
    client: linkedClient ? linkedClient._id : (clientId || null),
    customerName: finalCustomerName,
    customerPhoneNumber: finalCustomerPhoneNumber,
    machineName,
    workType,
    customWorkType: customWorkType ? customWorkType.trim() : '',
    inTime,
    outTime,
    workDescription,
    features: sanitizedFeatures,
    manpowerMembers: sanitizedManpower,
    customerSignature: signatureObj,
    customerProofPhotos: Array.isArray(customerProofPhotos) ? customerProofPhotos : [],
    status: 'submitted',
    auditTrail: [
      {
        changedBy: req.user._id,
        action: 'CREATED',
        details: 'Duty report submitted by employee',
        timestamp: new Date(),
      },
    ],
  };

  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    dutyData.location = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
      address: address ? String(address).trim() : '',
      capturedAt: new Date(),
    };
  }

  const duty = await Duty.create(dutyData);

  const populatedDuty = await Duty.findById(duty._id)
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId email designation');

  return ApiResponse.created(res, 'Duty report submitted successfully', {
    duty: populatedDuty,
  });
});

/**
 * @desc    Employee Check In (Workflow 1 & 2)
 * @route   POST /api/duties/check-in
 * @access  Private/Employee
 */
export const checkIn = asyncHandler(async (req, res) => {
  const {
    dutyDate,
    dutyType = 'client',
    companyId,
    clientId,
    customerName,
    customerPhoneNumber,
    latitude,
    longitude,
    accuracy,
    address,
  } = req.body;

  // 1. Check for existing active check-in
  const existingActive = await Duty.findOne({
    employee: req.user._id,
    status: 'checked_in',
  })
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status');

  if (existingActive) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active check-in. Please checkout from your current work before checking in again.',
      data: { activeDuty: existingActive },
    });
  }

  // 2. Validate company
  if (!companyId) {
    throw ApiError.badRequest('Please select a company or office');
  }

  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    throw ApiError.badRequest('Specified company does not exist');
  }
  if (company.status !== 'active') {
    throw ApiError.badRequest('Cannot check in to an inactive company');
  }

  const isOffice = dutyType === 'office' || company.companyType === 'office';

  let finalCustomerName = 'Office';
  let finalCustomerPhoneNumber = company.companyPhoneNumber || '';
  let linkedClient = null;

  if (!isOffice) {
    if (clientId) {
      linkedClient = await Client.findOne({ _id: clientId, isDeleted: false });
      if (linkedClient) {
        finalCustomerName = linkedClient.clientName;
        finalCustomerPhoneNumber = linkedClient.clientPhoneNumber || customerPhoneNumber || '';
      }
    }
    if (!linkedClient && customerName) {
      finalCustomerName = customerName.trim();
      finalCustomerPhoneNumber = customerPhoneNumber ? customerPhoneNumber.trim() : '';
    }
  }

  const now = new Date();
  const timeStr = formatTimeToHHmm(now);

  const checkInLocationData = {
    latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
    longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
    accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
    address: address ? String(address).trim() : '',
    capturedAt: now,
  };

  const duty = await Duty.create({
    employee: req.user._id,
    dutyDate: dutyDate ? new Date(dutyDate) : now,
    dutyType: isOffice ? 'office' : 'client',
    company: companyId,
    client: linkedClient ? linkedClient._id : null,
    customerName: finalCustomerName,
    customerPhoneNumber: finalCustomerPhoneNumber,
    checkInTime: now,
    inTime: timeStr,
    checkInLocation: checkInLocationData,
    location: checkInLocationData,
    status: 'checked_in',
    auditTrail: [
      {
        changedBy: req.user._id,
        action: 'CHECKED_IN',
        details: `Checked in at ${isOffice ? 'Office' : finalCustomerName} (${timeStr})`,
        timestamp: now,
      },
    ],
  });

  const populatedDuty = await Duty.findById(duty._id)
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId email designation');

  return ApiResponse.created(res, 'Checked in successfully', {
    duty: populatedDuty,
  });
});

/**
 * @desc    Get active checked-in duty for authenticated employee
 * @route   GET /api/duties/active-checkin
 * @access  Private/Employee
 */
export const getActiveCheckIn = asyncHandler(async (req, res) => {
  const activeDuty = await Duty.findOne({
    employee: req.user._id,
    status: 'checked_in',
  })
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId email designation');

  return ApiResponse.success(res, 200, 'Active check-in status retrieved', {
    activeDuty: activeDuty || null,
  });
});

/**
 * @desc    Employee Check Out / Submit Work Details (Workflow 1 & 2)
 * @route   POST /api/duties/check-out or POST /api/duties/:id/check-out
 * @access  Private/Employee
 */
export const checkOut = asyncHandler(async (req, res) => {
  const targetId = req.params.id || req.body.dutyId;

  let duty;
  if (targetId) {
    duty = await Duty.findById(targetId);
  } else {
    duty = await Duty.findOne({ employee: req.user._id, status: 'checked_in' });
  }

  if (!duty) {
    throw ApiError.notFound('Active check-in duty report not found');
  }

  // Security check: only owner or admin can checkout
  if (duty.employee.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only check out your own duties');
  }

  if (duty.status !== 'checked_in') {
    throw ApiError.badRequest(`Cannot checkout a duty with status '${duty.status}'`);
  }

  const {
    machineName,
    workType,
    customWorkType,
    workDescription,
    features,
    manpowerMembers,
    customerSignature,
    customerProofPhotos,
    latitude,
    longitude,
    accuracy,
    address,
  } = req.body;

  const now = new Date();
  const timeStr = formatTimeToHHmm(now);

  duty.checkOutTime = now;
  duty.outTime = timeStr;

  if (duty.checkInTime) {
    const durationMs = now.getTime() - new Date(duty.checkInTime).getTime();
    duty.totalDurationMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));
  }

  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    duty.checkOutLocation = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
      address: address ? String(address).trim() : '',
      capturedAt: now,
    };
    duty.location = duty.checkOutLocation;
  }

  if (machineName !== undefined) duty.machineName = machineName.trim();
  if (workType !== undefined) duty.workType = workType;
  if (customWorkType !== undefined) duty.customWorkType = customWorkType.trim();
  if (workDescription !== undefined) duty.workDescription = workDescription.trim();

  if (Array.isArray(features)) {
    duty.features = features.filter((f) => f && String(f).trim()).map((f) => String(f).trim());
  }

  if (Array.isArray(manpowerMembers)) {
    duty.manpowerMembers = manpowerMembers
      .filter((m) => m && m.name && m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        phoneNumber: m.phoneNumber ? String(m.phoneNumber).trim() : '',
        description: m.description ? String(m.description).trim() : '',
      }));
  }

  if (customerSignature) {
    duty.customerSignature = {
      url: customerSignature.url || duty.customerSignature?.url || '',
      publicId: customerSignature.publicId || duty.customerSignature?.publicId || '',
      key: customerSignature.key || duty.customerSignature?.key || '',
      signedAt: customerSignature.signedAt ? new Date(customerSignature.signedAt) : now,
    };
  }

  if (Array.isArray(customerProofPhotos)) {
    duty.customerProofPhotos = customerProofPhotos;
  }

  duty.status = 'submitted';

  duty.auditTrail.push({
    changedBy: req.user._id,
    action: 'CHECKED_OUT',
    details: `Checked out at ${timeStr}. Total duration: ${duty.totalDurationMinutes} mins`,
    timestamp: now,
  });

  await duty.save();

  const populatedDuty = await Duty.findById(duty._id)
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId email designation');

  return ApiResponse.success(res, 200, 'Checked out successfully', {
    duty: populatedDuty,
  });
});


/**
 * @desc    Get authenticated employee's own duty reports
 * @route   GET /api/duties/my
 * @access  Private/Employee
 */
export const getMyDuties = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { status, workType, startDate, endDate, companyId, search } = req.query;

  const filter = { employee: req.user._id };

  if (status) filter.status = status;
  if (workType) filter.workType = workType;
  if (companyId) filter.company = companyId;

  if (startDate || endDate) {
    filter.dutyDate = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setUTCHours(0, 0, 0, 0);
      filter.dutyDate.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setUTCHours(23, 59, 59, 999);
      filter.dutyDate.$lte = e;
    }
  }

  if (search && search.trim()) {
    const trimmed = search.trim();
    const searchRegex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const matchingCompanies = await Company.find({
      $or: [
        { companyName: searchRegex },
        { companyPhoneNumber: searchRegex },
        { location: searchRegex },
      ],
    }).select('_id');
    const matchingCompanyIds = matchingCompanies.map((c) => c._id);

    const searchOrConditions = [
      { dutyId: searchRegex },
      { customerName: searchRegex },
      { customerPhoneNumber: searchRegex },
      { machineName: searchRegex },
      { workDescription: searchRegex },
      { workType: searchRegex },
      { 'location.address': searchRegex },
    ];

    if (matchingCompanyIds.length > 0) {
      searchOrConditions.push({ company: { $in: matchingCompanyIds } });
    }

    if (mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
      searchOrConditions.push({ _id: trimmed });
    }

    if (filter.$and) {
      filter.$and.push({ $or: searchOrConditions });
    } else {
      filter.$and = [{ $or: searchOrConditions }];
    }
  }

  const [duties, total] = await Promise.all([
    Duty.find(filter)
      .sort({ dutyDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('company', 'companyName location companyPhoneNumber companyType')
      .populate('client', 'clientName clientPhoneNumber status')
      .populate('adminReview.reviewedBy', 'employeeName employeeId'),
    Duty.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Duty reports retrieved successfully', {
    duties,
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
 * @desc    Get single duty report by ID
 * @route   GET /api/duties/:id
 * @access  Private (Admin or report owner)
 */
export const getDutyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const duty = await Duty.findById(id)
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId email designation')
    .populate('adminReview.reviewedBy', 'employeeName employeeId')
    .populate('auditTrail.changedBy', 'employeeName employeeId');


  if (!duty) {
    throw ApiError.notFound('Duty report not found');
  }

  // Security: check report ownership if not admin
  if (req.user.role !== 'admin' && duty.employee._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You are not authorized to view this duty report');
  }

  return ApiResponse.success(res, 200, 'Duty report retrieved successfully', { duty });
});

/**
 * @desc    Update duty report (Employee can only edit if status is submitted or correction_requested)
 * @route   PUT /api/duties/:id
 * @access  Private/Employee
 */
export const updateDuty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    dutyDate,
    companyId,
    customerName,
    customerPhoneNumber,
    machineName,
    workType,
    customWorkType,
    inTime,
    outTime,
    workDescription,
    features,
    customerSignature,
    customerProofPhotos,
    latitude,
    longitude,
    accuracy,
    address,
  } = req.body;

  const duty = await Duty.findById(id);
  if (!duty) {
    throw ApiError.notFound('Duty report not found');
  }

  // Ownership verification
  if (duty.employee.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only edit your own duty reports');
  }

  // Edit policy check
  if (duty.status === 'approved' && req.user.role !== 'admin') {
    throw ApiError.badRequest('Approved duty reports cannot be modified by employees');
  }
  if (duty.status === 'rejected' && req.user.role !== 'admin') {
    throw ApiError.badRequest('Rejected duty reports cannot be modified by employees');
  }

  // Time validation
  const effectiveInTime = inTime || duty.inTime;
  const effectiveOutTime = outTime || duty.outTime;
  validateDutyTimes(effectiveInTime, effectiveOutTime);

  // If company is being changed, verify it
  if (companyId && companyId !== duty.company.toString()) {
    const company = await Company.findOne({ _id: companyId, isDeleted: false });
    if (!company || company.status !== 'active') {
      throw ApiError.badRequest('Specified company does not exist or is inactive');
    }
    duty.company = companyId;
  }

  const activeCompany = await Company.findById(duty.company);
  const isOffice = activeCompany?.companyType === 'office';
  if (isOffice) {
    duty.customerName = 'Office';
    if (activeCompany?.companyPhoneNumber) {
      duty.customerPhoneNumber = activeCompany.companyPhoneNumber;
    }
  } else {
    if (customerName) duty.customerName = customerName;
    if (customerPhoneNumber) duty.customerPhoneNumber = customerPhoneNumber;
  }
  if (machineName) duty.machineName = machineName;
  if (workType) duty.workType = workType;
  if (customWorkType !== undefined) duty.customWorkType = customWorkType ? customWorkType.trim() : '';
  if (inTime) duty.inTime = inTime;
  if (outTime) duty.outTime = outTime;
  if (workDescription) duty.workDescription = workDescription;
  if (Array.isArray(features)) {
    duty.features = features.filter((f) => f && String(f).trim()).map((f) => String(f).trim());
  }
  if (customerSignature) {
    duty.customerSignature = {
      url: customerSignature.url || duty.customerSignature?.url || '',
      publicId: customerSignature.publicId || duty.customerSignature?.publicId || '',
      key: customerSignature.key || duty.customerSignature?.key || '',
      signedAt: customerSignature.signedAt
        ? new Date(customerSignature.signedAt)
        : duty.customerSignature?.signedAt || new Date(),
    };
  }
  if (customerProofPhotos) duty.customerProofPhotos = customerProofPhotos;

  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    duty.location = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
      address: address !== undefined ? String(address).trim() : (duty.location?.address || ''),
      capturedAt: new Date(),
    };
  } else if (address !== undefined && duty.location) {
    duty.location.address = String(address).trim();
  }

  // Reset status to submitted if it was correction_requested
  if (duty.status === 'correction_requested') {
    duty.status = 'submitted';
  }

  duty.auditTrail.push({
    changedBy: req.user._id,
    action: req.user.role === 'admin' ? 'UPDATED_BY_ADMIN' : 'UPDATED',
    details: `Duty report updated by ${req.user.role}`,
    timestamp: new Date(),
  });

  await duty.save();

  const updatedDuty = await Duty.findById(id)
    .populate('company', 'companyName location companyPhoneNumber companyType')
    .populate('client', 'clientName clientPhoneNumber status')
    .populate('employee', 'employeeName employeeId');

  return ApiResponse.success(res, 200, 'Duty report updated successfully', { duty: updatedDuty });
});

/**
 * @desc    Admin view all duty reports with extensive filtering
 * @route   GET /api/duties
 * @access  Private/Admin
 */
export const getAllDuties = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const { employeeId, companyId, workType, status, startDate, endDate, search } = req.query;

  const filter = {};

  if (employeeId) filter.employee = employeeId;
  if (companyId) filter.company = companyId;
  if (workType) filter.workType = workType;
  if (status) filter.status = status;

  if (startDate || endDate) {
    filter.dutyDate = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setUTCHours(0, 0, 0, 0);
      filter.dutyDate.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setUTCHours(23, 59, 59, 999);
      filter.dutyDate.$lte = e;
    }
  }

  if (search && search.trim()) {
    const trimmed = search.trim();
    const searchRegex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [matchingCompanies, matchingEmployees] = await Promise.all([
      Company.find({
        $or: [
          { companyName: searchRegex },
          { companyPhoneNumber: searchRegex },
          { location: searchRegex },
        ],
      }).select('_id'),
      User.find({
        $or: [
          { employeeName: searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex },
        ],
      }).select('_id'),
    ]);

    const matchingCompanyIds = matchingCompanies.map((c) => c._id);
    const matchingEmployeeIds = matchingEmployees.map((e) => e._id);

    const searchOrConditions = [
      { dutyId: searchRegex },
      { customerName: searchRegex },
      { customerPhoneNumber: searchRegex },
      { machineName: searchRegex },
      { workDescription: searchRegex },
      { workType: searchRegex },
      { 'location.address': searchRegex },
    ];

    if (matchingCompanyIds.length > 0) {
      searchOrConditions.push({ company: { $in: matchingCompanyIds } });
    }
    if (matchingEmployeeIds.length > 0) {
      searchOrConditions.push({ employee: { $in: matchingEmployeeIds } });
    }

    if (mongoose.Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
      searchOrConditions.push({ _id: trimmed });
    }

    if (filter.$and) {
      filter.$and.push({ $or: searchOrConditions });
    } else {
      filter.$and = [{ $or: searchOrConditions }];
    }
  }

  const [duties, total] = await Promise.all([
    Duty.find(filter)
      .sort({ dutyDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeName employeeId email designation')
      .populate('company', 'companyName location companyPhoneNumber companyType')
      .populate('client', 'clientName clientPhoneNumber status')
      .populate('adminReview.reviewedBy', 'employeeName employeeId'),
    Duty.countDocuments(filter),
  ]);

  return ApiResponse.success(res, 200, 'Duty reports retrieved successfully', {
    duties,
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
 * @desc    Review duty report & change status (Admin only)
 * @route   PATCH /api/duties/:id/status
 * @access  Private/Admin
 */
export const updateDutyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const duty = await Duty.findById(id).populate('employee', 'employeeName employeeId');
  if (!duty) {
    throw ApiError.notFound('Duty report not found');
  }

  const prevStatus = duty.status;
  duty.status = status;
  duty.adminReview = {
    reviewedBy: req.user._id,
    remarks: remarks || '',
    reviewedAt: new Date(),
  };

  duty.auditTrail.push({
    changedBy: req.user._id,
    action: `STATUS_CHANGED_${status.toUpperCase()}`,
    details: `Status changed from '${prevStatus}' to '${status}'. Remarks: ${remarks || 'None'}`,
    timestamp: new Date(),
  });

  await duty.save();

  // Trigger optional push notification to the employee
  if (duty.employee) {
    const notificationPayload = {
      title: `Duty Report ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Correction Requested'}`,
      body: `Your duty report for ${new Date(duty.dutyDate).toLocaleDateString()} has been ${status}. ${remarks ? `Remarks: ${remarks}` : ''}`,
    };
    notificationService.sendNotificationToUser(duty.employee._id, notificationPayload, {
      dutyId: duty._id.toString(),
      status,
    }).catch((err) => console.error('[FCM] Notification error on duty review:', err.message));
  }

  return ApiResponse.success(res, 200, `Duty report marked as '${status}' successfully`, {
    duty,
  });
});

/**
 * @desc    Delete duty report (Admin only)
 * @route   DELETE /api/duties/:id
 * @access  Private/Admin
 */
export const deleteDuty = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const duty = await Duty.findById(id);
  if (!duty) {
    throw ApiError.notFound('Duty report not found');
  }

  await Duty.findByIdAndDelete(id);

  return ApiResponse.success(res, 200, 'Duty report deleted successfully', {
    deletedDutyId: id,
  });
});

export default {
  createDuty,
  checkIn,
  getActiveCheckIn,
  checkOut,
  getMyDuties,
  getDutyById,
  updateDuty,
  getAllDuties,
  updateDutyStatus,
  deleteDuty,
};

