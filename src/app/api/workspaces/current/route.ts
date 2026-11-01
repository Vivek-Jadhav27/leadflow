export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const context = await authenticateServerRequest(req);
    if (!context || !context.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized or no workspace context' }, { status: 401 });
    }

    const { workspaceId, role, uid } = context;

    const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }

    const wsData = wsDoc.data();
    if (wsData?.status !== 'active') {
      return NextResponse.json({ error: 'Workspace is suspended or inactive.' }, { status: 403 });
    }

    // Count team members
    const membersSnap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .where('status', '==', 'active')
      .get();

    // Count leads
    const leadsSnap = await adminDb
      .collection('leads')
      .where('workspaceId', '==', workspaceId)
      .get();

    // Count sequences
    const sequencesSnap = await adminDb
      .collection('sequences')
      .where('workspaceId', '==', workspaceId)
      .get();

    return NextResponse.json({
      workspaceId,
      companyName: wsData.companyName,
      companyLinkedinUrl: wsData.companyLinkedinUrl,
      ownerId: wsData.ownerId,
      isOwner: wsData.ownerId === uid,
      role,
      status: wsData.status,
      stats: {
        teamMembersCount: membersSnap.size,
        leadsCount: leadsSnap.size,
        sequencesCount: sequencesSnap.size,
      },
    });
  } catch (error) {
    console.error('[CurrentWorkspace] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

