export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { adminSignupSchema } from '@/schemas/auth.schema';
import { normalizeEmail } from '@/utils/validation';
import { randomUUID } from 'crypto';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = adminSignupSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join('. ');
      return NextResponse.json(
        {
          error: errorMsg || 'Validation failed',
          issues: parseResult.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
        { status: 400 }
      );
    }

    const { companyName, companyLinkedinUrl, email, password, fullName } = parseResult.data;
    const emailNorm = normalizeEmail(email);
    const userDisplayName = (fullName && fullName.trim())
      ? fullName.trim()
      : emailNorm.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        {
          error: 'Workspace provisioning is not available: server credentials are not configured.',
          code: 'MISSING_ADMIN_CREDENTIALS',
        },
        { status: 503 }
      );
    }

    // Public endpoint: bound abuse per client address and per target email.
    const ip = clientIp(req);
    if (!rateLimit(`admin-signup:ip:${ip}`, 5, 10 * 60 * 1000) || !rateLimit(`admin-signup:email:${emailNorm}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    // 1. This endpoint only creates brand-new accounts. If the email is already registered we never
    //    touch it (that would let anyone provision a workspace under, or pre-claim, someone else's account).
    let uid = '';
    try {
      await adminAuth.getUserByEmail(emailNorm);
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in.' },
        { status: 409 }
      );
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code !== 'auth/user-not-found') {
        console.error('[AdminSignup] getUserByEmail error:', err);
        return NextResponse.json({ error: 'Could not create the account. Please try again.' }, { status: 500 });
      }
    }

    // 2. Create the Firebase Auth user. The email is NOT marked verified: the client sends a
    //    verification email after the first sign-in.
    try {
      const newAuthUser = await adminAuth.createUser({
        email: emailNorm,
        password: password,
        displayName: userDisplayName,
        emailVerified: false,
      });
      uid = newAuthUser.uid;
    } catch (authErr: unknown) {
      const err = authErr as { code?: string; message?: string };
      if (err.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please log in.' },
          { status: 409 }
        );
      }
      console.error('[AdminSignup] createUser error:', authErr);
      return NextResponse.json({ error: 'Failed to create authentication user.' }, { status: 500 });
    }

    // 3. Provision workspace, profile and membership atomically
    const now = new Date().toISOString();
    const workspaceId = `ws_${randomUUID()}`;

    const batch = adminDb.batch();

    // User doc
    const userRef = adminDb.collection('users').doc(uid);
    batch.set(
      userRef,
      {
        uid,
        name: userDisplayName,
        email: emailNorm,
        emailNormalized: emailNorm,
        status: 'active',
        role: 'admin',
        currentWorkspaceId: workspaceId,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      },
      { merge: true }
    );

    // Workspace doc
    const workspaceRef = adminDb.collection('workspaces').doc(workspaceId);
    batch.set(
      workspaceRef,
      {
        workspaceId,
        companyName: companyName.trim(),
        companyLinkedinUrl: companyLinkedinUrl.trim(),
        ownerId: uid,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // Membership doc
    const memberRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(uid);

    batch.set(
      memberRef,
      {
        uid,
        name: userDisplayName,
        role: 'admin',
        status: 'active',
        joinedAt: now,
        invitedBy: 'self',
      },
      { merge: true }
    );

    // Audit log
    const auditRef = adminDb.collection('auditLogs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      action: 'ADMIN_SIGNUP_WORKSPACE_PROVISIONED',
      performedBy: uid,
      workspaceId,
      timestamp: now,
      details: { companyName, email: emailNorm },
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      workspaceId,
      uid,
      companyName,
      email: emailNorm,
      message: 'Workspace provisioned successfully.',
    });
  } catch (error) {
    const errString = (error as Error)?.message || '';
    if (errString.includes('Could not load the default credentials') || errString.includes('access token')) {
      return NextResponse.json(
        {
          error: 'Firebase Admin service account key is not configured in .env.local.',
          code: 'MISSING_ADMIN_CREDENTIALS',
        },
        { status: 503 }
      );
    }
    console.error('[AdminSignup] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during workspace provisioning.' },
      { status: 500 }
    );
  }
}

