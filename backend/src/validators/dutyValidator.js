import { body, param, query } from 'express-validator';

const WORK_TYPES = ['Electrical', 'Mechanical', 'Installation', 'Maintenance', 'Repair', 'Other'];
const DUTY_STATUSES = ['submitted', 'approved', 'rejected', 'correction_requested'];

export const validateCreateDuty = [
  body('dutyDate')
    .notEmpty()
    .withMessage('Duty date is required')
    .isISO8601()
    .withMessage('Duty date must be a valid date'),
  body('companyId')
    .notEmpty()
    .withMessage('Company ID is required')
    .isMongoId()
    .withMessage('Invalid company ID format'),
  body('customerName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  body('customerPhoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .custom((val) => {
      if (!val) return true;
      if (!/^(?:\+91)?[0-9]{10}$/.test(val)) {
        throw new Error('Customer phone number must be exactly 10 digits');
      }
      return true;
    }),
  body('machineName')
    .trim()
    .notEmpty()
    .withMessage('Machine name is required')
    .isLength({ max: 100 })
    .withMessage('Machine name cannot exceed 100 characters'),
  body('workType')
    .notEmpty()
    .withMessage('Work type is required')
    .isIn(WORK_TYPES)
    .withMessage(`Work type must be one of: ${WORK_TYPES.join(', ')}`),
  body('customWorkType')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Custom work type cannot exceed 200 characters'),
  body('inTime')
    .trim()
    .notEmpty()
    .withMessage('In time is required')
    .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/)
    .withMessage('In time must be in HH:mm 24-hour format (e.g., 09:30 or 14:00)'),
  body('outTime')
    .trim()
    .notEmpty()
    .withMessage('Out time is required')
    .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/)
    .withMessage('Out time must be in HH:mm 24-hour format (e.g., 18:00)'),
  body('workDescription')
    .trim()
    .notEmpty()
    .withMessage('Work description is required')
    .isLength({ max: 2000 })
    .withMessage('Work description cannot exceed 2000 characters'),
  body('customerSignature')
    .optional()
    .isObject()
    .withMessage('Customer signature must be an object with url and publicId'),
  body('customerProofPhotos')
    .optional()
    .isArray()
    .withMessage('Customer proof photos must be an array of photo objects'),
  body('latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid float between -90 and 90'),
  body('longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid float between -180 and 180'),
  body('accuracy')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a non-negative number'),
  body('address')
    .optional({ nullable: true })
    .isString()
    .withMessage('Address must be a string'),
];

export const validateUpdateDuty = [
  param('id')
    .isMongoId()
    .withMessage('Invalid duty ID format'),
  body('dutyDate')
    .optional()
    .isISO8601()
    .withMessage('Duty date must be a valid date'),
  body('companyId')
    .optional()
    .isMongoId()
    .withMessage('Invalid company ID format'),
  body('clientId')
    .optional({ nullable: true })
    .custom((val) => {
      if (!val) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(val)) {
        throw new Error('Invalid client ID format');
      }
      return true;
    }),
  body('dutyType')
    .optional()
    .isIn(['client', 'office'])
    .withMessage('Duty type must be client or office'),
  body('customerName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }),
  body('customerPhoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .custom((val) => {
      if (!val) return true;
      if (!/^(?:\+91)?[0-9]{10}$/.test(val)) {
        throw new Error('Customer phone number must be exactly 10 digits');
      }
      return true;
    }),
  body('machineName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Machine name cannot be empty'),
  body('workType')
    .optional()
    .isIn(WORK_TYPES)
    .withMessage(`Work type must be one of: ${WORK_TYPES.join(', ')}`),
  body('customWorkType')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Custom work type cannot exceed 200 characters'),
  body('inTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/)
    .withMessage('In time must be in HH:mm format'),
  body('outTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):?([0-5]\d)$/)
    .withMessage('Out time must be in HH:mm format'),
  body('workDescription')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Work description cannot be empty'),
  body('address')
    .optional({ nullable: true })
    .isString()
    .withMessage('Address must be a string'),
];

export const validateUpdateDutyStatus = [
  param('id')
    .isMongoId()
    .withMessage('Invalid duty ID format'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(DUTY_STATUSES)
    .withMessage(`Status must be one of: ${DUTY_STATUSES.join(', ')}`),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks cannot exceed 500 characters'),
];

export const validateCheckIn = [
  body('companyId')
    .notEmpty()
    .withMessage('Company ID is required')
    .isMongoId()
    .withMessage('Invalid company ID format'),
  body('dutyDate')
    .optional()
    .isISO8601()
    .withMessage('Duty date must be a valid date'),
  body('dutyType')
    .optional()
    .isIn(['client', 'office'])
    .withMessage('Duty type must be client or office'),
  body('clientId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid client ID format'),
  body('latitude')
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid float between -90 and 90'),
  body('longitude')
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid float between -180 and 180'),
];

export const validateDutyIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid duty ID format'),
];

