import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

let deferredPrompt = null;
const installListeners = new Set();

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser mini-infobar on mobile
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((listener) => listener(true));
    console.log('[PWA] beforeinstallprompt captured and ready');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => listener(false));
    console.log('[PWA] VairaWorks installed successfully');
  });
}

/**
 * Check if app is running as standalone PWA
 */
export const isStandalonePWA = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
};

/**
 * Hook to manage PWA Installation and Online status
 */
export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt));
  const [isStandalone, setIsStandalone] = useState(isStandalonePWA());
  const [isOnline, setIsOnline] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.onLine
      : true
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleInstallState = (available) => {
      setCanInstall(available);
      setIsStandalone(isStandalonePWA());
    };

    installListeners.add(handleInstallState);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      installListeners.delete(handleInstallState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return { outcome: 'unavailable' };
    }
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        setCanInstall(false);
      }
      return choiceResult;
    } catch (err) {
      console.warn('[PWA] Prompt install error:', err);
      return { outcome: 'error', error: err.message };
    }
  }, []);

  return {
    isWeb: Platform.OS === 'web',
    canInstall,
    isStandalone,
    isOnline,
    promptInstall,
  };
};

export default {
  isStandalonePWA,
  usePWAInstall,
};

