export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// GET: List workspace members and invitations
export async function GET(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context || !context.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, role } = context;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // 1. Fetch workspace document to identify owner
    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }
    const wsData = wsDoc.data();
    const ownerId = wsData?.ownerId;

    // 2. Fetch all members
    const membersSnap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .get();

    const companyNameNorm = (wsData?.companyName || '').toLowerCase().trim();

    const members = [];
    for (const doc of membersSnap.docs) {
      const data = doc.data();
      const userDoc = await adminDb.collection('users').doc(doc.id).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      // Resolve human member name (avoiding company name like "TestGrid" as user's name)
      let resolvedName = userData?.name || data?.name || null;

      if (!resolvedName || (companyNameNorm && resolvedName.toLowerCase().trim() === companyNameNorm)) {
        try {
          const authRecord = await adminAuth.getUser(doc.id);
          if (authRecord?.displayName && authRecord.displayName.toLowerCase().trim() !== companyNameNorm) {
            resolvedName = authRecord.displayName;
          }
        } catch {}
      }

      if (!resolvedName || (companyNameNorm && resolvedName.toLowerCase().trim() === companyNameNorm)) {
        const rawEmail = userData?.email || data?.email || '';
        const prefix = rawEmail.split('@')[0] || '';
        const formatted = prefix
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[._\-0-9]+/g, ' ')
          .trim()
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
        resolvedName = formatted || 'Team Member';
      }

      // Self-heal stale Firestore record if it was stuck with company name
      if (userData?.name && companyNameNorm && userData.name.toLowerCase().trim() === companyNameNorm && resolvedName !== userData.name) {
        adminDb.collection('users').doc(doc.id).set({ name: resolvedName }, { merge: true }).catch(() => {});
        adminDb.collection('workspaces').doc(workspaceId).collection('members').doc(doc.id).set({ name: resolvedName }, { merge: true }).catch(() => {});
      }

      members.push({
        uid: doc.id,
        role: data.role || 'sdr',
        status: data.status || 'active',
        joinedAt: data.joinedAt || '',
        isOwner: doc.id === ownerId,
        user: {
          name: resolvedName,
          email: userData?.email || data?.email || '',
        },
      });
    }

    // 3. Fetch invitations for this workspace
    const invitesSnap = await adminDb
      .collection('invitations')
      .where('workspaceId', '==', workspaceId)
      .get();

    const invitations = invitesSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        invitationId: doc.id,
        email: d.email,
        role: d.role,
        status: d.status,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
        acceptedAt: d.acceptedAt,
        revokedAt: d.revokedAt,
      };
    });

    return NextResponse.json({
      members,
      invitations,
      companyName: wsData?.companyName,
      ownerId,
    });
  } catch (error) {
    console.error('[WorkspaceMembers GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Manage member status (suspend, activate, remove)
export async function POST(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context || !context.workspaceId || context.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin role required.' }, { status: 403 });
    }

    const { workspaceId, uid: callerUid } = context;
    const body = await req.json();
    const { targetUid, action } = body as {
      targetUid: string;
      action: 'suspend' | 'activate' | 'remove';
    };

    if (!targetUid || !action || !['suspend', 'activate', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Valid targetUid and action are required.' }, { status: 400 });
    }

    // Check workspace owner protection
    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }
    const ownerId = wsDoc.data()?.ownerId;

    if (targetUid === ownerId && (action === 'remove' || action === 'suspend')) {
      return NextResponse.json(
        { error: 'Cannot remove or suspend the workspace owner.' },
        { status: 403 }
      );
    }

    const memberRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(targetUid);

    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'Member not found in workspace.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let newStatus: 'active' | 'suspended' | 'removed' = 'active';

    if (action === 'suspend') {
      newStatus = 'suspended';
    } else if (action === 'remove') {
      newStatus = 'removed';
    } else if (action === 'activate') {
      newStatus = 'active';
    }

    await memberRef.update({
      status: newStatus,
      updatedAt: now,
      updatedBy: callerUid,
    });

    // If removed, clear currentWorkspaceId from target user's profile if it matches
    if (newStatus === 'removed') {
      const userRef = adminDb.collection('users').doc(targetUid);
      const userDoc = await userRef.get();
      if (userDoc.exists && userDoc.data()?.currentWorkspaceId === workspaceId) {
        await userRef.update({
          currentWorkspaceId: null,
          updatedAt: now,
        });
      }
    }

    // Audit log
    await adminDb.collection('auditLogs').add({
      action: `MEMBER_${action.toUpperCase()}`,
      performedBy: callerUid,
      workspaceId,
      targetId: targetUid,
      timestamp: now,
      details: { newStatus },
    });

    return NextResponse.json({
      success: true,
      targetUid,
      status: newStatus,
      message: `Member successfully ${action === 'remove' ? 'removed' : action === 'suspend' ? 'suspended' : 'activated'}.`,
    });
  } catch (error) {
    console.error('[WorkspaceMembers POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
