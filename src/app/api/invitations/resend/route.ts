import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { emailService } from '@/lib/emailService';

export async function POST(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context || context.role !== 'admin' || !context.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized: Only workspace Admins can resend invitations.' }, { status: 403 });
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
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 400 });
    }

    // Workspace info
    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    const companyName = wsDoc.data()?.companyName || 'LeadFlow Workspace';

    // Generate fresh secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host') || 'localhost:3000'}`;

    const invitationLink = `${origin}/invite/accept?token=${rawToken}`;

    const emailResult = await emailService.sendInvitationEmail(inviteData?.email, companyName, invitationLink);
    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to deliver email: ${emailResult.error || 'Provider failure'}` },
        { status: 502 }
      );
    }

    await adminDb.collection('invitations').doc(invitationId).update({
      tokenHash,
      status: 'pending',
      expiresAt,
      resendCount: (inviteData?.resendCount || 0) + 1,
      lastResentAt: now.toISOString(),
      lastResentBy: uid,
      'deliveryStatus.sent': true,
      'deliveryStatus.provider': emailResult.provider,
    });

    await adminDb.collection('auditLogs').add({
      action: 'INVITATION_RESENT',
      performedBy: uid,
      workspaceId,
      targetId: invitationId,
      timestamp: now.toISOString(),
      details: { email: inviteData?.email },
    });

    return NextResponse.json({
      success: true,
      invitationId,
      email: inviteData?.email,
      invitationLink,
      provider: emailResult.provider,
      expiresAt,
      message:
        emailResult.provider === 'console-dev'
          ? 'Invitation link refreshed. (Email provider not configured in .env.local - logged to terminal console).'
          : 'Invitation resent successfully via email.',
    });
  } catch (error) {
    console.error('[ResendInvitation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

