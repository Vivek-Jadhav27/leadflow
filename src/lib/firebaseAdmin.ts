import fs from 'fs';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function loadServiceAccount(): any | null {
  // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY (either JSON string or file path)
  const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyEnv) {
    try {
      const trimmed = keyEnv.trim();
      if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed);
      } else if (fs.existsSync(trimmed)) {
        return JSON.parse(fs.readFileSync(trimmed, 'utf8'));
      }
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Try FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (pathEnv && fs.existsSync(pathEnv)) {
    try {
      return JSON.parse(fs.readFileSync(pathEnv, 'utf8'));
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to read service account from path:', e);
    }
  }

  // 3. Try individual environment variables
  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_PROJECT_ID
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

const serviceAccountData = loadServiceAccount();
export const isFirebaseAdminConfigured = serviceAccountData !== null;

// Initialize Firebase Admin singleton
function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  if (serviceAccountData) {
    return initializeApp({
      credential: cert(serviceAccountData),
      projectId: serviceAccountData.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  // Fallback initialization
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'demo-leadflow';
  return initializeApp({
    projectId,
  });
}

const adminApp: App = getFirebaseAdminApp();
const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminDb };
