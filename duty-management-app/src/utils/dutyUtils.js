/**
 * Helper utilities for Duty / Work records
 */

/**
 * Format work type for display across all views, cards, and export files.
 * If workType is 'Other', displays 'Other (Custom Work Data)' if custom data was entered.
 *
 * @param {Object|string} dutyOrWorkType - Duty object or work type string
 * @param {string} [customWorkType] - Optional custom work detail string
 * @param {string} [workDescription] - Optional work description string
 * @returns {string} Formatted work type string
 */
export const formatWorkType = (dutyOrWorkType, customWorkType, workDescription) => {
  let type = '';
  let custom = '';
  let desc = '';

  if (typeof dutyOrWorkType === 'object' && dutyOrWorkType !== null) {
    type = dutyOrWorkType.workType || '';
    custom = dutyOrWorkType.customWorkType || '';
    desc = dutyOrWorkType.workDescription || '';
  } else {
    type = dutyOrWorkType || '';
    custom = customWorkType || '';
    desc = workDescription || '';
  }

  if (type === 'Other' || type.toLowerCase() === 'other') {
    if (custom && custom.trim()) {
      return `Other (${custom.trim()})`;
    }
    // Also check if [Work: ...] is embedded in workDescription
    const match = desc.match(/^\[Work:\s*([^\]]+)\]/);
    if (match && match[1]?.trim()) {
      return `Other (${match[1].trim()})`;
    }
    return 'Other';
  }

  return type || 'N/A';
};

export default {
  formatWorkType,
};
