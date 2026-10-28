import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { appStorage } from '../utils/appStorage';

const DataContext = createContext(null);

// Default Time-To-Live in milliseconds
export const CACHE_TTL = {
  DASHBOARD: 60 * 1000, // 1 minute
  LISTS: 2 * 60 * 1000, // 2 minutes
  CATALOGS: 5 * 60 * 1000, // 5 minutes (companies, employees, categories)
  BALANCES: 2 * 60 * 1000, // 2 minutes
  REPORTS: 2 * 60 * 1000,
};

export const DataProvider = ({ children }) => {
  // In-memory cache store: { [key]: { data, timestamp, isStale, error } }
  const cacheRef = useRef({});
  // Listeners for reactive updates: { [key]: Set<callback> }
  const listenersRef = useRef({});
  const [, setVersion] = useState(0);

  // Online / Offline tracking
  const [isOffline, setIsOffline] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? !navigator.onLine
      : false
  );

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setIsOffline(false);
        // Automatically revalidate stale caches upon reconnecting
        invalidateAll(true);
      };
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  /**
   * Subscribe to cache changes for a specific key
   */
  const subscribe = useCallback((key, callback) => {
    if (!listenersRef.current[key]) {
      listenersRef.current[key] = new Set();
    }
    listenersRef.current[key].add(callback);

    return () => {
      if (listenersRef.current[key]) {
        listenersRef.current[key].delete(callback);
      }
    };
  }, []);

  /**
   * Notify all listeners registered for key
   */
  const notifyListeners = useCallback((key, entry) => {
    const keyListeners = listenersRef.current[key];
    if (keyListeners && keyListeners.size > 0) {
      keyListeners.forEach((fn) => {
        try {
          fn(entry?.data, entry);
        } catch (err) {
          console.warn(`[DataContext] Listener error for ${key}:`, err);
        }
      });
    }
    // Bump version for hooks listening to general updates
    setVersion((v) => v + 1);
  }, []);

  /**
   * Read raw cache entry
   */
  const getCacheEntry = useCallback((key) => {
    return cacheRef.current[key] || null;
  }, []);

  /**
   * Set cache entry directly with optional TTL
   */
  const setCache = useCallback((key, data, ttl = CACHE_TTL.LISTS) => {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      isStale: false,
      error: null,
    };
    cacheRef.current[key] = entry;
    notifyListeners(key, entry);
    return entry;
  }, [notifyListeners]);

  /**
   * Mark one or more cache keys as stale (or purge completely)
   */
  const invalidateKeys = useCallback((keyOrPrefixes, purge = false) => {
    const targets = Array.isArray(keyOrPrefixes) ? keyOrPrefixes : [keyOrPrefixes];

    Object.keys(cacheRef.current).forEach((cacheKey) => {
      const matches = targets.some((target) => {
        if (target.endsWith('*')) {
          const prefix = target.slice(0, -1);
          return cacheKey.startsWith(prefix);
        }
        return cacheKey === target;
      });

      if (matches) {
        if (purge) {
          delete cacheRef.current[cacheKey];
          notifyListeners(cacheKey, null);
        } else if (cacheRef.current[cacheKey]) {
          cacheRef.current[cacheKey].isStale = true;
          notifyListeners(cacheKey, cacheRef.current[cacheKey]);
        }
      }
    });
  }, [notifyListeners]);

  /**
   * Invalidate all cached data
   */
  const invalidateAll = useCallback((markStaleOnly = true) => {
    Object.keys(cacheRef.current).forEach((key) => {
      if (markStaleOnly && cacheRef.current[key]) {
        cacheRef.current[key].isStale = true;
      } else {
        delete cacheRef.current[key];
      }
      notifyListeners(key, cacheRef.current[key]);
    });
  }, [notifyListeners]);

  /**
   * Smart Fetch with Cache & Stale-While-Revalidate (SWR)
   */
  const fetchWithCache = useCallback(
    async (key, apiFetcher, options = {}) => {
      const {
        forceRefresh = false,
        ttl = CACHE_TTL.LISTS,
        staleWhileRevalidate = true,
      } = options;

      const existing = cacheRef.current[key];
      const now = Date.now();
      const isExpired = existing ? now - existing.timestamp > (existing.ttl || ttl) : true;
      const isValid = existing && !existing.isStale && !isExpired;

      // 1. If valid cached data exists and not forced, return immediately (zero API call!)
      if (isValid && !forceRefresh) {
        return existing.data;
      }

      // 2. If stale or expired data exists and SWR enabled: return cached data immediately to UI
      // and perform background revalidation!
      if (existing && existing.data && staleWhileRevalidate && !forceRefresh) {
        // Trigger background revalidation asynchronously
        (async () => {
          try {
            const freshRes = await apiFetcher();
            const freshData = freshRes?.data !== undefined ? freshRes.data : freshRes;
            setCache(key, freshData, ttl);
          } catch (bgErr) {
            console.warn(`[DataContext] Background revalidate failed for ${key}:`, bgErr.message);
          }
        })();
        return existing.data;
      }

      // 3. No cache or forceRefresh requested: fetch fresh data from API
      try {
        const res = await apiFetcher();
        const data = res?.data !== undefined ? res.data : res;
        setCache(key, data, ttl);
        return data;
      } catch (err) {
        // If network failed but we have stale cache, fall back to it gracefully
        if (existing && existing.data) {
          console.warn(`[DataContext] API error for ${key}, falling back to cached snapshot:`, err.message);
          return existing.data;
        }
        throw err;
      }
    },
    [setCache]
  );

  /**
   * Helper: Update an item inside a cached array or object
   */
  const updateListItem = useCallback(
    (keyPrefix, idOrMatcher, updater) => {
      Object.keys(cacheRef.current).forEach((cacheKey) => {
        if (cacheKey.startsWith(keyPrefix)) {
          const entry = cacheRef.current[cacheKey];
          if (!entry || !entry.data) return;

          let updated = false;
          let newData = entry.data;

          if (Array.isArray(entry.data)) {
            newData = entry.data.map((item) => {
              const matches =
                typeof idOrMatcher === 'function'
                  ? idOrMatcher(item)
                  : (item._id && item._id === idOrMatcher) ||
                    (item.dutyId && item.dutyId === idOrMatcher) ||
                    (item.expenseId && item.expenseId === idOrMatcher) ||
                    (item.id && item.id === idOrMatcher);

              if (matches) {
                updated = true;
                return typeof updater === 'function' ? updater(item) : { ...item, ...updater };
              }
              return item;
            });
          } else if (typeof entry.data === 'object') {
            // Nested arrays (e.g. { duties: [...] } or { expenses: [...] })
            Object.keys(entry.data).forEach((subKey) => {
              if (Array.isArray(entry.data[subKey])) {
                entry.data[subKey] = entry.data[subKey].map((item) => {
                  const matches =
                    typeof idOrMatcher === 'function'
                      ? idOrMatcher(item)
                      : (item._id && item._id === idOrMatcher) ||
                        (item.dutyId && item.dutyId === idOrMatcher) ||
                        (item.expenseId && item.expenseId === idOrMatcher) ||
                        (item.id && item.id === idOrMatcher);
                  if (matches) {
                    updated = true;
                    return typeof updater === 'function' ? updater(item) : { ...item, ...updater };
                  }
                  return item;
                });
              }
            });
            newData = { ...entry.data };
          }

          if (updated) {
            entry.data = newData;
            notifyListeners(cacheKey, entry);
          }
        }
      });
    },
    [notifyListeners]
  );

  /**
   * Helper: Prepend a new item to a cached array
   */
  const prependListItem = useCallback(
    (keyPrefix, newItem) => {
      Object.keys(cacheRef.current).forEach((cacheKey) => {
        if (cacheKey.startsWith(keyPrefix)) {
          const entry = cacheRef.current[cacheKey];
          if (!entry || !entry.data) return;

          if (Array.isArray(entry.data)) {
            entry.data = [newItem, ...entry.data.filter((x) => x._id !== newItem._id)];
            notifyListeners(cacheKey, entry);
          } else if (typeof entry.data === 'object') {
            Object.keys(entry.data).forEach((subKey) => {
              if (Array.isArray(entry.data[subKey])) {
                entry.data[subKey] = [newItem, ...entry.data[subKey].filter((x) => x._id !== newItem._id)];
              }
            });
            notifyListeners(cacheKey, entry);
          }
        }
      });
    },
    [notifyListeners]
  );

  /**
   * Helper: Remove an item from a cached array
   */
  const removeListItem = useCallback(
    (keyPrefix, idOrMatcher) => {
      Object.keys(cacheRef.current).forEach((cacheKey) => {
        if (cacheKey.startsWith(keyPrefix)) {
          const entry = cacheRef.current[cacheKey];
          if (!entry || !entry.data) return;

          if (Array.isArray(entry.data)) {
            entry.data = entry.data.filter((item) => {
              return typeof idOrMatcher === 'function'
                ? !idOrMatcher(item)
                : item._id !== idOrMatcher && item.id !== idOrMatcher;
            });
            notifyListeners(cacheKey, entry);
          } else if (typeof entry.data === 'object') {
            Object.keys(entry.data).forEach((subKey) => {
              if (Array.isArray(entry.data[subKey])) {
                entry.data[subKey] = entry.data[subKey].filter((item) => {
                  return typeof idOrMatcher === 'function'
                    ? !idOrMatcher(item)
                    : item._id !== idOrMatcher && item.id !== idOrMatcher;
                });
              }
            });
            notifyListeners(cacheKey, entry);
          }
        }
      });
    },
    [notifyListeners]
  );

  // ==========================================
  // High-Level Domain Synchronizers
  // ==========================================

  /**
   * Sync Duty: updates duty lists, invalidates dashboards and reports instantly
   */
  const syncDuty = useCallback(
    (duty, action = 'update') => {
      if (!duty) return;
      const dutyId = duty._id || duty.dutyId;

      if (action === 'create') {
        prependListItem('duties', duty);
        prependListItem('my_duties', duty);
      } else if (action === 'delete') {
        removeListItem('duties', dutyId);
        removeListItem('my_duties', dutyId);
      } else {
        updateListItem('duties', dutyId, duty);
        updateListItem('my_duties', dutyId, duty);
      }

      // Invalidate dashboards and reports
      invalidateKeys(['admin_dashboard', 'employee_dashboard', 'all_in_one_report*']);
    },
    [prependListItem, removeListItem, updateListItem, invalidateKeys]
  );

  /**
   * Sync Expense: updates expenses, invalidates dashboards and duties
   */
  const syncExpense = useCallback(
    (expense, action = 'update') => {
      if (!expense) return;
      const expId = expense._id || expense.expenseId;

      if (action === 'create') {
        prependListItem('admin_expenses', expense);
        prependListItem('my_expenses', expense);
      } else if (action === 'delete') {
        removeListItem('admin_expenses', expId);
        removeListItem('my_expenses', expId);
      } else {
        updateListItem('admin_expenses', expId, expense);
        updateListItem('my_expenses', expId, expense);
      }

      invalidateKeys(['admin_dashboard', 'employee_dashboard', 'duties*', 'all_in_one_report*']);
    },
    [prependListItem, removeListItem, updateListItem, invalidateKeys]
  );

  /**
   * Sync Leave: updates leaves, invalidates balances and calendar
   */
  const syncLeave = useCallback(
    (leave, action = 'update') => {
      if (!leave) return;
      const leaveId = leave._id;

      if (action === 'create') {
        prependListItem('leaves', leave);
        prependListItem('my_leaves', leave);
      } else if (action === 'delete') {
        removeListItem('leaves', leaveId);
        removeListItem('my_leaves', leaveId);
      } else {
        updateListItem('leaves', leaveId, leave);
        updateListItem('my_leaves', leaveId, leave);
      }

      invalidateKeys(['leave_balances*', 'admin_dashboard', 'employee_dashboard', 'all_in_one_report*']);
    },
    [prependListItem, removeListItem, updateListItem, invalidateKeys]
  );

  /**
   * Sync Company / Client change
   */
  const syncCompany = useCallback(() => {
    invalidateKeys(['companies', 'clients*', 'admin_dashboard', 'all_in_one_report*']);
  }, [invalidateKeys]);

  /**
   * Sync Employee change
   */
  const syncEmployee = useCallback(() => {
    invalidateKeys(['employees', 'admin_dashboard', 'all_in_one_report*']);
  }, [invalidateKeys]);

  /**
   * Sync Document change
   */
  const syncDocument = useCallback(
    (doc, action = 'update') => {
      if (action === 'create') {
        prependListItem('shared_documents', doc);
      } else if (action === 'delete') {
        removeListItem('shared_documents', doc?._id || doc);
      } else {
        invalidateKeys(['shared_documents']);
      }
    },
    [prependListItem, removeListItem, invalidateKeys]
  );

  const value = {
    isOffline,
    getCacheEntry,
    setCache,
    invalidateKeys,
    invalidateAll,
    fetchWithCache,
    subscribe,
    updateListItem,
    prependListItem,
    removeListItem,
    syncDuty,
    syncExpense,
    syncLeave,
    syncCompany,
    syncEmployee,
    syncDocument,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

/**
 * Hook to access DataContext
 */
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

/**
 * Convenient React Hook to fetch and synchronize cached queries
 */
export const useCachedQuery = (key, fetcherFn, options = {}) => {
  const { fetchWithCache, getCacheEntry, subscribe, isOffline } = useData();
  const [data, setData] = useState(() => getCacheEntry(key)?.data || null);
  const [loading, setLoading] = useState(() => !getCacheEntry(key)?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Subscribe to changes for this cache key
  useEffect(() => {
    return subscribe(key, (updatedData) => {
      if (updatedData !== undefined) {
        setData(updatedData);
      }
    });
  }, [key, subscribe]);

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (!data) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchWithCache(key, fetcherFn, {
          forceRefresh: isManualRefresh,
          ...options,
        });
        setData(result);
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key, fetcherFn, fetchWithCache, data, options]
  );

  // Initial load
  useEffect(() => {
    loadData();
  }, [key]);

  return {
    data,
    loading,
    refreshing,
    error,
    isOffline,
    refetch: (force = true) => loadData(force),
  };
};

export default DataContext;

