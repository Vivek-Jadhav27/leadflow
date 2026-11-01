export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { TeamMember } from '@/types/crm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (!isAdminReady || !adminDb) {
      return NextResponse.json({ success: true, count: 0, team: [] }, { status: 200, headers: corsHeaders });
    }

    const workspaceId =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    const sdrMap = new Map<string, TeamMember>();

    // 1. Fetch from 'users' collection (SDRs only, excluding admin/owner)
    try {
      const usersSnap = await adminDb.collection('users').get();
      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        const roleStr = (data.role || '').toLowerCase();
        // Strictly exclude admins and owners
        if (roleStr.includes('admin') || roleStr.includes('owner')) {
          return;
        }

        const name = data.name || (data.email ? data.email.split('@')[0] : 'SDR Member');
        const email = data.email || '';
        sdrMap.set(doc.id, {
          id: doc.id,
          name,
          email,
          role: 'Outbound SDR',
          initials: (name || email || 'S').slice(0, 2).toUpperCase(),
          status: data.status === 'suspended' ? 'away' : 'active',
          assignedLeadsCount: 0,
          activeSequencesCount: 0,
          completedTasksWeek: 0,
        });
      });
    } catch (uErr) {
      console.warn('[API /team GET] Users read error:', uErr);
    }

    // 2. Fetch from workspace members if workspaceId is provided
    if (workspaceId) {
      try {
        const membersSnap = await adminDb
          .collection('workspaces')
          .doc(workspaceId)
          .collection('members')
          .get();

        for (const doc of membersSnap.docs) {
          const mData = doc.data();
          const roleStr = (mData.role || '').toLowerCase();
          if (roleStr.includes('admin') || roleStr.includes('owner')) {
            sdrMap.delete(doc.id); // ensure admin is never in the list
            continue;
          }

          if (!sdrMap.has(doc.id)) {
            // Fetch user info for name/email
            const uDoc = await adminDb.collection('users').doc(doc.id).get();
            const uData = uDoc.exists ? uDoc.data() : null;
            const name = uData?.name || (uData?.email ? uData.email.split('@')[0] : 'SDR Member');
            const email = uData?.email || '';

            sdrMap.set(doc.id, {
              id: doc.id,
              name,
              email,
              role: 'Outbound SDR',
              initials: (name || email || 'S').slice(0, 2).toUpperCase(),
              status: mData.status === 'suspended' ? 'away' : 'active',
              assignedLeadsCount: 0,
              activeSequencesCount: 0,
              completedTasksWeek: 0,
            });
          }
        }
      } catch (wsErr) {
        console.warn('[API /team GET] Workspace members read error:', wsErr);
      }
    }

    // 3. Collect any SDRs referenced in 'leads' collection
    try {
      let leadsQuery: any = adminDb.collection('leads');
      if (workspaceId) {
        leadsQuery = leadsQuery.where('workspaceId', '==', workspaceId);
      }
      const leadsSnap = await leadsQuery.get();

      leadsSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        const sdrId = d.assignedToId || d.capturedByUid;
        const sdrEmail = d.assignedToEmail || d.capturedBy;
        const sdrName = d.assignedToName || (sdrEmail ? sdrEmail.split('@')[0] : null);

        if (sdrId && !sdrMap.has(sdrId)) {
          // Verify this user isn't an admin
          const name = sdrName || sdrEmail?.split('@')[0] || 'Outbound SDR';
          const email = sdrEmail || '';
          sdrMap.set(sdrId, {
            id: sdrId,
            name,
            email,
            role: 'Outbound SDR',
            initials: (name || email || 'S').slice(0, 2).toUpperCase(),
            status: 'active',
            assignedLeadsCount: 0,
            activeSequencesCount: 0,
            completedTasksWeek: 0,
          });
        }

        // Count assigned leads
        if (d.assignedToId && sdrMap.has(d.assignedToId)) {
          const current = sdrMap.get(d.assignedToId)!;
          current.assignedLeadsCount = (current.assignedLeadsCount || 0) + 1;
        }
      });
    } catch (lErr) {
      console.warn('[API /team GET] Leads read error:', lErr);
    }

    const team = Array.from(sdrMap.values());

    return NextResponse.json(
      {
        success: true,
        count: team.length,
        team,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[API /team GET] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch team members' },
      { status: 500, headers: corsHeaders }
    );
  }
}

