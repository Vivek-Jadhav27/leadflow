export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req);
    if (auth.response) return auth.response;
    const { workspaceId, role, uid } = auth.context;

    const wsRef = adminDb.collection('workspaces').doc(workspaceId);
    const wsDoc = await wsRef.get();
    const wsData = wsDoc.data();
    if (!wsDoc.exists || !wsData) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }
    if (wsData.status !== 'active') {
      return NextResponse.json({ error: 'Workspace is suspended or inactive.' }, { status: 403 });
    }

    const [membersSnap, leadsSnap, sequencesSnap] = await Promise.all([
      wsRef.collection('members').where('status', '==', 'active').count().get(),
      adminDb.collection('leads').where('workspaceId', '==', workspaceId).count().get(),
      adminDb.collection('sequences').where('workspaceId', '==', workspaceId).count().get(),
    ]);

    const isAdmin = role === 'admin';
    return NextResponse.json({
      workspaceId,
      companyName: wsData.companyName || 'LeadFlow Workspace',
      companyLinkedinUrl: wsData.companyLinkedinUrl || '',
      ownerId: wsData.ownerId || null,
      isOwner: wsData.ownerId === uid,
      role,
      status: wsData.status,
      // Workspace-wide totals are only meant for admins.
      stats: isAdmin
        ? {
            teamMembersCount: membersSnap.data().count,
            leadsCount: leadsSnap.data().count,
            sequencesCount: sequencesSnap.data().count,
          }
        : { teamMembersCount: 0, leadsCount: 0, sequencesCount: 0 },
    });
  } catch (error) {
    console.error('[CurrentWorkspace] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
