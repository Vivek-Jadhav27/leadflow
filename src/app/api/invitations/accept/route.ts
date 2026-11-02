export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { normalizeEmail } from '@/utils/validation';

export async function POST(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context) {
      return NextResponse.json({ error: 'Please log in or sign up before accepting this invitation.' }, { status: 401 });
    }

    const { uid, email: callerEmail } = context;
    const callerEmailNorm = normalizeEmail(callerEmail);

    const body = await req.json();
    const token = body?.token;
    const incomingFullName = typeof body?.fullName === 'string' && body.fullName.trim() ? body.fullName.trim() : null;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invitation token is required.' }, { status: 400 });
    }

    // Compute token hash
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Run atomic Firestore transaction to prevent race conditions or duplicate acceptance
    const result = await adminDb.runTransaction(async (transaction: Transaction) => {
      // 1. Query invitation doc by tokenHash
      const inviteQuery = adminDb
        .collection('invitations')
        .where('tokenHash', '==', tokenHash)
        .limit(1);

      const inviteSnap = await transaction.get(inviteQuery);
      if (inviteSnap.empty) {
        throw new Error('INVITATION_NOT_FOUND');
      }

      const inviteDoc = inviteSnap.docs[0];
      const inviteData = inviteDoc.data() as Record<string, any>;
      const now = new Date();
      const expiresAt = new Date(inviteData.expiresAt);

      if (inviteData.status === 'revoked') {
        throw new Error('INVITATION_REVOKED');
      }
      if (inviteData.status === 'accepted') {
        throw new Error('INVITATION_ALREADY_ACCEPTED');
      }
      if (inviteData.status !== 'pending' || expiresAt <= now) {
        throw new Error('INVITATION_EXPIRED');
      }

      // 2. Email matching check
      if (inviteData.emailNormalized !== callerEmailNorm) {
        throw new Error('EMAIL_MISMATCH');
      }

      const workspaceId = inviteData.workspaceId as string;

      // 3. Workspace check
      const wsRef = adminDb.collection('workspaces').doc(workspaceId);
      const wsDoc = await transaction.get(wsRef);
      if (!wsDoc.exists) {
        throw new Error('WORKSPACE_NOT_FOUND');
      }
      const wsData = wsDoc.data() as Record<string, any> | undefined;
      if (wsData?.status !== 'active') {
        throw new Error('WORKSPACE_INACTIVE');
      }

      // 4. Update invitation record
      transaction.update(inviteDoc.ref, {
        status: 'accepted',
        acceptedAt: now.toISOString(),
        acceptedBy: uid,
      });

      const targetRole = inviteData.role === 'ae' ? 'ae' : 'sdr';

      // Resolve human name for member
      let resolvedMemberName = incomingFullName || null;
      if (!resolvedMemberName && context.profile?.name && context.profile.name.toLowerCase().trim() !== (wsData?.companyName || '').toLowerCase().trim()) {
        resolvedMemberName = context.profile.name;
      }
      if (!resolvedMemberName) {
        resolvedMemberName = callerEmailNorm.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }

      // 5. Create / activate member record
      const memberRef = adminDb
        .collection('workspaces')
        .doc(workspaceId)
        .collection('members')
        .doc(uid);

      transaction.set(
        memberRef,
        {
          uid,
          name: resolvedMemberName,
          role: targetRole,
          status: 'active',
          joinedAt: now.toISOString(),
          invitedBy: inviteData.invitedBy,
        },
        { merge: true }
      );

      // 6. Update user profile
      const userRef = adminDb.collection('users').doc(uid);
      transaction.set(
        userRef,
        {
          uid,
          name: resolvedMemberName,
          email: callerEmailNorm,
          emailNormalized: callerEmailNorm,
          role: targetRole,
          status: 'active',
          currentWorkspaceId: workspaceId,
          updatedAt: now.toISOString(),
        },
        { merge: true }
      );

      // 7. Audit log
      const auditRef = adminDb.collection('auditLogs').doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        action: 'INVITATION_ACCEPTED',
        performedBy: uid,
        workspaceId,
        targetId: inviteDoc.id,
        timestamp: now.toISOString(),
        details: { email: callerEmailNorm, role: targetRole },
      });

      return {
        workspaceId,
        companyName: wsData?.companyName || 'LeadFlow Workspace',
        role: targetRole,
      };
    });

    return NextResponse.json({
      success: true,
      workspaceId: result.workspaceId,
      companyName: result.companyName,
      role: result.role,
      message: 'Invitation accepted successfully! Welcome to the workspace.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[AcceptInvitation] Error:', err.message);

    if (err.message === 'INVITATION_NOT_FOUND') {
      return NextResponse.json({ error: 'This invitation is invalid or does not exist.' }, { status: 404 });
    }
    if (err.message === 'INVITATION_REVOKED') {
      return NextResponse.json({ error: 'This invitation has been revoked by the workspace administrator.' }, { status: 410 });
    }
    if (err.message === 'INVITATION_ALREADY_ACCEPTED') {
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 });
    }
    if (err.message === 'INVITATION_EXPIRED') {
      return NextResponse.json({ error: 'This invitation has expired. Please ask the Admin to send a new invitation.' }, { status: 410 });
    }
    if (err.message === 'EMAIL_MISMATCH') {
      return NextResponse.json(
        {
          error:
            'The signed-in email address does not match the email this invitation was sent to. Please log out and sign in with the invited email.',
        },
        { status: 403 }
      );
    }
    if (err.message === 'WORKSPACE_INACTIVE') {
      return NextResponse.json({ error: 'The invited workspace is currently inactive or suspended.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to accept invitation. Please try again.' }, { status: 500 });
  }
}
