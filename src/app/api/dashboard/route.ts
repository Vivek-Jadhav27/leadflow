export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, role, workspaceId } = auth.context;
    const isAdmin = role === 'admin';

    const wsRef = adminDb.collection('workspaces').doc(workspaceId);

    // Counts are scoped like the lists below: admins see the workspace, others only their own leads.
    let leadsQuery: Query<DocumentData> = adminDb.collection('leads').where('workspaceId', '==', workspaceId);
    if (!isAdmin) leadsQuery = leadsQuery.where('assignedToId', '==', uid);

    const [wsDoc, membersCount, leadsCount, sequencesSnap, leadsSnap] = await Promise.all([
      wsRef.get(),
      wsRef.collection('members').where('status', '==', 'active').count().get(),
      leadsQuery.count().get(),
      adminDb.collection('sequences').where('workspaceId', '==', workspaceId).limit(100).get(),
      leadsQuery.limit(200).get(),
    ]);

    const wsData = wsDoc.data() || {};

    let sequences = sequencesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, any>[];
    if (!isAdmin) {
      sequences = sequences.filter(
        (s) => s.createdByUid === uid || (s.approvalStatus === 'approved' && !s.isCustom)
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayLeads = leadsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, any>)
      .filter((l) => {
        if (l.disposition === 'archived') return false;
        return (
          l.outreachStatus === 'needs_sequence' ||
          l.outreachStatus === 'followup_due' ||
          l.outreachStatus === 'in_sequence' ||
          Boolean(l.nextFollowUpDate && l.nextFollowUpDate <= todayStr)
        );
      })
      .map((l) => {
        const assignedEmail = l.assignedToEmail || l.capturedBy || null;
        return {
          ...l,
          assignedToId: l.assignedToId || l.capturedByUid || null,
          assignedToEmail: assignedEmail,
          assignedToName: l.assignedToName || (assignedEmail ? String(assignedEmail).split('@')[0] : 'Unassigned'),
        };
      });

    return NextResponse.json(
      {
        success: true,
        workspace: {
          workspaceId,
          companyName: wsData.companyName || 'LeadFlow Workspace',
          companyLinkedinUrl: wsData.companyLinkedinUrl || '',
          ownerId: wsData.ownerId || null,
          isOwner: wsData.ownerId === uid,
          role,
          status: wsData.status || 'active',
        },
        stats: {
          teamMembersCount: membersCount.data().count,
          leadsCount: leadsCount.data().count,
          sequencesCount: sequences.length,
        },
        todayLeads,
        sequences,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
