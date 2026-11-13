export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { buildCreationExtras, deleteLeadDependents, getContext } from '@/lib/crmEngine';
import { AWAITING_CONNECTION, buildActivity, buildTask, isDateString } from '@/lib/crmPlanner';
import {
  MAX_BATCH,
  canAccessLead,
  cleanObject,
  normalizeLinkedinUrl,
  resolveAssignee,
  sanitizeLeadUpdate,
  str,
} from '@/lib/leadValidation';

// Responses are not credentialed (no Allow-Credentials), so browsers never attach cookies to
// cross-origin calls; the Chrome extension authenticates with a Bearer token.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const MAX_CUSTOM_STEPS = 20;

// Fields only the workflow actions may change, and the statuses a user may set by hand.
const WORKFLOW_FIELDS = ['sequenceId', 'sequenceName', 'currentStepNumber', 'totalSteps', 'sequenceMode', 'customSteps'];
const MANUAL_OUTREACH_STATUSES = ['stopped', 'paused', 'completed'];

const CONNECTION_STATUSES = [
  'not_started', 'pending', 'request_pending', 'request_sent', 'connected', 'declined', 'verified', 'not_connected',
];
const OUTREACH_STATUSES = [
  'unassigned', 'in_sequence', 'approval_pending', 'pending_sequence_approval', 'needs_sequence',
  'message_sent', 'followup_due', 'replied', 'completed', 'paused', 'stopped',
];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, role, workspaceId } = auth.context;

    const parsedLimit = parseInt(req.nextUrl.searchParams.get('limit') || '', 10);
    const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT, MAX_LIMIT);
    const isDueToday =
      req.nextUrl.searchParams.get('dueToday') === 'true' || req.nextUrl.searchParams.get('filter') === 'today';

    // Tenant and ownership scoping happens in the query itself: admins see the workspace,
    // everyone else only the leads assigned to them.
    let q: Query<DocumentData> = adminDb.collection('leads').where('workspaceId', '==', workspaceId);
    if (role !== 'admin') {
      q = q.where('assignedToId', '==', uid);
    }
    // Stable cursor pagination by document id (equality filters only, so no composite index is needed).
    q = q.orderBy(FieldPath.documentId());
    const cursor = req.nextUrl.searchParams.get('cursor');
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.limit(limit).get();
    const nextCursor = snap.size === limit ? snap.docs[snap.size - 1].id : null;

    let leads: Record<string, any>[] = snap.docs.map((d) => {
      const l = { id: d.id, ...d.data() } as Record<string, any>;
      const assignedEmail = l.assignedToEmail || l.capturedBy || null;
      return {
        ...l,
        assignedToId: l.assignedToId || l.capturedByUid || null,
        assignedToEmail: assignedEmail,
        assignedToName: l.assignedToName || (assignedEmail ? String(assignedEmail).split('@')[0] : 'Unassigned'),
        outreachStatus:
          !l.sequenceId && l.outreachStatus === 'in_sequence'
            ? 'unassigned'
            : l.outreachStatus || (l.sequenceId ? 'in_sequence' : 'unassigned'),
      };
    });

    if (isDueToday) {
      const todayStr = new Date().toISOString().split('T')[0];
      leads = leads.filter((l) => {
        if (l.disposition === 'archived') return false;
        return (
          l.outreachStatus === 'needs_sequence' ||
          l.outreachStatus === 'followup_due' ||
          l.outreachStatus === 'in_sequence' ||
          Boolean(l.nextFollowUpDate && l.nextFollowUpDate <= todayStr)
        );
      });
    }

    return json({ success: true, count: leads.length, leads, nextCursor });
  } catch (err) {
    console.error('[API /leads GET] Error:', err);
    return json({ error: 'Failed to fetch leads' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, email, role, workspaceId } = auth.context;
    const isAdmin = role === 'admin';

    const body = await req.json();
    const firstName = str(body.firstName, 200);
    const company = str(body.company, 200);
    if (!firstName || !company) {
      return json({ error: 'First name and company name are required.' }, 400);
    }

    let linkedinUrl = '';
    if (body.linkedinUrl) {
      const normalized = normalizeLinkedinUrl(body.linkedinUrl);
      if (!normalized) return json({ error: 'linkedinUrl must be a valid https://linkedin.com URL.' }, 400);
      linkedinUrl = normalized;
    }
    const emailValue = str(body.email, 254);
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return json({ error: 'Invalid email address.' }, 400);
    }

    // Assignee: admins may assign to any active member; everyone else owns what they create.
    let assignee = { uid, name: str(auth.context.profile?.name, 200) || email.split('@')[0], email };
    if (isAdmin && body.assignedToId && body.assignedToId !== uid) {
      const resolved = await resolveAssignee(workspaceId, String(body.assignedToId));
      if (!resolved) return json({ error: 'assignedToId is not an active member of this workspace.' }, 400);
      assignee = resolved;
    }

    // Duplicate detection is strictly inside the caller's workspace.
    let existingId: string | null = null;
    let existing: Record<string, any> | null = null;

    if (typeof body.id === 'string' && body.id) {
      const snap = await adminDb.collection('leads').doc(body.id).get();
      if (snap.exists && snap.data()?.workspaceId === workspaceId) {
        existingId = snap.id;
        existing = snap.data() as Record<string, any>;
      }
    }
    if (!existingId && linkedinUrl) {
      const raw = str(body.linkedinUrl, 500);
      const candidates = Array.from(new Set([linkedinUrl, raw].filter(Boolean)));
      const dup = await adminDb
        .collection('leads')
        .where('workspaceId', '==', workspaceId)
        .where('linkedinUrl', 'in', candidates)
        .limit(1)
        .get();
      if (!dup.empty) {
        existingId = dup.docs[0].id;
        existing = dup.docs[0].data() as Record<string, any>;
      }
    }
    if (existing && !canAccessLead(existing, { uid, role, workspaceId })) {
      return json({ error: 'A lead with this LinkedIn profile already exists in the workspace.' }, 409);
    }

    const now = new Date().toISOString();
    const isCustomSeq = body.sequenceMode === 'custom' || body.outreachStatus === 'pending_sequence_approval';
    const leadId = existingId || `lead_${randomUUID()}`;
    const customSeqId = `seq_custom_${leadId}`;

    // A referenced (non-custom) sequence must exist in this workspace and be approved.
    let sequenceId: string | null = isCustomSeq ? customSeqId : (body.sequenceId ? String(body.sequenceId) : existing?.sequenceId || null);
    let sequenceName: string | null = existing?.sequenceName || null;
    let seqDoc: Record<string, any> | null = null;
    if (!isCustomSeq && body.sequenceId) {
      const seqSnap = await adminDb.collection('sequences').doc(String(body.sequenceId)).get();
      const seq = seqSnap.data();
      if (!seqSnap.exists || !seq || seq.workspaceId !== workspaceId) {
        return json({ error: 'Unknown sequence.' }, 400);
      }
      if (!isAdmin && seq.approvalStatus !== 'approved' && seq.createdByUid !== uid) {
        return json({ error: 'Sequence is not approved.' }, 403);
      }
      sequenceId = seqSnap.id;
      sequenceName = seq.name || null;
      seqDoc = { id: seqSnap.id, ...seq };
    }

    const connectionNote = str(body.connectionNote, 1000) || existing?.connectionNote || null;
    const isConnSent = Boolean(body.isConnectionSent) || body.connectionStatus === 'request_sent' || Boolean(connectionNote);
    const requestedConn = CONNECTION_STATUSES.includes(body.connectionStatus) ? body.connectionStatus : null;
    const connectionStatus = isConnSent ? 'request_sent' : requestedConn || existing?.connectionStatus || 'not_started';
    const requestedOutreach = OUTREACH_STATUSES.includes(body.outreachStatus) ? body.outreachStatus : null;
    const outreachStatus =
      !sequenceId && requestedOutreach === 'in_sequence'
        ? 'unassigned'
        : requestedOutreach || existing?.outreachStatus || (sequenceId ? 'in_sequence' : 'unassigned');
    const currentStepNumber =
      isConnSent && sequenceId ? 2 : Number.isInteger(body.currentStepNumber) && body.currentStepNumber >= 0
        ? Math.min(body.currentStepNumber, MAX_CUSTOM_STEPS + 1)
        : existing?.currentStepNumber ?? (sequenceId ? 1 : 0);
    const defaultFollowUp =
      isConnSent && sequenceId ? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] : null;

    let defaultActionTitle: string | null = null;
    if (outreachStatus === 'needs_sequence') defaultActionTitle = 'Draft Follow-up Cadence';
    else if (outreachStatus === 'pending_sequence_approval') defaultActionTitle = 'Awaiting Admin Approval';
    else if (isConnSent) defaultActionTitle = 'Step 2: Follow-up 1';

    const lastName = str(body.lastName, 200) || existing?.lastName || '';
    const newLead = {
      ...(existing || {}),
      id: leadId,
      firstName,
      lastName,
      company,
      jobTitle: str(body.jobTitle, 200) || existing?.jobTitle || 'Prospect',
      email: emailValue || existing?.email || null,
      phone: str(body.phone, 50) || existing?.phone || null,
      linkedinUrl: linkedinUrl || existing?.linkedinUrl || '',
      channel: 'linkedin' as const,
      sequenceId,
      sequenceName: isCustomSeq ? `Custom Cadence: ${firstName} ${lastName}`.trim() : sequenceName,
      sequenceMode: isCustomSeq ? 'custom' : existing?.sequenceMode || (sequenceId ? 'approved' : null),
      connectionNote,
      currentStepNumber,
      totalSteps: Number.isInteger(body.totalSteps) && body.totalSteps > 0 ? Math.min(body.totalSteps, 50) : existing?.totalSteps || 4,
      connectionStatus,
      connectionSentAt: existing?.connectionSentAt || (connectionStatus === 'request_sent' ? now : null),
      outreachStatus,
      disposition: str(body.disposition, 50) || existing?.disposition || 'active',
      notes: str(body.notes, 5000) || (connectionNote ? `Connection note: ${connectionNote}` : existing?.notes || 'Added to LeadFlow pipeline'),
      capturedBy: existing?.capturedBy || email,
      capturedByUid: existing?.capturedByUid || uid,
      assignedToId: existing?.assignedToId || assignee.uid,
      assignedToName: existing?.assignedToName || assignee.name,
      assignedToEmail: existing?.assignedToEmail || assignee.email,
      workspaceId,
      nextFollowUpDate: str(body.nextFollowUpDate, 10) || existing?.nextFollowUpDate || defaultFollowUp,
      nextActionTitle: str(body.nextActionTitle, 200) || defaultActionTitle,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    // Admins may reassign an existing lead explicitly.
    if (existing && isAdmin && body.assignedToId && body.assignedToId !== existing.assignedToId) {
      const resolved = await resolveAssignee(workspaceId, String(body.assignedToId));
      if (!resolved) return json({ error: 'assignedToId is not an active member of this workspace.' }, 400);
      newLead.assignedToId = resolved.uid;
      newLead.assignedToName = resolved.name;
      newLead.assignedToEmail = resolved.email;
    }

    const batch = adminDb.batch();

    if (isCustomSeq) {
      const existingSeq = await adminDb.collection('sequences').doc(customSeqId).get();
      if (existingSeq.exists && existingSeq.data()?.workspaceId !== workspaceId) {
        return json({ error: 'Sequence id conflict.' }, 409);
      }
      const noteText = connectionNote || '';
      const rawSteps: any[] = Array.isArray(body.customSteps) ? body.customSteps.slice(0, MAX_CUSTOM_STEPS) : [];
      const steps: any[] = [
        { stepNumber: 1, actionType: 'connection_request', title: 'Connection Request', delayDays: 0, messageTemplate: noteText, enabled: true },
      ];
      const followUps = rawSteps.filter((s) => s && !(s.stepNumber === 1 || s.actionType === 'connection_request'));
      if (followUps.length === 0) {
        steps.push({
          stepNumber: 2,
          actionType: 'send_message',
          title: 'First Follow-up',
          delayDays: 3,
          messageTemplate: `Hi ${firstName}, thanks for connecting! Following up to see if you had a moment to review how we help teams at ${company}.`,
          enabled: true,
        });
      } else {
        followUps.forEach((s, idx) => {
          steps.push({
            stepNumber: idx + 2,
            actionType: str(s.actionType, 40) || 'send_message',
            title: str(s.title, 200) || `Follow-up ${idx + 1}`,
            delayDays: Number.isFinite(s.delayDays) && s.delayDays >= 0 ? Math.min(s.delayDays, 365) : idx === 0 ? 3 : 7,
            messageTemplate: str(s.messageTemplate, 3000),
            enabled: true,
          });
        });
      }
      const leadName = `${firstName} ${lastName}`.trim();
      batch.set(
        adminDb.collection('sequences').doc(customSeqId),
        {
          id: customSeqId,
          name: `Custom Cadence: ${leadName}`,
          channel: 'linkedin',
          description: `Bespoke 1:1 cadence created by ${email} for ${leadName} at ${company}`,
          steps,
          status: 'pending_approval',
          approvalStatus: 'pending',
          workspaceId,
          createdBy: email,
          createdByUid: uid,
          createdByRole: role,
          targetRole: 'sdr',
          isCustom: true,
          targetLeadId: leadId,
          targetLeadName: leadName,
          targetLeadCompany: company,
          targetLeadLinkedin: newLead.linkedinUrl,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      newLead.sequenceId = customSeqId;
    }

    batch.set(adminDb.collection('leads').doc(leadId), cleanObject(newLead), { merge: true });

    // Side effects that belong to creating a lead (activity log, first task) are written in the same batch.
    const planCtx = await getContext({ uid, email, name: assignee.name, role, workspaceId });
    const createdTasks: Record<string, any>[] = [];
    const createdActivities: Record<string, any>[] = [];

    if (!existing) {
      const extras = buildCreationExtras(newLead, seqDoc, planCtx);
      createdTasks.push(...extras.tasks);
      createdActivities.push(...extras.activities);
    }

    if (connectionNote) {
      createdActivities.push(
        buildActivity(newLead, {
          type: 'linkedin_connect',
          title: 'LinkedIn Connection Note Sent',
          description: connectionNote,
          actorName: newLead.assignedToName || email,
        }, planCtx)
      );
    }

    if (outreachStatus === 'needs_sequence') {
      createdTasks.push(
        buildTask(newLead, {
          title: `Draft Follow-up Cadence for ${firstName} ${lastName}`.trim(),
          type: 'manual_review',
          dueDate: planCtx.today,
          notes: connectionNote
            ? `Connection sent with note: "${connectionNote}"`
            : 'Connection request sent on LinkedIn. Needs follow-up sequence.',
        }, planCtx)
      );
    }

    createdTasks.forEach((t) => batch.set(adminDb.collection('tasks').doc(t.id), t));
    createdActivities.forEach((a) => batch.set(adminDb.collection('activities').doc(a.id), a));

    await batch.commit();

    return json(
      { success: true, message: 'Lead saved', lead: newLead, tasks: createdTasks, activities: createdActivities },
      existing ? 200 : 201
    );
  } catch (error) {
    console.error('[API /leads POST] Error:', error);
    return json({ error: 'Failed to process lead' }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, role, workspaceId } = auth.context;
    const isAdmin = role === 'admin';
    const now = new Date().toISOString();

    const body = await req.json();
    const items: Record<string, any>[] = Array.isArray(body?.leads)
      ? body.leads.filter((i: any) => i && typeof i.id === 'string' && i.id)
      : body && typeof body.id === 'string' && body.id
        ? [body]
        : [];

    if (items.length === 0) {
      return json({ error: 'Lead id or leads array is required' }, 400);
    }
    if (items.length > MAX_BATCH) {
      return json({ error: `At most ${MAX_BATCH} leads can be updated per request.` }, 400);
    }

    const refs = items.map((i) => adminDb.collection('leads').doc(i.id));
    const snaps = await adminDb.getAll(...refs);

    const batch = adminDb.batch();
    const updated: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const snap = snaps[i];
      // Missing, other-workspace and not-yours all look identical to the caller.
      if (!snap.exists || !canAccessLead(snap.data(), { uid, role, workspaceId })) {
        return json({ error: `Lead not found: ${items[i].id}` }, 404);
      }
      const result = sanitizeLeadUpdate(items[i], isAdmin);
      if ('error' in result) return json({ error: result.error }, 400);

      // Sequence progress is workflow state owned by the server actions (enroll / advance / reply / approve).
      for (const f of WORKFLOW_FIELDS) delete result.updates[f];
      if ('outreachStatus' in result.updates) {
        const next = result.updates.outreachStatus as string;
        const cur = snap.data() || {};
        const resuming = next === 'in_sequence' && cur.outreachStatus === 'paused' && Boolean(cur.sequenceId);
        if (!MANUAL_OUTREACH_STATUSES.includes(next) && !resuming) {
          return json({ error: `outreachStatus "${next}" is managed by the workflow and cannot be set directly.` }, 400);
        }
      }
      if ('connectionStatus' in result.updates && !CONNECTION_STATUSES.includes(result.updates.connectionStatus as string)) {
        return json({ error: 'Invalid connectionStatus.' }, 400);
      }
      if (AWAITING_CONNECTION.includes(result.updates.connectionStatus as string) && !snap.data()?.connectionSentAt) {
        result.updates.connectionSentAt = now; // lets the extension list "sent, not accepted" newest first
      }
      if ('nextFollowUpDate' in result.updates && result.updates.nextFollowUpDate !== null && !isDateString(result.updates.nextFollowUpDate)) {
        return json({ error: 'nextFollowUpDate must be YYYY-MM-DD or null.' }, 400);
      }

      const updates: Record<string, unknown> = { ...result.updates, updatedAt: now };
      if (isAdmin && 'assignedToId' in updates && updates.assignedToId !== snap.data()?.assignedToId) {
        const resolved = await resolveAssignee(workspaceId, String(updates.assignedToId));
        if (!resolved) return json({ error: 'assignedToId is not an active member of this workspace.' }, 400);
        updates.assignedToId = resolved.uid;
        updates.assignedToName = resolved.name;
        updates.assignedToEmail = resolved.email;
      }
      batch.update(refs[i], updates);

      // Moving the follow-up date also moves the lead's open sequence task, so the queue and lead agree.
      if (typeof updates.nextFollowUpDate === 'string') {
        const openTasks = await adminDb
          .collection('tasks')
          .where('workspaceId', '==', workspaceId)
          .where('leadId', '==', items[i].id)
          .where('status', '==', 'pending')
          .get();
        openTasks.docs
          .filter((d) => d.data().sequenceId)
          .forEach((d) => batch.update(d.ref, { dueDate: updates.nextFollowUpDate, updatedAt: now }));
      }
      updated.push({ id: items[i].id, ...updates });
    }
    await batch.commit();

    return Array.isArray(body?.leads)
      ? json({ success: true, count: updated.length })
      : json({ success: true, lead: updated[0] });
  } catch (err) {
    console.error('[API /leads PATCH] Error:', err);
    return json({ error: 'Update failed' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, role, workspaceId } = auth.context;

    const { searchParams } = new URL(req.url);
    const ids = new Set<string>();
    const queryId = searchParams.get('id');
    if (queryId) ids.add(queryId);
    searchParams
      .get('ids')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));

    try {
      const body = await req.json();
      if (typeof body?.id === 'string' && body.id) ids.add(body.id);
      if (Array.isArray(body?.ids)) {
        body.ids.forEach((id: unknown) => typeof id === 'string' && id.trim() && ids.add(id.trim()));
      }
    } catch {
      // Body is optional
    }

    if (ids.size === 0) {
      return json({ error: 'Lead id or ids parameter is required' }, 400);
    }
    if (ids.size > MAX_BATCH) {
      return json({ error: `At most ${MAX_BATCH} leads can be deleted per request.` }, 400);
    }

    const refs = Array.from(ids).map((id) => adminDb.collection('leads').doc(id));
    const snaps = await adminDb.getAll(...refs);
    const batch = adminDb.batch();
    let deletedCount = 0;
    const deletedIds: string[] = [];
    snaps.forEach((snap, i) => {
      if (snap.exists && canAccessLead(snap.data(), { uid, role, workspaceId })) {
        batch.delete(refs[i]);
        deletedIds.push(snap.id);
        deletedCount++;
      }
    });
    if (deletedCount === 0) {
      return json({ error: 'Lead not found' }, 404);
    }
    await batch.commit();
    // Don't leave orphaned tasks or activity behind.
    await deleteLeadDependents(workspaceId, deletedIds);

    return json({ success: true, message: `Deleted ${deletedCount} lead(s)`, deletedCount, deletedIds });
  } catch (error) {
    console.error('[API /leads DELETE] Error:', error);
    return json({ error: 'Failed to delete lead' }, 500);
  }
}
