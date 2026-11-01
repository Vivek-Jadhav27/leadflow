export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      '';

    let idToken = '';
    let uid = '';
    let returnedEmail = email;
    let displayName = email.split('@')[0];

    // 1. Authenticate with Firebase Identity Toolkit REST API
    let authSuccess = false;
    if (apiKey) {
      try {
        const idpRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              returnSecureToken: true,
            }),
          }
        );

        const idpData = await idpRes.json();
        if (idpRes.ok) {
          authSuccess = true;
          idToken = idpData.idToken;
          uid = idpData.localId;
          returnedEmail = idpData.email || email;
          displayName = idpData.displayName || displayName;
        } else {
          const errMsg = idpData?.error?.message || '';
          if (
            errMsg.includes('INVALID_LOGIN_CREDENTIALS') ||
            errMsg.includes('INVALID_PASSWORD') ||
            errMsg.includes('EMAIL_NOT_FOUND')
          ) {
            return NextResponse.json(
              { error: 'Invalid email or password.' },
              { status: 401, headers: corsHeaders }
            );
          }
          if (errMsg.includes('USER_DISABLED')) {
            return NextResponse.json(
              { error: 'This account has been disabled.' },
              { status: 403, headers: corsHeaders }
            );
          }
          // If there is another specific error, return it
          if (errMsg && !errMsg.includes('API key not valid')) {
            return NextResponse.json(
              { error: `Authentication failed: ${errMsg}` },
              { status: 400, headers: corsHeaders }
            );
          }
        }
      } catch (networkErr) {
        console.warn('[API /auth/login] Identity Toolkit network error, trying Admin fallback:', networkErr);
      }
    }

    // 2. Fallback via Firebase Admin SDK if configured
    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (!authSuccess && isAdminReady) {
      try {
        const authUser = await adminAuth.getUserByEmail(email);
        uid = authUser.uid;
        returnedEmail = authUser.email || email;
        displayName = authUser.displayName || displayName;
        // Generate a verified custom token
        idToken = await adminAuth.createCustomToken(uid);
        authSuccess = true;
      } catch (adminErr: any) {
        if (adminErr?.code === 'auth/user-not-found') {
          return NextResponse.json(
            { error: 'Invalid email or password.' },
            { status: 401, headers: corsHeaders }
          );
        }
      }
    }

    if (!authSuccess || !uid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Resolve user profile, workspace, and role from Firestore
    let role = 'sdr';
    let workspaceId = null;
    let workspaceName = 'LeadFlow Workspace';

    if (isAdminReady) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData?.status === 'disabled') {
            return NextResponse.json(
              { error: 'Your account is deactivated.' },
              { status: 403, headers: corsHeaders }
            );
          }
          role = userData?.role || 'sdr';
          workspaceId = userData?.currentWorkspaceId || null;
          displayName = userData?.name || userData?.displayName || displayName;
        }

        if (workspaceId) {
          const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
          if (wsDoc.exists) {
            workspaceName = wsDoc.data()?.companyName || workspaceName;
          }

          // Check workspace membership status
          const memberDoc = await adminDb
            .collection('workspaces')
            .doc(workspaceId)
            .collection('members')
            .doc(uid)
            .get();

          if (memberDoc.exists) {
            const memberData = memberDoc.data();
            if (memberData?.status === 'suspended' || memberData?.status === 'removed') {
              return NextResponse.json(
                { error: 'Your workspace membership is suspended or removed.' },
                { status: 403, headers: corsHeaders }
              );
            }
            if (memberData?.role) {
              role = memberData.role;
            }
          }
        }
      } catch (dbErr) {
        console.warn('[API /auth/login] Firestore lookup warning:', dbErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        token: idToken,
        user: {
          uid,
          email: returnedEmail,
          displayName,
          role,
          workspaceId,
          workspaceName,
        },
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.error('API /auth/login POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Login failed.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

