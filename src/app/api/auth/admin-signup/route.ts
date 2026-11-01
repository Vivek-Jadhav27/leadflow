export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { adminSignupSchema } from '@/schemas/auth.schema';
import { normalizeEmail } from '@/utils/validation';

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

    const { companyName, companyLinkedinUrl, email, password } = parseResult.data;
    const emailNorm = normalizeEmail(email);

    // If server does not have service account key, notify caller to use client SDK
    if (!isFirebaseAdminConfigured) {
      return NextResponse.json(
        {
          error: 'Firebase Admin service account key is not configured in .env.local.',
          code: 'MISSING_ADMIN_CREDENTIALS',
        },
        { status: 503 }
      );
    }

    let uid = '';
    let isExistingAuthUser = false;

    // 1. Check if user already exists in Firebase Auth
    try {
      const existingUser = await adminAuth.getUserByEmail(emailNorm);
      uid = existingUser.uid;
      isExistingAuthUser = true;
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code !== 'auth/user-not-found') {
        console.error('[AdminSignup] getUserByEmail error:', err);
      }
    }

    // 2. If user already exists in Auth, check if they already have an active workspace
    if (isExistingAuthUser) {
      const existingUserDoc = await adminDb.collection('users').doc(uid).get();
      if (existingUserDoc.exists) {
        const userData = existingUserDoc.data();
        if (userData?.currentWorkspaceId) {
          const wsDoc = await adminDb.collection('workspaces').doc(userData.currentWorkspaceId).get();
          if (wsDoc.exists) {
            return NextResponse.json(
              {
                error: 'An account with this email already exists. Please log in.',
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // 3. Create Firebase Auth user if not existing
    if (!isExistingAuthUser) {
      try {
        const newAuthUser = await adminAuth.createUser({
          email: emailNorm,
          password: password,
          displayName: companyName.trim(),
          emailVerified: true,
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
        return NextResponse.json(
          { error: err.message || 'Failed to create authentication user.' },
          { status: 500 }
        );
      }
    }

    // 4. Provisioning Workspace & User atomically
    const now = new Date().toISOString();

    // Check if user already owns an existing workspace (idempotency check)
    const existingWorkspacesSnapshot = await adminDb
      .collection('workspaces')
      .where('ownerId', '==', uid)
      .limit(1)
      .get();

    let workspaceId = '';
    if (!existingWorkspacesSnapshot.empty) {
      workspaceId = existingWorkspacesSnapshot.docs[0].id;
    } else {
      workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const batch = adminDb.batch();

    // User doc
    const userRef = adminDb.collection('users').doc(uid);
    batch.set(
      userRef,
      {
        uid,
        name: companyName.trim(),
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
      { error: errString || 'An unexpected error occurred during workspace provisioning.' },
      { status: 500 }
    );
  }
}

