import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, reason: 'missing_token', message: 'No invitation token provided.' }, { status: 400 });
    }

    // Hash the token with SHA-256 to compare with stored tokenHash
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const inviteSnapshot = await adminDb
      .collection('invitations')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (inviteSnapshot.empty) {
      return NextResponse.json(
        { valid: false, reason: 'invalid_token', message: 'This invitation is invalid or does not exist.' },
        { status: 404 }
      );
    }

    const inviteData = inviteSnapshot.docs[0].data();
    const now = new Date();
    const expiresAt = new Date(inviteData.expiresAt);

    if (inviteData.status === 'revoked') {
      return NextResponse.json(
        { valid: false, reason: 'revoked', message: 'This invitation has been revoked by the workspace administrator.' },
        { status: 410 }
      );
    }

    if (inviteData.status === 'accepted') {
      return NextResponse.json(
        { valid: false, reason: 'already_accepted', message: 'This invitation has already been accepted.' },
        { status: 410 }
      );
    }

    if (inviteData.status !== 'pending' || expiresAt <= now) {
      return NextResponse.json(
        { valid: false, reason: 'expired', message: 'This invitation link has expired. Please request a new invitation.' },
        { status: 410 }
      );
    }

    // Verify workspace is still active
    const wsDoc = await adminDb.collection('workspaces').doc(inviteData.workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json(
        { valid: false, reason: 'workspace_not_found', message: 'The invited workspace no longer exists.' },
        { status: 404 }
      );
    }

    const wsData = wsDoc.data();
    if (wsData?.status !== 'active') {
      return NextResponse.json(
        { valid: false, reason: 'workspace_inactive', message: 'This workspace is currently suspended or inactive.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      invitationId: inviteSnapshot.docs[0].id,
      companyName: wsData?.companyName || inviteData.companyName || 'LeadFlow Workspace',
      companyLinkedinUrl: wsData?.companyLinkedinUrl || null,
      email: inviteData.email,
      role: 'sdr',
      expiresAt: inviteData.expiresAt,
    });
  } catch (error) {
    console.error('[ValidateInvitation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

