import { NextRequest } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { UserProfile, WorkspaceMember } from '@/types/auth';

export interface AuthenticatedServerContext {
  uid: string;
  email: string;
  profile: UserProfile | null;
  role: 'admin' | 'sdr';
  workspaceId: string | null;
  memberRecord: WorkspaceMember | null;
}

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

  if (!token || !isFirebaseAdminConfigured) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || '';

    // Fetch user profile from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const profile = userDoc.exists ? (userDoc.data() as UserProfile) : null;

    // Check if user is disabled
    if (profile && profile.status === 'disabled') {
      return null;
    }

    // Determine current workspace
    const workspaceId =
      req.headers.get('x-workspace-id') ||
      profile?.currentWorkspaceId ||
      null;

    let memberRecord: WorkspaceMember | null = null;
    let role: 'admin' | 'sdr' = (profile?.role as 'admin' | 'sdr') || 'sdr';

    if (workspaceId) {
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
    }

    return {
      uid,
      email,
      profile,
      role,
      workspaceId,
      memberRecord,
    };
  } catch (err) {
    console.error('[ServerAuth] Token verification failed:', err);
    return null;
  }
}

