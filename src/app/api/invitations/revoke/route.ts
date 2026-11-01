import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context || context.role !== 'admin' || !context.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized: Only workspace Admins can revoke invitations.' }, { status: 403 });
    }

    const { workspaceId, uid } = context;
    const body = await req.json();
    const invitationId = body?.invitationId;

    if (!invitationId) {
      return NextResponse.json({ error: 'invitationId is required.' }, { status: 400 });
    }

    const inviteDoc = await adminDb.collection('invitations').doc(invitationId).get();
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }

    const inviteData = inviteDoc.data();
    if (inviteData?.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Forbidden: Invitation belongs to a different workspace.' }, { status: 403 });
    }

    if (inviteData?.status === 'accepted') {
      return NextResponse.json({ error: 'Cannot revoke an invitation that has already been accepted.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await adminDb.collection('invitations').doc(invitationId).update({
      status: 'revoked',
      revokedAt: now,
      revokedBy: uid,
    });

    await adminDb.collection('auditLogs').add({
      action: 'INVITATION_REVOKED',
      performedBy: uid,
      workspaceId,
      targetId: invitationId,
      timestamp: now,
      details: { email: inviteData?.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully.',
    });
  } catch (error) {
    console.error('[RevokeInvitation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

