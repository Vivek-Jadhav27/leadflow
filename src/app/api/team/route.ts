export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { TeamMember } from '@/types/crm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function displayName(raw: string): string {
  const name = raw.includes('@')
    ? raw.split('@')[0].replace(/[._\-0-9]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : raw;
  return name.trim() || 'Team Member';
}

// Lists the caller's own workspace team. Admins see all non-admin members; other roles see only themselves.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, role, workspaceId } = auth.context;

    const membersSnap = await adminDb.collection('workspaces').doc(workspaceId).collection('members').get();
    const members = membersSnap.docs.filter((d) => {
      const r = String(d.data().role || '').toLowerCase();
      if (role !== 'admin') return d.id === uid;
      return r !== 'admin';
    });

    const userDocs = members.length
      ? await adminDb.getAll(...members.map((m) => adminDb.collection('users').doc(m.id)))
      : [];
    const usersById = new Map(userDocs.map((u) => [u.id, u.data() || {}]));

    const team: TeamMember[] = members.map((m) => {
      const mData = m.data();
      const uData = usersById.get(m.id) || {};
      const email: string = uData.email || mData.email || '';
      const name = displayName(uData.name || mData.name || (email ? email.split('@')[0] : 'Team Member'));
      return {
        id: m.id,
        name,
        email,
        role: String(mData.role || '').toLowerCase() === 'ae' ? 'Account Executive' : 'Outbound SDR',
        initials: (name || email || 'T').slice(0, 2).toUpperCase(),
        status: mData.status === 'active' ? 'active' : 'away',
        assignedLeadsCount: 0,
        activeSequencesCount: 0,
        completedTasksWeek: 0,
      };
    });

    return NextResponse.json({ success: true, count: team.length, team }, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[API /team GET] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500, headers: corsHeaders });
  }
}
