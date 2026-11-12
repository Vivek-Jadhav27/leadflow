import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { UserProfile, WorkspaceMember, UserRole } from '@/types/auth';

export interface AuthenticatedServerContext {
  uid: string;
  email: string;
  profile: UserProfile | null;
  /** Role from the caller's ACTIVE membership; 'sdr' when the caller has no active workspace. */
  role: UserRole;
  /** Set only when the caller is an active member of an active workspace. */
  workspaceId: string | null;
  memberRecord: WorkspaceMember | null;
}

// Short-lived cache to avoid 3 Firestore/Auth round trips per request. Kept short so that
// suspensions/removals take effect quickly; also explicitly invalidated by member-management routes.
interface CachedAuthContext {
  context: AuthenticatedServerContext;
  cachedAt: number;
}
const authContextCache = new Map<string, CachedAuthContext>();
const AUTH_CACHE_TTL_MS = 30 * 1000;
const AUTH_CACHE_MAX_ENTRIES = 1000;

/** Drops cached auth contexts for a user (call after changing membership/profile). */
export function invalidateAuthCache(uid?: string): void {
  if (!uid) {
    authContextCache.clear();
    return;
  }
  for (const [key, entry] of authContextCache) {
    if (entry.context.uid === uid) authContextCache.delete(key);
  }
}

function setCache(key: string, context: AuthenticatedServerContext) {
  const now = Date.now();
  if (authContextCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    for (const [k, v] of authContextCache) {
      if (now - v.cachedAt >= AUTH_CACHE_TTL_MS) authContextCache.delete(k);
    }
    // Still full: evict the oldest insertion.
    if (authContextCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      const oldest = authContextCache.keys().next().value;
      if (oldest) authContextCache.delete(oldest);
    }
  }
  authContextCache.set(key, { context, cachedAt: now });
}

/**
 * Cookie-authenticated requests are subject to CSRF, so state-changing ones must be same-origin.
 * Bearer-token requests (extension, API clients) are not ambient and need no such check.
 */
function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers.get('sec-fetch-site');
  return site === 'same-origin';
}

export function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
}

export function forbiddenResponse(message = 'Forbidden', headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status: 403, headers });
}

/**
 * Verifies the Firebase ID token and resolves the caller's identity and (single) workspace.
 *
 * The workspace is ALWAYS derived from the caller's own profile and active membership record.
 * Client-supplied workspace identifiers (headers, query, body) are never trusted. Any failure to
 * establish identity or membership fails closed.
 */
export async function authenticateServerRequest(
  req: NextRequest
): Promise<AuthenticatedServerContext | null> {
  const authHeader = req.headers.get('authorization');
  let token = '';
  let fromCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const tokenCookie = req.cookies.get('leadflow_auth_token');
    if (tokenCookie) {
      token = tokenCookie.value;
      fromCookie = true;
    }
  }

  if (!token || !isFirebaseAdminConfigured()) {
    return null;
  }

  if (fromCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isSameOriginRequest(req)) {
    return null;
  }

  const cacheKey = createHash('sha256').update(token).digest('hex');
  const cached = authContextCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < AUTH_CACHE_TTL_MS) {
    return cached.context;
  }

  let uid = '';
  let email = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
    email = decoded.email || '';
  } catch (tokenErr) {
    console.warn('[ServerAuth] Invalid, expired or revoked ID token:', (tokenErr as Error)?.message || tokenErr);
    return null;
  }

  let profile: UserProfile | null = null;
  let memberRecord: WorkspaceMember | null = null;
  let workspaceId: string | null = null;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    profile = userDoc.exists ? (userDoc.data() as UserProfile) : null;

    if (profile?.status === 'disabled') {
      return null;
    }

    const candidateWorkspaceId = profile?.currentWorkspaceId || null;
    if (candidateWorkspaceId) {
      const [memberDoc, wsDoc] = await Promise.all([
        adminDb.collection('workspaces').doc(candidateWorkspaceId).collection('members').doc(uid).get(),
        adminDb.collection('workspaces').doc(candidateWorkspaceId).get(),
      ]);

      if (
        memberDoc.exists &&
        (memberDoc.data() as WorkspaceMember).status === 'active' &&
        wsDoc.exists &&
        wsDoc.data()?.status === 'active'
      ) {
        memberRecord = memberDoc.data() as WorkspaceMember;
        workspaceId = candidateWorkspaceId;
      }
    }
  } catch (dbErr) {
    // Fail closed: never guess identity, role or workspace when the database is unavailable.
    console.error('[ServerAuth] Firestore lookup failed:', (dbErr as Error)?.message || dbErr);
    return null;
  }

  const result: AuthenticatedServerContext = {
    uid,
    email,
    profile,
    role: memberRecord?.role ?? 'sdr',
    workspaceId,
    memberRecord,
  };

  setCache(cacheKey, result);
  return result;
}

/** Context for a caller who is an active member of an active workspace. */
export type WorkspaceContext = AuthenticatedServerContext & { workspaceId: string };

/**
 * Authenticates and requires active workspace membership.
 * Returns either the context or a ready-to-return error response.
 */
export async function requireWorkspaceMember(
  req: NextRequest,
  headers?: Record<string, string>
): Promise<{ context: WorkspaceContext; response?: undefined } | { context?: undefined; response: NextResponse }> {
  const context = await authenticateServerRequest(req);
  if (!context) return { response: unauthorizedResponse(headers) };
  if (!context.workspaceId) {
    return { response: forbiddenResponse('No active workspace membership.', headers) };
  }
  return { context: context as WorkspaceContext };
}

/** Same as requireWorkspaceMember but additionally requires the admin role. */
export async function requireWorkspaceAdmin(
  req: NextRequest,
  headers?: Record<string, string>
): ReturnType<typeof requireWorkspaceMember> {
  const result = await requireWorkspaceMember(req, headers);
  if (result.response) return result;
  if (result.context.role !== 'admin') {
    return { response: forbiddenResponse('Forbidden: Admin access required.', headers) };
  }
  return result;
}
