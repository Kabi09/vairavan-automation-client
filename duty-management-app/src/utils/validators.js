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
  const regex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;
  return regex.test(phone.trim());
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

export default {
  isValidEmail,
  isValidPhone,
  isValidTimeFormat,
  isTimeOrderValid,
  isDateRangeValid,
  isNonEmptyString,
};
