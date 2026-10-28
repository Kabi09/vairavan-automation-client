/**
 * Central utility to identify developer and system admin accounts
 * that should be excluded from field employee lists, staff metrics,
 * and operational reports.
 */
export const isDeveloperAdmin = (user) => {
  if (!user || typeof user !== 'object') return false;

  const email = String(user.email || '').toLowerCase().trim();
  const phone = String(user.phoneNumber || user.phone || '').replace(/\D/g, '');
  const empId = String(user.employeeId || '').toUpperCase().trim();
  const name = String(user.employeeName || '').toLowerCase().trim();
  const role = String(user.role || '').toLowerCase().trim();

  return Boolean(
    empId === 'DEV001' ||
    empId.startsWith('DEV') ||
    email === 'mailtokabilan056@gmail.com' ||
    email === 'admin@gmail.com' ||
    email.startsWith('mailtokabilan') ||
    phone === '8883280816' ||
    phone.endsWith('8883280816') ||
    name.includes('developer admin') ||
    name === 'developer' ||
    role === 'developer'
  );
};

export default {
  isDeveloperAdmin,
};

