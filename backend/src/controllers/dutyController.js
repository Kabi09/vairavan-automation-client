import Duty from '../models/Duty.js';
import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import notificationService from '../services/notificationService.js';

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
    customerName,
    customerPhoneNumber,
    machineName,
    workType,
    inTime,
    outTime,
    workDescription,
    customerSignature,
    customerProofPhotos = [],
    latitude,
    longitude,
    accuracy,
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

  const dutyData = {
    employee: req.user._id, // Authenticated user ID (never client-supplied)
    dutyDate,
    company: companyId,
    customerName,
    customerPhoneNumber,
    machineName,
    workType,
    inTime,
    outTime,
    workDescription,
    customerSignature: customerSignature || { url: '', publicId: '' },
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
      capturedAt: new Date(),
    };
  }

  const duty = await Duty.create(dutyData);

  const populatedDuty = await Duty.findById(duty._id)
    .populate('company', 'companyName location companyPhoneNumber')
    .populate('employee', 'employeeName employeeId email designation');

  return ApiResponse.created(res, 'Duty report submitted successfully', {
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

  const { status, workType, startDate, endDate, companyId } = req.query;

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

  const [duties, total] = await Promise.all([
    Duty.find(filter)
      .sort({ dutyDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('company', 'companyName location companyPhoneNumber')
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
    .populate('company', 'companyName location companyPhoneNumber')
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
    inTime,
    outTime,
    workDescription,
    customerSignature,
    customerProofPhotos,
    latitude,
    longitude,
    accuracy,
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
  if (duty.status === 'approved') {
    throw ApiError.badRequest('Approved duty reports cannot be modified');
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

  if (dutyDate) duty.dutyDate = dutyDate;
  if (customerName) duty.customerName = customerName;
  if (customerPhoneNumber) duty.customerPhoneNumber = customerPhoneNumber;
  if (machineName) duty.machineName = machineName;
  if (workType) duty.workType = workType;
  if (inTime) duty.inTime = inTime;
  if (outTime) duty.outTime = outTime;
  if (workDescription) duty.workDescription = workDescription;
  if (customerSignature) duty.customerSignature = customerSignature;
  if (customerProofPhotos) duty.customerProofPhotos = customerProofPhotos;

  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    duty.location = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined && accuracy !== null ? Number(accuracy) : null,
      capturedAt: new Date(),
    };
  }

  // Reset status to submitted if it was correction_requested
  if (duty.status === 'correction_requested') {
    duty.status = 'submitted';
  }

  duty.auditTrail.push({
    changedBy: req.user._id,
    action: 'UPDATED',
    details: 'Duty report updated by employee',
    timestamp: new Date(),
  });

  await duty.save();

  const updatedDuty = await Duty.findById(id)
    .populate('company', 'companyName location companyPhoneNumber')
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

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { customerName: searchRegex },
      { machineName: searchRegex },
      { workDescription: searchRegex },
    ];
  }

  const [duties, total] = await Promise.all([
    Duty.find(filter)
      .sort({ dutyDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employee', 'employeeName employeeId email designation')
      .populate('company', 'companyName location companyPhoneNumber')
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

export default {
  createDuty,
  getMyDuties,
  getDutyById,
  updateDuty,
  getAllDuties,
  updateDutyStatus,
};
