export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceAdmin } from '@/lib/serverAuth';
import { MAX_BATCH } from '@/lib/leadValidation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Admin-only bulk export of the caller's own workspace.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin(req, corsHeaders);
    if (auth.response) return auth.response;
    const { workspaceId } = auth.context;

    const [leadsSnap, seqSnap] = await Promise.all([
      adminDb.collection('leads').where('workspaceId', '==', workspaceId).limit(MAX_BATCH * 5).get(),
      adminDb.collection('sequences').where('workspaceId', '==', workspaceId).limit(500).get(),
    ]);
    const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sequences = seqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return json({
      success: true,
      workspaceId,
      counts: { leadsCount: leads.length, sequencesCount: sequences.length },
      leads,
      sequences,
    });
  } catch (error) {
    console.error('[API /sync GET] Error:', error);
    return json({ error: 'Sync read error' }, 500);
  }
}
