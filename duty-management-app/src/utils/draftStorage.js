import AsyncStorage from '@react-native-async-storage/async-storage';

const WORK_DRAFT_KEY = '@vairaworks_work_draft_v1';
const EXPENSE_DRAFT_KEY = '@vairaworks_expense_draft_v1';

/**
 * Save draft work report data to local AsyncStorage
 * @param {Object} data 
 */
export const saveWorkDraft = async (data) => {
  try {
    if (!data) return;
    await AsyncStorage.setItem(WORK_DRAFT_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[DraftStorage] Failed to save work draft:', err);
  }
};

/**
 * Retrieve saved draft work report data
 * @returns {Promise<Object|null>}
 */
export const getWorkDraft = async () => {
  try {
    const raw = await AsyncStorage.getItem(WORK_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[DraftStorage] Failed to retrieve work draft:', err);
    return null;
  }
};

/**
 * Clear saved work report draft
 */
export const clearWorkDraft = async () => {
  try {
    await AsyncStorage.removeItem(WORK_DRAFT_KEY);
  } catch (err) {
    console.warn('[DraftStorage] Failed to clear work draft:', err);
  }
};

/**
 * Save draft expense claim data to local AsyncStorage
 * @param {Object} data 
 */
export const saveExpenseDraft = async (data) => {
  try {
    if (!data) return;
    await AsyncStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[DraftStorage] Failed to save expense draft:', err);
  }
};

/**
 * Retrieve saved draft expense claim data
 * @returns {Promise<Object|null>}
 */
export const getExpenseDraft = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXPENSE_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[DraftStorage] Failed to retrieve expense draft:', err);
    return null;
  }
};

/**
 * Clear saved expense claim draft
 */
export const clearExpenseDraft = async () => {
  try {
    await AsyncStorage.removeItem(EXPENSE_DRAFT_KEY);
  } catch (err) {
    console.warn('[DraftStorage] Failed to clear expense draft:', err);
  }
};

export default {
  saveWorkDraft,
  getWorkDraft,
  clearWorkDraft,
  saveExpenseDraft,
  getExpenseDraft,
  clearExpenseDraft,
};
