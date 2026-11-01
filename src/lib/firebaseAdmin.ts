import fs from 'fs';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function normalizePrivateKey(key: string): string {
  return key
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function loadServiceAccount(): any | null {
  const keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyEnv) {
    try {
      let str = keyEnv.trim();

      // Strip outer quotes if wrapped
      if (
        (str.startsWith("'") && str.endsWith("'")) ||
        (str.startsWith('"') && str.endsWith('"'))
      ) {
        str = str.slice(1, -1).trim();
      }

      // Check if it's base64 encoded JSON
      if (!str.startsWith('{') && !str.includes('\n') && str.length > 50) {
        try {
          const decoded = Buffer.from(str, 'base64').toString('utf8').trim();
          if (decoded.startsWith('{')) {
            str = decoded;
          }
        } catch {}
      }

      if (str.startsWith('{')) {
        const parsed = JSON.parse(str);
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = normalizePrivateKey(parsed.private_key);
        }
        return parsed;
      }

      // If it's a file path and under 255 chars, check existence
      if (str.length < 255 && fs.existsSync(str)) {
        const parsed = JSON.parse(fs.readFileSync(str, 'utf8'));
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = normalizePrivateKey(parsed.private_key);
        }
        return parsed;
      }
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Try file path variables
  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (pathEnv && pathEnv.length < 255 && fs.existsSync(pathEnv)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pathEnv, 'utf8'));
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
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
      private_key: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    };
  }

  return null;
}

export function isFirebaseAdminConfigured(): boolean {
  return loadServiceAccount() !== null;
}

// Lazy safe initialization so module loading never crashes Next.js
let _adminApp: App | null = null;
let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

export function getAdminApp(): App {
  if (_adminApp) return _adminApp;
  if (getApps().length > 0) {
    _adminApp = getApp();
    return _adminApp;
  }

  const sa = loadServiceAccount();
  if (sa) {
    try {
      _adminApp = initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      return _adminApp;
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to initialize with cert:', e);
    }
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'leadflow-914f9';

  try {
    _adminApp = initializeApp({ projectId });
  } catch {
    if (getApps().length > 0) {
      _adminApp = getApp();
    }
  }
  return _adminApp!;
}

export function getAdminAuth(): Auth {
  if (!_adminAuth) {
    const app = getAdminApp();
    _adminAuth = getAuth(app);
  }
  return _adminAuth;
}

export function getAdminDb(): Firestore {
  if (!_adminDb) {
    const app = getAdminApp();
    _adminDb = getFirestore(app);
  }
  return _adminDb;
}

/**
 * Creates a safely guarded Proxy that will NEVER intercept bundler inspection,
 * Promise checks (then, catch, finally), JSON serialization, or Symbols.
 */
function createGuardedProxy<T extends object>(getter: () => T): T {
  return new Proxy({} as T, {
    get(target, prop, receiver) {
      if (
        prop === 'then' ||
        prop === 'catch' ||
        prop === 'finally' ||
        prop === 'toJSON' ||
        typeof prop === 'symbol'
      ) {
        return undefined;
      }
      const instance = getter();
      if (!instance) return undefined;
      const val = Reflect.get(instance as any, prop, receiver);
      return typeof val === 'function' ? val.bind(instance) : val;
    },
  });
}

// Proxies that delegate to lazy getters (100% backward compatible without module crash)
export const adminApp: App = createGuardedProxy(getAdminApp);
export const adminAuth: Auth = createGuardedProxy(getAdminAuth);
export const adminDb: Firestore = createGuardedProxy(getAdminDb);
