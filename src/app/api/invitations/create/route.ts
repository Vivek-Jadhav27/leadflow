import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { emailService } from '@/lib/emailService';
import { inviteSDRSchema } from '@/schemas/auth.schema';
import { normalizeEmail } from '@/utils/validation';

export async function POST(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (context.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace Admins can invite team members.' },
        { status: 403 }
      );
    }

    const { workspaceId, uid } = context;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace selected.' }, { status: 400 });
    }

    // Verify workspace exists and is active
    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }
    const wsData = wsDoc.data();
    if (wsData?.status !== 'active') {
      return NextResponse.json({ error: 'Workspace is currently inactive or suspended.' }, { status: 403 });
    }

    const companyName = wsData.companyName || 'LeadFlow Workspace';

    const body = await req.json();
    const parseResult = inviteSDRSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid email.' },
        { status: 400 }
      );
    }

    const emailNorm = normalizeEmail(parseResult.data.email);

    // 1. Check if user with this email is already an active member in this workspace
    const existingUsers = await adminDb
      .collection('users')
      .where('emailNormalized', '==', emailNorm)
      .limit(1)
      .get();

    if (!existingUsers.empty) {
      const existingUid = existingUsers.docs[0].id;
      const existingMemberDoc = await adminDb
        .collection('workspaces')
        .doc(workspaceId)
        .collection('members')
        .doc(existingUid)
        .get();

      if (existingMemberDoc.exists && existingMemberDoc.data()?.status === 'active') {
        return NextResponse.json(
          { error: 'This person is already a member of your workspace.' },
          { status: 400 }
        );
      }
    }

    // 2. Check if a pending, unexpired invitation already exists for this email in this workspace
    const pendingInvites = await adminDb
      .collection('invitations')
      .where('workspaceId', '==', workspaceId)
      .where('emailNormalized', '==', emailNorm)
      .where('status', '==', 'pending')
      .get();

    const now = new Date();

    if (!pendingInvites.empty) {
      const activePending = pendingInvites.docs.find((d: any) => {
        const exp = new Date(d.data().expiresAt);
        return exp > now;
      });

      if (activePending) {
        return NextResponse.json(
          {
            error: 'An invitation has already been sent.',
            invitationId: activePending.id,
            canResend: true,
          },
          { status: 409 }
        );
      }
    }

    // 3. Generate cryptographically secure random token (256 bits of entropy)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitationId = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    // 4. Construct invitation link using request host or configured base URL
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host') || 'localhost:3000'}`;

    const invitationLink = `${origin}/invite/accept?token=${rawToken}`;

    // 5. Send invitation email
    const emailResult = await emailService.sendInvitationEmail(emailNorm, companyName, invitationLink);
    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to deliver invitation email: ${emailResult.error || 'Provider failure'}` },
        { status: 502 }
      );
    }

    // 6. Record invitation in Firestore with only tokenHash
    const invitationRecord = {
      invitationId,
      workspaceId,
      companyName,
      email: emailNorm,
      emailNormalized: emailNorm,
      role: 'sdr' as const,
      tokenHash,
      status: 'pending' as const,
      invitedBy: uid,
      createdAt: now.toISOString(),
      expiresAt,
      deliveryStatus: {
        sent: true,
        provider: emailResult.provider,
        messageId: emailResult.messageId,
      },
    };

    await adminDb.collection('invitations').doc(invitationId).set(invitationRecord);

    // Audit log
    await adminDb.collection('auditLogs').add({
      action: 'INVITATION_SENT',
      performedBy: uid,
      workspaceId,
      targetId: invitationId,
      timestamp: now.toISOString(),
      details: { email: emailNorm, role: 'sdr' },
    });

    return NextResponse.json({
      success: true,
      invitationId,
      email: emailNorm,
      invitationLink,
      provider: emailResult.provider,
      expiresAt,
      message:
        emailResult.provider === 'console-dev'
          ? 'Invitation link generated. (Email provider not configured in .env.local - logged to terminal console).'
          : 'Invitation dispatched successfully via email.',
    });
  } catch (error) {
    console.error('[CreateInvitation] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
