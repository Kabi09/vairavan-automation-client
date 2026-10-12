import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import defaultServiceAccount from './firebaseServiceAccount.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK if credentials are provided in env or secret file.
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

    // 1. Try parsing JSON string from env
    if (serviceAccountJson && typeof serviceAccountJson === 'string' && serviceAccountJson.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        credential = admin.credential.cert(parsed);
      } catch (err) {
        console.warn(`[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err.message}`);
      }
    }

    // 2. If not initialized via JSON, check path or standard file locations
    if (!credential) {
      const candidatePaths = [
        serviceAccountPath,
        serviceAccountPath ? path.resolve(process.cwd(), serviceAccountPath) : null,
        path.resolve(__dirname, '../../secrets/firebase-service-account.json'),
        path.resolve(process.cwd(), 'secrets/firebase-service-account.json'),
        path.resolve(process.cwd(), 'backend/secrets/firebase-service-account.json'),
      ].filter(Boolean);

      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
          try {
            const fileContent = JSON.parse(fs.readFileSync(candidate, 'utf8'));
            if (fileContent.project_id && fileContent.private_key) {
              credential = admin.credential.cert(fileContent);
              console.log(`[Firebase] Loaded service account credentials from: ${candidate}`);
              break;
            }
          } catch (err) {
            console.warn(`[Firebase] Could not load candidate ${candidate}: ${err.message}`);
          }
        }
      }
    }

    // 3. Bundled configuration fallback (guarantees operation in Vercel serverless environment)
    if (!credential && defaultServiceAccount?.project_id && defaultServiceAccount?.private_key) {
      try {
        credential = admin.credential.cert(defaultServiceAccount);
        console.log('[Firebase] Loaded service account credentials from bundled configuration');
      } catch (err) {
        console.warn(`[Firebase] Failed to load bundled configuration: ${err.message}`);
      }
    }

    if (credential) {
      firebaseApp = admin.initializeApp({ credential });
      isInitialized = true;
      console.log('[Firebase] Admin SDK initialized successfully');
    } else {
      console.log('[Firebase] No valid credentials found. Push notifications will run in mock/no-op mode.');
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
