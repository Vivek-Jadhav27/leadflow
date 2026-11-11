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

interface CachedTeamResult {
  team: TeamMember[];
  count: number;
  cachedAt: number;
}
const teamServerCache = new Map<string, CachedTeamResult>();
const TEAM_CACHE_TTL_MS = 60 * 1000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    const cacheKey = workspaceId || 'all';
    const cached = teamServerCache.get(cacheKey);
    const nowTs = Date.now();

    if (cached && nowTs - cached.cachedAt < TEAM_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          success: true,
          count: cached.count,
          team: cached.team,
          fromCache: true,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (!isAdminReady || !adminDb) {
      return NextResponse.json({ success: true, count: 0, team: [] }, { status: 200, headers: corsHeaders });
    }

    const sdrMap = new Map<string, TeamMember>();
    const usersMap = new Map<string, any>();

    // 1. Fetch from 'users' collection once
    try {
      const usersSnap = await adminDb.collection('users').get();
      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        usersMap.set(doc.id, data);
        const roleStr = (data.role || '').toLowerCase();
        // Strictly exclude admins and owners
        if (roleStr.includes('admin') || roleStr.includes('owner')) {
          return;
        }

        const rawName = data.name || (data.email ? data.email.split('@')[0] : 'Team Member');
        const formattedName = rawName.includes('@')
          ? rawName.split('@')[0].replace(/[._\-0-9]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
          : rawName;
        const name = formattedName.trim() || 'Team Member';
        const email = data.email || '';
        const roleDisplay = (roleStr === 'ae' || roleStr.includes('ae')) ? 'Account Executive' : 'Outbound SDR';
        sdrMap.set(doc.id, {
          id: doc.id,
          name,
          email,
          role: roleDisplay,
          initials: (name || email || 'T').slice(0, 2).toUpperCase(),
          status: data.status === 'suspended' ? 'away' : 'active',
          assignedLeadsCount: 0,
          activeSequencesCount: 0,
          completedTasksWeek: 0,
        });
      });
    } catch (uErr) {
      console.warn('[API /team GET] Users read fallback:', (uErr as any)?.message || uErr);
    }

    // 2. Fetch from workspace members if workspaceId is provided (using in-memory usersMap, NO N+1 doc.get() calls)
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
            const uData = usersMap.get(doc.id);
            const rawName = uData?.name || mData?.name || (uData?.email ? uData.email.split('@')[0] : 'Team Member');
            const formattedName = rawName.includes('@')
              ? rawName.split('@')[0].replace(/[._\-0-9]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : rawName;
            const name = formattedName.trim() || 'Team Member';
            const email = uData?.email || mData?.email || '';
            const roleDisplay = (roleStr === 'ae' || roleStr.includes('ae')) ? 'Account Executive' : 'Outbound SDR';

            sdrMap.set(doc.id, {
              id: doc.id,
              name,
              email,
              role: roleDisplay,
              initials: (name || email || 'T').slice(0, 2).toUpperCase(),
              status: mData.status === 'suspended' ? 'away' : 'active',
              assignedLeadsCount: 0,
              activeSequencesCount: 0,
              completedTasksWeek: 0,
            });
          }
        }
      } catch (wsErr) {
        console.warn('[API /team GET] Workspace members read fallback:', (wsErr as any)?.message || wsErr);
      }
    }

    let team = Array.from(sdrMap.values());
    if (team.length === 0) {
      team = [
        {
          id: 'sdr_current',
          name: 'Abhay SDR',
          email: 'abhaysinghrathod06@gmail.com',
          role: 'Outbound SDR',
          initials: 'AS',
          status: 'active',
          assignedLeadsCount: 12,
          activeSequencesCount: 2,
          completedTasksWeek: 8,
        },
        {
          id: 'sdr_sarah',
          name: 'Sarah Jenkins',
          email: 'sarah.jenkins@testgrid.io',
          role: 'Outbound SDR',
          initials: 'SJ',
          status: 'active',
          assignedLeadsCount: 15,
          activeSequencesCount: 3,
          completedTasksWeek: 14,
        },
        {
          id: 'sdr_david',
          name: 'David Kim',
          email: 'david.kim@testgrid.io',
          role: 'Outbound SDR',
          initials: 'DK',
          status: 'active',
          assignedLeadsCount: 9,
          activeSequencesCount: 2,
          completedTasksWeek: 11,
        },
      ];
    }

    teamServerCache.set(cacheKey, {
      team,
      count: team.length,
      cachedAt: Date.now(),
    });

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

