export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

// Used by the Chrome extension. Responses are not credentialed (no Allow-Credentials).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password || email.length > 254 || password.length > 1024) {
      return json({ error: 'Email and password are required.' }, 400);
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
    if (!apiKey || !isFirebaseAdminConfigured()) {
      console.error('[API /auth/login] Server is missing Firebase configuration.');
      return json({ error: 'Login is temporarily unavailable.' }, 503);
    }

    // 1. The password is ALWAYS verified by Firebase Auth. There is no fallback that issues a token
    //    without it: any failure here is a failed login.
    let idpRes: Response;
    try {
      idpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
    } catch (networkErr) {
      console.error('[API /auth/login] Identity Toolkit network error:', networkErr);
      return json({ error: 'Login is temporarily unavailable.' }, 503);
    }

    const idpData = await idpRes.json().catch(() => ({}));
    if (!idpRes.ok) {
      const errMsg: string = idpData?.error?.message || '';
      if (errMsg.includes('USER_DISABLED')) {
        return json({ error: 'This account has been disabled.' }, 403);
      }
      if (errMsg.includes('TOO_MANY_ATTEMPTS')) {
        return json({ error: 'Too many attempts. Please try again later.' }, 429);
      }
      if (
        errMsg.includes('INVALID_LOGIN_CREDENTIALS') ||
        errMsg.includes('INVALID_PASSWORD') ||
        errMsg.includes('EMAIL_NOT_FOUND') ||
        errMsg.includes('INVALID_EMAIL')
      ) {
        return json({ error: 'Invalid email or password.' }, 401);
      }
      console.error('[API /auth/login] Identity Toolkit error:', errMsg);
      return json({ error: 'Login is temporarily unavailable.' }, 502);
    }

    const idToken: string = idpData.idToken;
    const uid: string = idpData.localId;
    const returnedEmail: string = idpData.email || email;
    let displayName: string = idpData.displayName || email.split('@')[0];

    // 2. Resolve profile, workspace and role from Firestore. Fail closed if it can't be read.
    let role = 'sdr';
    let workspaceId: string | null = null;
    let workspaceName = '';
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data();
      if (userData?.status === 'disabled') {
        return json({ error: 'Your account is deactivated.' }, 403);
      }
      displayName = userData?.name || userData?.displayName || displayName;
      const candidateWorkspaceId: string | undefined = userData?.currentWorkspaceId;

      if (candidateWorkspaceId) {
        const [wsDoc, memberDoc] = await Promise.all([
          adminDb.collection('workspaces').doc(candidateWorkspaceId).get(),
          adminDb.collection('workspaces').doc(candidateWorkspaceId).collection('members').doc(uid).get(),
        ]);
        const memberData = memberDoc.data();
        if (memberDoc.exists && memberData?.status !== 'active') {
          return json({ error: 'Your workspace membership is suspended or removed.' }, 403);
        }
        if (memberDoc.exists && wsDoc.exists && wsDoc.data()?.status === 'active') {
          workspaceId = candidateWorkspaceId;
          workspaceName = wsDoc.data()?.companyName || '';
          role = memberData?.role || 'sdr';
        }
      }
    } catch (dbErr) {
      console.error('[API /auth/login] Firestore lookup failed:', dbErr);
      return json({ error: 'Login is temporarily unavailable.' }, 503);
    }

    return json(
      {
        success: true,
        token: idToken,
        user: { uid, email: returnedEmail, displayName, role, workspaceId, workspaceName },
      },
      200
    );
  } catch (error) {
    console.error('[API /auth/login] Error:', error);
    return json({ error: 'Login failed.' }, 500);
  }
}
