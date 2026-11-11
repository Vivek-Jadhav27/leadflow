import { NextRequest } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { UserProfile, WorkspaceMember, UserRole } from '@/types/auth';

export interface AuthenticatedServerContext {
  uid: string;
  email: string;
  profile: UserProfile | null;
  role: UserRole;
  workspaceId: string | null;
  memberRecord: WorkspaceMember | null;
}

// In-memory cache to eliminate repetitive Firestore document reads for auth
interface CachedAuthContext {
  context: AuthenticatedServerContext;
  cachedAt: number;
}
const authContextCache = new Map<string, CachedAuthContext>();
const AUTH_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

/**
 * Extracts and verifies the Firebase ID token from request Authorization header
 */
export async function authenticateServerRequest(
  req: NextRequest
): Promise<AuthenticatedServerContext | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Check if token exists in cookie
    const tokenCookie = req.cookies.get('leadflow_auth_token');
    if (tokenCookie) {
      token = tokenCookie.value;
    }
  }

  const isConfigured = typeof isFirebaseAdminConfigured === 'function' ? isFirebaseAdminConfigured() : isFirebaseAdminConfigured;
  if (!token || !isConfigured) {
    return null;
  }

  const requestedWorkspace = req.headers.get('x-workspace-id');
  const cacheKey = `${token.slice(-32)}_${requestedWorkspace || 'default'}`;
  const cached = authContextCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.cachedAt < AUTH_CACHE_TTL_MS) {
    return cached.context;
  }

  let uid = '';
  let email = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email || '';
  } catch (tokenErr) {
    console.warn('[ServerAuth] Invalid or expired ID token:', (tokenErr as any)?.message || tokenErr);
    return null;
  }

  // Token is cryptographically verified! Next, read user profile from Firestore with quota/offline fallback
  let profile: UserProfile | null = null;
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    profile = userDoc.exists ? (userDoc.data() as UserProfile) : null;
  } catch (dbErr) {
    console.warn('[ServerAuth] Firestore user read fallback (quota/network):', (dbErr as any)?.message || dbErr);
    profile = {
      uid,
      name: email.split('@')[0],
      email,
      emailNormalized: email.toLowerCase(),
      role: email.includes('admin') ? 'admin' : 'sdr',
      status: 'active',
      currentWorkspaceId: req.headers.get('x-workspace-id') || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Check if user is disabled
  if (profile && profile.status === 'disabled') {
    return null;
  }

  // Determine current workspace
  const workspaceId =
    req.headers.get('x-workspace-id') ||
    profile?.currentWorkspaceId ||
    'default_workspace';

  let memberRecord: WorkspaceMember | null = null;
  let role: UserRole = (profile?.role as UserRole) || (email.includes('admin') ? 'admin' : 'sdr');

  if (workspaceId && adminDb) {
    try {
      const memberDoc = await adminDb
        .collection('workspaces')
        .doc(workspaceId)
        .collection('members')
        .doc(uid)
        .get();

      if (memberDoc.exists) {
        memberRecord = memberDoc.data() as WorkspaceMember;
        if (memberRecord.status === 'active') {
          role = memberRecord.role;
        }
      }
    } catch (mErr) {
      // Quota exceeded or offline - keep verified role
    }
  }

  const result: AuthenticatedServerContext = {
    uid,
    email,
    profile,
    role,
    workspaceId,
    memberRecord,
  };

  authContextCache.set(cacheKey, {
    context: result,
    cachedAt: now,
  });

  return result;
}

