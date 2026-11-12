export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceAdmin } from '@/lib/serverAuth';
import { MAX_BATCH, cleanObject, sanitizeLeadUpdate, str } from '@/lib/leadValidation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_RECORDS = 400;

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

// Admin-only upsert. Every record is forced into the caller's workspace, and an id that already
// exists in another workspace is rejected rather than overwritten.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin(req, corsHeaders);
    if (auth.response) return auth.response;
    const { workspaceId } = auth.context;

    const body = await req.json();
    const leads: any[] = Array.isArray(body?.leads) ? body.leads.filter((l: any) => l && typeof l.id === 'string' && l.id) : [];
    const sequences: any[] = Array.isArray(body?.sequences) ? body.sequences.filter((s: any) => s && typeof s.id === 'string' && s.id) : [];

    if (leads.length + sequences.length > MAX_RECORDS) {
      return json({ error: `At most ${MAX_RECORDS} records can be synced per request.` }, 400);
    }

    const leadRefs = leads.map((l) => adminDb.collection('leads').doc(l.id));
    const seqRefs = sequences.map((s) => adminDb.collection('sequences').doc(s.id));
    const [leadSnaps, seqSnaps] = await Promise.all([
      leadRefs.length ? adminDb.getAll(...leadRefs) : Promise.resolve([]),
      seqRefs.length ? adminDb.getAll(...seqRefs) : Promise.resolve([]),
    ]);

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    for (let i = 0; i < leads.length; i++) {
      const snap = leadSnaps[i];
      if (snap.exists && snap.data()?.workspaceId !== workspaceId) {
        return json({ error: `Lead id conflict: ${leads[i].id}` }, 409);
      }
      const result = sanitizeLeadUpdate(leads[i], true);
      if ('error' in result) return json({ error: `${result.error} (lead ${leads[i].id})` }, 400);
      const data: Record<string, unknown> = { ...result.updates, workspaceId, updatedAt: now };
      if (!snap.exists) data.createdAt = now;
      batch.set(leadRefs[i], data, { merge: true });
    }

    for (let i = 0; i < sequences.length; i++) {
      const snap = seqSnaps[i];
      if (snap.exists && snap.data()?.workspaceId !== workspaceId) {
        return json({ error: `Sequence id conflict: ${sequences[i].id}` }, 409);
      }
      const s = sequences[i];
      const data = cleanObject({
        name: str(s.name, 200),
        description: str(s.description, 1000),
        steps: Array.isArray(s.steps) ? s.steps.slice(0, 50) : undefined,
        status: str(s.status, 40) || undefined,
        approvalStatus: s.approvalStatus === 'approved' ? 'approved' : 'pending',
        targetRole: ['all', 'sdr', 'ae'].includes(s.targetRole) ? s.targetRole : undefined,
        workspaceId,
        updatedAt: now,
        ...(snap.exists ? {} : { createdAt: now, createdBy: auth.context.email, createdByUid: auth.context.uid }),
      });
      batch.set(seqRefs[i], data, { merge: true });
    }

    if (leads.length + sequences.length > 0) await batch.commit();

    return json({
      success: true,
      message: `Synchronized ${leads.length + sequences.length} record(s).`,
      syncedCount: leads.length + sequences.length,
      syncedLeads: leads.length,
      syncedSequences: sequences.length,
      workspaceId,
    });
  } catch (error) {
    console.error('[API /sync POST] Error:', error);
    return json({ error: 'Sync write error' }, 500);
  }
}
