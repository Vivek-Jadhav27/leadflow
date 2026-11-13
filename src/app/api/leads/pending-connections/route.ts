export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { listPendingConnections } from '@/lib/crmEngine';
import { actorFrom, respond } from '@/lib/crmHttp';

// Called by the Chrome extension (Bearer token); not credentialed, so a wildcard origin is safe.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/leads/pending-connections?limit=15
// The caller's own leads whose connection request is sent but not yet accepted, newest first.
export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceMember(req, corsHeaders);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);
  const parsed = parseInt(req.nextUrl.searchParams.get('limit') || '', 10);

  const res = await respond(
    async () => ({ success: true, ...(await listPendingConnections(actor, Number.isFinite(parsed) && parsed > 0 ? parsed : 15)) }),
    'API /leads/pending-connections'
  );
  Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
