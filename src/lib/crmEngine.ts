/**
 * Server-side CRM workflow engine. Every state transition of a lead, its sequence enrolment, tasks
 * and activity log happens here, inside a Firestore transaction, using the pure rules in crmPlanner.
 * The browser never computes or owns workflow state: it sends an intent and renders the result.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { canAccessLead, editorStamp, resolveAssignee, sanitizeSteps } from '@/lib/leadValidation';
import {
  Actor,
  Doc,
  Plan,
  PlanContext,
  PlanError,
  buildActivity,
  buildTask,
  defaultNewId,
  isDateString,
  parseTimezone,
  planActivateAfterApproval,
  planAdvance,
  planArchive,
  planAssign,
  planEnroll,
  activeSteps,
  addDays,
  buildStepTask,
  planEnrich,
  planReply,
  planUnenroll,
  shouldAdvanceOnComplete,
  todayInZone,
} from '@/lib/crmPlanner';

export { PlanError } from '@/lib/crmPlanner';
export type { Actor } from '@/lib/crmPlanner';

/** Everything the client needs to update its cache after a mutation. */
export interface EngineResult {
  lead?: Doc;
  leads?: Doc[];
  sequence?: Doc;
  tasks: Doc[];
  activities: Doc[];
  deletedTaskIds?: string[];
  errors?: { id: string; message: string }[];
}

const TASK_STATUSES = ['pending', 'completed', 'skipped', 'held', 'cancelled'];
const TASK_PRIORITIES = ['high', 'medium', 'low'];

export async function getWorkspaceTimezone(workspaceId: string): Promise<string> {
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  return parseTimezone(snap.data()?.settings?.timezone);
}

async function makeContext(actor: Actor): Promise<PlanContext> {
  const tz = await getWorkspaceTimezone(actor.workspaceId);
  const nowDate = new Date();
  return { actor, now: nowDate.toISOString(), today: todayInZone(tz, nowDate), newId: defaultNewId };
}

// ---- transaction helpers (all reads must happen before any write) -------------------------------

async function readLead(tx: Transaction, actor: Actor, leadId: string): Promise<Doc> {
  const snap = await tx.get(adminDb.collection('leads').doc(leadId));
  const data = snap.data();
  // Missing, other-workspace and not-yours are indistinguishable to the caller.
  if (!snap.exists || !data || !canAccessLead(data, actor)) {
    throw new PlanError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
  }
  return { id: snap.id, ...data };
}

async function readPendingTasks(tx: Transaction, actor: Actor, leadId: string): Promise<Doc[]> {
  const snap = await tx.get(
    adminDb
      .collection('tasks')
      .where('workspaceId', '==', actor.workspaceId)
      .where('leadId', '==', leadId)
      .where('status', '==', 'pending')
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function readSequence(tx: Transaction, actor: Actor, sequenceId: string): Promise<Doc | null> {
  const snap = await tx.get(adminDb.collection('sequences').doc(sequenceId));
  const data = snap.data();
  if (!snap.exists || !data || data.workspaceId !== actor.workspaceId) return null;
  return { id: snap.id, ...data };
}

function writePlan(tx: Transaction, lead: Doc, existingTasks: Doc[], plan: Plan): EngineResult {
  tx.update(adminDb.collection('leads').doc(lead.id), plan.leadUpdate);

  const changedTasks: Doc[] = [];
  for (const u of plan.taskUpdates) {
    tx.update(adminDb.collection('tasks').doc(u.id), u.data);
    const prev = existingTasks.find((t) => t.id === u.id) || { id: u.id };
    changedTasks.push({ ...prev, ...u.data });
  }
  for (const t of plan.newTasks) {
    tx.create(adminDb.collection('tasks').doc(t.id), t);
    changedTasks.push(t);
  }
  for (const a of plan.newActivities) {
    tx.create(adminDb.collection('activities').doc(a.id), a);
  }
  return {
    lead: { ...lead, ...plan.leadUpdate },
    tasks: changedTasks,
    activities: plan.newActivities,
  };
}

async function runLeadTransition(
  actor: Actor,
  leadId: string,
  build: (args: { tx: Transaction; lead: Doc; pending: Doc[]; ctx: PlanContext }) => Promise<Plan>
): Promise<EngineResult> {
  const ctx = await makeContext(actor);
  return adminDb.runTransaction(async (tx) => {
    const lead = await readLead(tx, actor, leadId);
    const pending = await readPendingTasks(tx, actor, leadId);
    const plan = await build({ tx, lead, pending, ctx });
    return writePlan(tx, lead, pending, plan);
  });
}

// ---- lead workflow ------------------------------------------------------------------------------

export function advanceLead(actor: Actor, leadId: string, opts: { expectedStep?: number } = {}) {
  return runLeadTransition(actor, leadId, async ({ tx, lead, pending, ctx }) => {
    const seq = lead.sequenceId ? await readSequence(tx, actor, lead.sequenceId) : null;
    return planAdvance(lead, seq, pending, ctx, opts);
  });
}

export function enrollLead(actor: Actor, leadId: string, sequenceId: string | null) {
  return runLeadTransition(actor, leadId, async ({ tx, lead, pending, ctx }) => {
    if (!sequenceId) return planUnenroll(lead, pending, ctx);
    const seq = await readSequence(tx, actor, sequenceId);
    if (!seq) throw new PlanError(404, 'SEQUENCE_NOT_FOUND', 'Sequence not found.');
    // Non-admins may only use approved sequences or ones they created that were approved.
    return planEnroll(lead, seq, pending, ctx);
  });
}

export function recordReply(actor: Actor, leadId: string, input: { message?: string; outcome?: string }) {
  return runLeadTransition(actor, leadId, async ({ lead, pending, ctx }) => planReply(lead, pending, input, ctx));
}

export function archiveLead(actor: Actor, leadId: string, archived: boolean) {
  return runLeadTransition(actor, leadId, async ({ lead, ctx }) => planArchive(lead, archived, ctx));
}

export function enrichLead(actor: Actor, leadId: string, enriched: Doc) {
  return runLeadTransition(actor, leadId, async ({ lead, pending, ctx }) => planEnrich(lead, pending, enriched, ctx));
}

/** Appends a free-form entry (note, status change, ...) to a lead's activity log. */
export async function recordActivity(
  actor: Actor,
  leadId: string,
  input: { type: string; title: string; description: string }
): Promise<EngineResult> {
  const ctx = await makeContext(actor);
  return adminDb.runTransaction(async (tx) => {
    const lead = await readLead(tx, actor, leadId);
    const activity = buildActivity(lead, input, ctx);
    tx.create(adminDb.collection('activities').doc(activity.id), activity);
    return { tasks: [], activities: [activity] };
  });
}

/** Admin-only reassignment. The new owner must be an active member of the workspace. */
export async function assignLeads(actor: Actor, leadIds: string[], assigneeUid: string): Promise<EngineResult> {
  if (actor.role !== 'admin') throw new PlanError(403, 'FORBIDDEN', 'Only admins can reassign leads.');
  const assignee = await resolveAssignee(actor.workspaceId, assigneeUid);
  if (!assignee) throw new PlanError(400, 'BAD_ASSIGNEE', 'The assignee is not an active member of this workspace.');
  return runMany(actor, leadIds, (id) =>
    runLeadTransition(actor, id, async ({ lead, pending, ctx }) => planAssign(lead, assignee, pending, ctx))
  );
}

export function archiveLeads(actor: Actor, leadIds: string[], archived: boolean) {
  return runMany(actor, leadIds, (id) => archiveLead(actor, id, archived));
}

export function enrollLeads(actor: Actor, leadIds: string[], sequenceId: string | null) {
  return runMany(actor, leadIds, (id) => enrollLead(actor, id, sequenceId));
}

/** Runs one transaction per lead so a single bad lead never blocks the rest; reports per-lead errors. */
async function runMany(actor: Actor, ids: string[], run: (id: string) => Promise<EngineResult>): Promise<EngineResult> {
  const out: EngineResult = { leads: [], tasks: [], activities: [], errors: [] };
  for (const id of Array.from(new Set(ids))) {
    try {
      const r = await run(id);
      if (r.lead) out.leads!.push(r.lead);
      out.tasks.push(...r.tasks);
      out.activities.push(...r.activities);
    } catch (err) {
      if (err instanceof PlanError) out.errors!.push({ id, message: err.message });
      else throw err;
    }
  }
  return out;
}

/**
 * A rep proposes a bespoke cadence for one lead. The sequence is created pending admin approval and the
 * lead is parked in 'pending_sequence_approval' at step 2 (its connection request was already sent).
 */
export async function submitCustomSequence(
  actor: Actor,
  leadId: string,
  input: { name?: unknown; steps?: unknown; connectionNote?: unknown }
): Promise<EngineResult> {
  const steps = sanitizeSteps(input.steps);
  if (!steps || steps.length < 2) throw new PlanError(400, 'BAD_SEQUENCE', 'A custom cadence needs at least two steps.');
  const ctx = await makeContext(actor);
  const seqId = `seq_custom_${leadId}`;

  return adminDb.runTransaction(async (tx) => {
    const lead = await readLead(tx, actor, leadId);
    const pending = await readPendingTasks(tx, actor, leadId);
    const existing = await tx.get(adminDb.collection('sequences').doc(seqId));
    if (existing.exists && existing.data()?.workspaceId !== actor.workspaceId) {
      throw new PlanError(409, 'SEQUENCE_CONFLICT', 'Sequence id conflict.');
    }

    const name = (typeof input.name === 'string' && input.name.trim() ? input.name.trim() : `Custom Cadence: ${lead.firstName} ${lead.lastName}`).slice(0, 200);
    const note = typeof input.connectionNote === 'string' ? input.connectionNote.trim().slice(0, 1000) : '';
    const sequence: Doc = {
      id: seqId,
      name,
      channel: 'linkedin',
      description: `Custom outreach cadence created by ${actor.email} for ${lead.firstName} ${lead.lastName} at ${lead.company}`,
      steps,
      status: 'pending_approval',
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
      workspaceId: actor.workspaceId,
      createdBy: actor.email,
      createdByUid: actor.uid,
      createdByRole: actor.role,
      targetRole: 'sdr',
      isCustom: true,
      targetLeadId: lead.id,
      targetLeadName: `${lead.firstName} ${lead.lastName}`.trim(),
      targetLeadCompany: lead.company || '',
      targetLeadLinkedin: lead.linkedinUrl || '',
      enrolledLeadsCount: 0,
      createdAt: existing.data()?.createdAt || ctx.now,
      updatedAt: ctx.now,
      ...editorStamp(actor),
    };

    const leadUpdate: Doc = {
      sequenceId: seqId,
      sequenceName: name,
      currentStepNumber: 2,
      totalSteps: steps.length,
      outreachStatus: 'pending_sequence_approval',
      nextActionTitle: 'Awaiting Admin Approval',
      sequenceMode: 'custom',
      customSteps: steps,
      connectionNote: note || lead.connectionNote || null,
      updatedAt: ctx.now,
    };
    // The "draft a follow-up cadence" to-do is satisfied by submitting one.
    const taskUpdates = pending
      .filter((t) => t.type === 'manual_review' && /^Draft Follow-up Cadence/i.test(t.title || ''))
      .map((t) => ({ id: t.id, data: { status: 'completed', completedAt: ctx.now, updatedAt: ctx.now } }));
    const activity = buildActivity(lead, {
      type: 'sequence_assigned',
      title: 'Custom Cadence Submitted for Admin Approval',
      description: `Bespoke ${steps.length}-step sequence "${name}" submitted for Admin approval by ${actor.email}.`,
    }, ctx);

    tx.set(adminDb.collection('sequences').doc(seqId), sequence);
    const res = writePlan(tx, lead, pending, { leadUpdate, taskUpdates, newTasks: [], newActivities: [activity] });
    return { ...res, sequence };
  });
}

// ---- sequences ----------------------------------------------------------------------------------

/**
 * Approves a sequence (admin only) and activates the leads that were waiting for it. Leads are matched
 * ONLY by explicit links (`sequenceId` or the sequence's `targetLeadId`), never by name.
 */
export async function approveSequence(actor: Actor, sequenceId: string): Promise<EngineResult> {
  if (actor.role !== 'admin') throw new PlanError(403, 'FORBIDDEN', 'Only admins can approve sequences.');
  const ctx = await makeContext(actor);

  const seq: Doc = await adminDb.runTransaction(async (tx): Promise<Doc> => {
    const current = await readSequence(tx, actor, sequenceId);
    if (!current) throw new PlanError(404, 'SEQUENCE_NOT_FOUND', 'Sequence not found.');
    const update = {
      status: 'active',
      approvalStatus: 'approved',
      approvedBy: actor.email || actor.name,
      approvedByUid: actor.uid,
      approvedAt: ctx.now,
      updatedAt: ctx.now,
      ...editorStamp(actor),
    };
    tx.update(adminDb.collection('sequences').doc(sequenceId), update);
    return { ...current, ...update };
  });

  const candidateIds = new Set<string>();
  if (seq.targetLeadId) candidateIds.add(seq.targetLeadId);
  const enrolled = await adminDb
    .collection('leads')
    .where('workspaceId', '==', actor.workspaceId)
    .where('sequenceId', '==', sequenceId)
    .limit(500)
    .get();
  enrolled.docs.forEach((d) => candidateIds.add(d.id));

  const result: EngineResult = { sequence: seq, leads: [], tasks: [], activities: [] };
  for (const leadId of candidateIds) {
    const r = await adminDb.runTransaction(async (tx): Promise<EngineResult | null> => {
      const leadSnap = await tx.get(adminDb.collection('leads').doc(leadId));
      const data = leadSnap.data();
      if (!leadSnap.exists || !data || data.workspaceId !== actor.workspaceId) return null;
      const lead: Doc = { id: leadSnap.id, ...data };
      const pending = await readPendingTasks(tx, actor, leadId);
      const plan = planActivateAfterApproval(lead, seq, pending, ctx, actor.name);
      return plan ? writePlan(tx, lead, pending, plan) : null;
    });
    if (r?.lead) {
      result.leads!.push(r.lead);
      result.tasks.push(...r.tasks);
      result.activities.push(...r.activities);
    }
  }
  return result;
}

// ---- tasks --------------------------------------------------------------------------------------

function canAccessTask(task: Doc | undefined, actor: Actor): boolean {
  if (!task || task.workspaceId !== actor.workspaceId) return false;
  return actor.role === 'admin' || task.assignedToId === actor.uid;
}

export async function createManualTask(
  actor: Actor,
  input: { title?: unknown; leadId?: unknown; type?: unknown; dueDate?: unknown; priority?: unknown; notes?: unknown; assignedToId?: unknown }
): Promise<EngineResult> {
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 300) : '';
  if (!title) throw new PlanError(400, 'BAD_TASK', 'A task title is required.');
  if (typeof input.leadId !== 'string' || !input.leadId) throw new PlanError(400, 'BAD_TASK', 'A lead is required.');
  const ctx = await makeContext(actor);
  const dueDate = input.dueDate === undefined ? ctx.today : input.dueDate;
  if (!isDateString(dueDate)) throw new PlanError(400, 'BAD_TASK', 'dueDate must be YYYY-MM-DD.');

  const leadSnap = await adminDb.collection('leads').doc(input.leadId).get();
  const leadData = leadSnap.data();
  if (!leadSnap.exists || !leadData || !canAccessLead(leadData, actor)) {
    throw new PlanError(404, 'LEAD_NOT_FOUND', 'Lead not found.');
  }
  const lead: Doc = { id: leadSnap.id, ...leadData };

  let assignee = { uid: actor.uid, name: actor.name };
  if (actor.role === 'admin' && typeof input.assignedToId === 'string' && input.assignedToId && input.assignedToId !== actor.uid) {
    const resolved = await resolveAssignee(actor.workspaceId, input.assignedToId);
    if (!resolved) throw new PlanError(400, 'BAD_ASSIGNEE', 'The assignee is not an active member of this workspace.');
    assignee = { uid: resolved.uid, name: resolved.name };
  }

  const task = buildTask(
    lead,
    {
      title,
      type: typeof input.type === 'string' && input.type ? input.type.slice(0, 50) : 'manual_review',
      dueDate,
      priority: TASK_PRIORITIES.includes(input.priority as string) ? input.priority : 'medium',
      notes: typeof input.notes === 'string' ? input.notes.slice(0, 2000) : '',
      assignedToId: assignee.uid,
      assignedToName: assignee.name,
    },
    ctx
  );
  await adminDb.collection('tasks').doc(task.id).create(task);
  return { tasks: [task], activities: [] };
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  patch: { status?: unknown; dueDate?: unknown }
): Promise<EngineResult> {
  const status = patch.status;
  if (status !== undefined && !TASK_STATUSES.includes(status as string)) {
    throw new PlanError(400, 'BAD_TASK', `status must be one of: ${TASK_STATUSES.join(', ')}.`);
  }
  if (patch.dueDate !== undefined && !isDateString(patch.dueDate)) {
    throw new PlanError(400, 'BAD_TASK', 'dueDate must be YYYY-MM-DD.');
  }
  const ctx = await makeContext(actor);

  return adminDb.runTransaction(async (tx) => {
    const taskSnap = await tx.get(adminDb.collection('tasks').doc(taskId));
    const taskData = taskSnap.data();
    if (!taskSnap.exists || !canAccessTask(taskData, actor)) throw new PlanError(404, 'TASK_NOT_FOUND', 'Task not found.');
    const task: Doc = { id: taskSnap.id, ...taskData };

    let lead: Doc | null = null;
    if (task.leadId) {
      const leadSnap = await tx.get(adminDb.collection('leads').doc(task.leadId));
      const ld = leadSnap.data();
      if (leadSnap.exists && ld && ld.workspaceId === actor.workspaceId) lead = { id: leadSnap.id, ...ld };
    }

    // Completing the live step task advances the sequence in the same transaction.
    if (status === 'completed' && task.status !== 'completed') {
      if (lead && shouldAdvanceOnComplete(task, lead)) {
        const seq = await readSequence(tx, actor, lead.sequenceId);
        const pending = await readPendingTasks(tx, actor, lead.id);
        const plan = planAdvance(lead, seq, pending, ctx, { expectedStep: task.stepNumber });
        // Make sure the task being completed is included even if it was 'held'/'overdue'.
        if (!plan.taskUpdates.some((u) => u.id === task.id)) {
          plan.taskUpdates.push({ id: task.id, data: { status: 'completed', completedAt: ctx.now, updatedAt: ctx.now } });
        }
        if (patch.dueDate !== undefined) throw new PlanError(400, 'BAD_TASK', 'Cannot reschedule and complete a task at once.');
        const res = writePlan(tx, lead, [...pending, task], plan);
        const done = { ...task, status: 'completed', completedAt: ctx.now, updatedAt: ctx.now };
        return { ...res, tasks: [done, ...res.tasks.filter((t) => t.id !== task.id)] };
      }
      const update: Doc = { status: 'completed', completedAt: ctx.now, updatedAt: ctx.now };
      if (patch.dueDate !== undefined) update.dueDate = patch.dueDate;
      tx.update(taskSnap.ref, update);
      const activities = lead
        ? [buildActivity(lead, { type: 'task_completed', title: 'Task Completed', description: `Task "${task.title}" was marked complete.` }, ctx)]
        : [];
      activities.forEach((a) => tx.create(adminDb.collection('activities').doc(a.id), a));
      return { tasks: [{ ...task, ...update }], activities };
    }

    // Re-opening a task that already drove the lead forward would desync the cadence.
    if (status === 'pending' && task.status === 'completed' && lead && task.sequenceId && Number.isInteger(task.stepNumber)) {
      if (lead.sequenceId === task.sequenceId && lead.currentStepNumber > task.stepNumber) {
        throw new PlanError(409, 'ALREADY_ADVANCED', 'This step was already completed and the lead has moved on.');
      }
    }

    const update: Doc = { updatedAt: ctx.now };
    if (status !== undefined) update.status = status;
    if (patch.dueDate !== undefined) update.dueDate = patch.dueDate;
    if (status === 'pending') update.completedAt = FieldValue.delete();
    tx.update(taskSnap.ref, update);

    const activities: Doc[] = [];
    if (status === 'skipped' && lead) {
      activities.push(
        buildActivity(lead, { type: 'task_skipped', title: 'Task Skipped', description: `Task "${task.title}" was skipped.` }, ctx)
      );
      activities.forEach((a) => tx.create(adminDb.collection('activities').doc(a.id), a));
    }
    const { completedAt, ...merged } = { ...task, ...update } as Doc;
    return { tasks: [status === 'pending' ? merged : { ...merged, completedAt }], activities };
  });
}

export async function deleteTask(actor: Actor, taskId: string): Promise<EngineResult> {
  const ref = adminDb.collection('tasks').doc(taskId);
  const snap = await ref.get();
  if (!snap.exists || !canAccessTask(snap.data(), actor)) throw new PlanError(404, 'TASK_NOT_FOUND', 'Task not found.');
  await ref.delete();
  return { tasks: [], activities: [], deletedTaskIds: [taskId] };
}

// ---- initial tasks for newly created leads ------------------------------------------------------

/** Builds the lead_created activity (and the initial step task when a sequence was supplied). */
export function buildCreationExtras(lead: Doc, seq: Doc | null, ctx: PlanContext): { tasks: Doc[]; activities: Doc[] } {
  const activities = [
    buildActivity(lead, {
      type: 'lead_created',
      title: 'Lead Captured',
      description: `${lead.firstName} ${lead.lastName || ''} from ${lead.company} captured.`.replace(/\s+/g, ' '),
    }, ctx),
  ];
  const tasks: Doc[] = [];
  if (seq) {
    const steps = activeSteps(seq);
    const step = steps.find((s) => s.stepNumber === lead.currentStepNumber) || steps[0];
    if (step) {
      // A lead that arrives with its connection already sent starts at step 2 (due after the step delay).
      const due = step.stepNumber > 1 ? addDays(ctx.today, step.delayDays ?? 3) : ctx.today;
      tasks.push(buildStepTask(lead, seq, step, due, ctx));
    }
  }
  return { tasks, activities };
}

export async function getContext(actor: Actor): Promise<PlanContext> {
  return makeContext(actor);
}

/** Removes the tasks and activity entries that belong to deleted leads. */
export async function deleteLeadDependents(workspaceId: string, leadIds: string[]): Promise<void> {
  for (const leadId of leadIds) {
    for (const collection of ['tasks', 'activities']) {
      const snap = await adminDb
        .collection(collection)
        .where('workspaceId', '==', workspaceId)
        .where('leadId', '==', leadId)
        .get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = adminDb.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }
}
