import fs from 'fs';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export function loadServiceAccount(): any | null {
  // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or file path)
  const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyEnv) {
    try {
      let trimmed = keyEnv.trim();

      // Strip outer single or double quotes if present from .env / Vercel UI
      if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        trimmed = trimmed.slice(1, -1).trim();
      }

      // Check if base64 encoded
      if (!trimmed.startsWith('{') && !fs.existsSync(trimmed)) {
        try {
          const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
          if (decoded.trim().startsWith('{')) {
            trimmed = decoded.trim();
          }
        } catch {}
      }

      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      } else if (fs.existsSync(trimmed)) {
        const fileContent = fs.readFileSync(trimmed, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return parsed;
      }
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Try FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (pathEnv && fs.existsSync(pathEnv)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pathEnv, 'utf8'));
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to read service account from path:', e);
    }
  }

  // 3. Try individual environment variables
  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

const serviceAccountData = loadServiceAccount();
export const isFirebaseAdminConfigured = serviceAccountData !== null;

// Initialize Firebase Admin singleton safely
function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const sa = serviceAccountData || loadServiceAccount();
  if (sa) {
    try {
      return initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to initialize with cert:', e);
    }
  }

  // Fallback initialization
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'leadflow-914f9';

  return initializeApp({
    projectId,
  });
}

const adminApp: App = getFirebaseAdminApp();
const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminDb };
