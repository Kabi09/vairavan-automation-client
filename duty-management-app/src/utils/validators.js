/**
 * Form and input validation helper functions
 */

export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email.trim());
};

export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const digitsOnly = phone.trim().replace(/\D/g, '');
  return digitsOnly.length === 10;
};

export const isValidTimeFormat = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const regex = /^([01]\d|2[0-3]):?([0-5]\d)$/;
  return regex.test(timeStr.trim());
};

export const isTimeOrderValid = (inTime, outTime) => {
  if (!isValidTimeFormat(inTime) || !isValidTimeFormat(outTime)) return false;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  return outMinutes > inMinutes;
};

export const isDateRangeValid = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return end >= start;
};

export const isNonEmptyString = (str) => {
  return typeof str === 'string' && str.trim().length > 0;
};

/**
 * Developer Admin Identification Constants
 */
export const DEV_ADMIN_EMAILS = [
  'mailtokabilan056@gmail.com',
  'mailtokabilan@gmail.com',
  'admin@gmail.com',
];
export const DEV_ADMIN_EMAIL = 'mailtokabilan056@gmail.com';
export const DEV_ADMIN_PHONE = '8883280816';

/**
 * Checks if a given user object represents the Developer Admin.
 * Used across the frontend to exclude the Developer Admin from normal Admin
 * user lists, dropdowns, and user-selection options while keeping normal Admins visible.
 *
 * @param {Object} user - User/employee data object
 * @returns {boolean} True if the user matches Developer Admin identifiers
 */
export const isDeveloperAdmin = (user) => {
  if (!user || typeof user !== 'object') return false;

  const email = (user.email || '').toLowerCase().trim();
  const rawPhone = user.phoneNumber || user.phone || '';
  const digitsOnly = String(rawPhone).replace(/\D/g, '');

  const matchesEmail =
    DEV_ADMIN_EMAILS.includes(email) ||
    email.startsWith('mailtokabilan');

  const matchesPhone =
    digitsOnly === DEV_ADMIN_PHONE ||
    digitsOnly.endsWith(DEV_ADMIN_PHONE);

  return Boolean(
    (matchesEmail || matchesPhone) &&
    (user.role === 'admin' || !user.role || user.role === 'developer')
  );
};

export default {
  isValidEmail,
  isValidPhone,
  isValidTimeFormat,
  isTimeOrderValid,
  isDateRangeValid,
  isNonEmptyString,
  isDeveloperAdmin,
  DEV_ADMIN_EMAIL,
  DEV_ADMIN_PHONE,
};
