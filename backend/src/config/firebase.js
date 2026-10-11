import admin from 'firebase-admin';
import fs from 'fs';

let firebaseApp = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK if credentials are provided in env.
 * Modular & optional: fails gracefully without interrupting application startup.
 */
export const initializeFirebase = () => {
  if (isInitialized) {
    return firebaseApp;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    let credential = null;

    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        credential = admin.credential.cert(parsed);
      } catch (err) {
        console.warn(`[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
      }
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        credential = admin.credential.cert(fileContent);
      } catch (err) {
        console.warn(`[Firebase] Failed to read FIREBASE_SERVICE_ACCOUNT_PATH: ${err.message}`);
      }
    }

    if (credential) {
      firebaseApp = admin.initializeApp({ credential });
      isInitialized = true;
      console.log('[Firebase] Admin SDK initialized successfully');
    } else {
      console.log('[Firebase] No credentials found. Push notifications will run in mock/no-op mode.');
    }
  } catch (error) {
    console.warn(`[Firebase] Initialization skipped or failed: ${error.message}`);
  }

  return firebaseApp;
};

export const getMessaging = () => {
  if (!isInitialized) {
    initializeFirebase();
  }
  return isInitialized ? admin.messaging() : null;
};

export const isFirebaseConfigured = () => isInitialized;

export default {
  initializeFirebase,
  getMessaging,
  isFirebaseConfigured,
};
