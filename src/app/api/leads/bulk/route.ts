export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { buildCreationExtras, getContext } from '@/lib/crmEngine';
import { cleanObject, normalizeLinkedinUrl, resolveAssignee, str } from '@/lib/leadValidation';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_ROWS = 2000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, email, role, workspaceId } = auth.context;
    const isAdmin = role === 'admin';

    const body = await req.json();
    const rawLeads = body?.leads;
    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      return json({ error: 'No leads provided. An array of leads is required.' }, 400);
    }
    if (rawLeads.length > MAX_ROWS) {
      return json({ error: `At most ${MAX_ROWS} leads can be imported at once.` }, 400);
    }

    // Assignee: admins may pick an active member; everyone else imports into their own list.
    let assignee = { uid, name: str(auth.context.profile?.name, 200) || email.split('@')[0], email };
    if (isAdmin && body.defaultAssignedToId && body.defaultAssignedToId !== uid) {
      const resolved = await resolveAssignee(workspaceId, String(body.defaultAssignedToId));
      if (!resolved) return json({ error: 'defaultAssignedToId is not an active member of this workspace.' }, 400);
      assignee = resolved;
    }

    let sequenceId: string | null = null;
    let sequenceName: string | null = null;
    if (body.defaultSequenceId) {
      const seqSnap = await adminDb.collection('sequences').doc(String(body.defaultSequenceId)).get();
      const seq = seqSnap.data();
      if (!seqSnap.exists || !seq || seq.workspaceId !== workspaceId) {
        return json({ error: 'Unknown sequence.' }, 400);
      }
      if (!isAdmin && seq.approvalStatus !== 'approved') {
        return json({ error: 'Sequence is not approved.' }, 403);
      }
      sequenceId = seqSnap.id;
      sequenceName = seq.name || null;
    }

    const now = new Date().toISOString();
    const rejected: { row: number; reason: string }[] = [];
    const seenUrls = new Set<string>();
    const accepted: Record<string, any>[] = [];

    rawLeads.forEach((item: any, idx: number) => {
      const firstName = str(item?.firstName, 200);
      const company = str(item?.company, 200);
      if (!firstName || !company) {
        rejected.push({ row: idx + 1, reason: 'First name and company are required.' });
        return;
      }
      let linkedinUrl = '';
      if (item.linkedinUrl) {
        const normalized = normalizeLinkedinUrl(item.linkedinUrl);
        if (!normalized) {
          rejected.push({ row: idx + 1, reason: 'Invalid LinkedIn URL.' });
          return;
        }
        if (seenUrls.has(normalized)) {
          rejected.push({ row: idx + 1, reason: 'Duplicate LinkedIn URL in file.' });
          return;
        }
        seenUrls.add(normalized);
        linkedinUrl = normalized;
      }
      accepted.push({
        id: `lead_${randomUUID()}`,
        firstName,
        lastName: str(item.lastName, 200),
        company,
        jobTitle: str(item.jobTitle, 200) || 'Prospect',
        email: null,
        phone: null,
        linkedinUrl,
        channel: 'linkedin' as const,
        sequenceId,
        sequenceName,
        currentStepNumber: sequenceId ? 1 : 0,
        totalSteps: 4,
        connectionStatus: 'not_started',
        outreachStatus: sequenceId ? 'in_sequence' : 'unassigned',
        disposition: 'active',
        notes: str(item.notes, 5000),
        capturedBy: email,
        capturedByUid: uid,
        assignedToId: assignee.uid,
        assignedToName: assignee.name,
        assignedToEmail: assignee.email,
        workspaceId,
        nextFollowUpDate: null,
        nextActionTitle: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Skip leads whose LinkedIn URL already exists in this workspace.
    const urls = accepted.map((l) => l.linkedinUrl).filter(Boolean);
    const existingUrls = new Set<string>();
    for (let i = 0; i < urls.length; i += 30) {
      const chunk = urls.slice(i, i + 30);
      const snap = await adminDb
        .collection('leads')
        .where('workspaceId', '==', workspaceId)
        .where('linkedinUrl', 'in', chunk)
        .select('linkedinUrl')
        .get();
      snap.docs.forEach((d) => existingUrls.add(d.data().linkedinUrl));
    }
    const toWrite = accepted.filter((l) => {
      if (l.linkedinUrl && existingUrls.has(l.linkedinUrl)) {
        rejected.push({ row: rawLeads.findIndex((r: any) => normalizeLinkedinUrl(r?.linkedinUrl) === l.linkedinUrl) + 1, reason: 'Lead already exists in workspace.' });
        return false;
      }
      return true;
    });

    // Each imported lead gets a 'lead captured' activity and, if a sequence was chosen, its first task.
    // Chunked so a batch (lead + activity + task per lead) stays well under Firestore's 500-write limit.
    let seqDoc: Record<string, any> | null = null;
    if (sequenceId) {
      const seqSnap = await adminDb.collection('sequences').doc(sequenceId).get();
      seqDoc = { id: seqSnap.id, ...seqSnap.data() };
    }
    const planCtx = await getContext({ uid, email, name: assignee.name, role, workspaceId });
    const createdTasks: Record<string, any>[] = [];
    const createdActivities: Record<string, any>[] = [];
    const CHUNK = 150;
    for (let i = 0; i < toWrite.length; i += CHUNK) {
      const batch = adminDb.batch();
      for (const lead of toWrite.slice(i, i + CHUNK)) {
        batch.set(adminDb.collection('leads').doc(lead.id), cleanObject(lead));
        const extras = buildCreationExtras(lead, seqDoc, planCtx);
        extras.tasks.forEach((t) => batch.set(adminDb.collection('tasks').doc(t.id), t));
        extras.activities.forEach((a) => batch.set(adminDb.collection('activities').doc(a.id), a));
        createdTasks.push(...extras.tasks);
        createdActivities.push(...extras.activities);
      }
      await batch.commit();
    }

    return json(
      {
        success: true,
        count: toWrite.length,
        skipped: rejected.length,
        rejected: rejected.slice(0, 100),
        leads: toWrite,
        tasks: createdTasks,
        activities: createdActivities,
        message: `Imported ${toWrite.length} lead(s); skipped ${rejected.length}.`,
      },
      201
    );
  } catch (err) {
    console.error('[API /leads/bulk POST] Error:', err);
    return json({ error: 'Failed to bulk import leads' }, 500);
  }
}
