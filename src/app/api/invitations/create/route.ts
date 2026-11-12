export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireWorkspaceAdmin } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { emailService } from '@/lib/emailService';
import { inviteSDRSchema } from '@/schemas/auth.schema';
import { normalizeEmail } from '@/utils/validation';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin(req);
    if (auth.response) return auth.response;
    const { workspaceId, uid } = auth.context;

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
    const assignedRole = parseResult.data.role === 'ae' ? 'ae' : 'sdr';

    // 1. Check if user with this email is already an active member in this workspace
    const existingUsers = await adminDb
      .collection('users')
      .where('emailNormalized', '==', emailNorm)
      .limit(1)
      .get();

    if (!existingUsers.empty) {
      const existingUid = existingUsers.docs[0].id;
      // A user can belong to only one workspace.
      const otherWorkspaceId = existingUsers.docs[0].data().currentWorkspaceId;
      if (otherWorkspaceId && otherWorkspaceId !== workspaceId) {
        const otherMember = await adminDb
          .collection('workspaces')
          .doc(otherWorkspaceId)
          .collection('members')
          .doc(existingUid)
          .get();
        if (otherMember.exists && otherMember.data()?.status === 'active') {
          return NextResponse.json(
            { error: 'This person already belongs to another workspace.' },
            { status: 409 }
          );
        }
      }
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
    // Never build the link from client-controlled headers.
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

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
      role: assignedRole,
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
      details: { email: emailNorm, role: assignedRole },
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
