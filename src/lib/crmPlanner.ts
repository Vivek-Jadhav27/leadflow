/**
 * Pure business logic for the lead -> sequence -> task workflow.
 *
 * Nothing in this file touches the database. Each `plan*` function receives the current state
 * (already read by the caller, normally inside a Firestore transaction) and returns the exact writes
 * to perform, or throws a PlanError that the API layer maps to an HTTP response. Keeping the rules
 * here makes them unit-testable and guarantees a single implementation for every entry point.
 */
import { randomUUID } from 'crypto';

export class PlanError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export { parseTimezone, todayInZone, addDays, isDateString } from '@/utils/workspaceDate';
import { addDays } from '@/utils/workspaceDate';

// ---------------------------------------------------------------------------------------------
// Types (deliberately loose: documents come straight from Firestore)
// ---------------------------------------------------------------------------------------------

export type Doc = Record<string, any>;

export interface Actor {
  uid: string;
  name: string;
  email: string;
  role: string;
  workspaceId: string;
}

export interface PlanContext {
  actor: Actor;
  now: string; // ISO timestamp
  today: string; // YYYY-MM-DD in the workspace time zone
  newId: (prefix: string) => string;
}

export interface Plan {
  leadUpdate: Doc;
  /** Updates to existing task documents. */
  taskUpdates: { id: string; data: Doc }[];
  newTasks: Doc[];
  newActivities: Doc[];
}

export const defaultNewId = (prefix: string) => `${prefix}_${randomUUID()}`;

const INACTIVE_OUTREACH = ['replied', 'completed', 'stopped', 'paused'];

// ---------------------------------------------------------------------------------------------
// Sequence helpers
// ---------------------------------------------------------------------------------------------

export function isSequenceApproved(seq: Doc): boolean {
  return seq.approvalStatus === 'approved' || (!seq.approvalStatus && seq.status === 'active');
}

/** Enabled steps in order. Disabled steps are never scheduled. */
export function activeSteps(seq: Doc): Doc[] {
  return (Array.isArray(seq.steps) ? seq.steps : [])
    .filter((s: Doc) => s && s.enabled !== false)
    .sort((a: Doc, b: Doc) => a.stepNumber - b.stepNumber);
}

export function stepTaskType(actionType?: string): string {
  switch (actionType) {
    case 'connection_request':
      return 'linkedin_connect';
    case 'send_message':
      return 'linkedin_message';
    case 'followup':
    case 'wait_delay':
      return 'followup';
    default:
      // wait_for_acceptance, complete_details, unknown
      return 'manual_review';
  }
}

function leadName(lead: Doc): string {
  return `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
}

export function buildTask(lead: Doc, data: Doc, ctx: PlanContext): Doc {
  const id = ctx.newId('task');
  return {
    id,
    leadId: lead.id,
    leadName: leadName(lead),
    leadCompany: lead.company || '',
    leadLinkedin: lead.linkedinUrl || '',
    assignedToId: lead.assignedToId || ctx.actor.uid,
    assignedToName: lead.assignedToName || ctx.actor.name,
    priority: 'high',
    status: 'pending',
    workspaceId: ctx.actor.workspaceId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    ...data,
  };
}

export function buildStepTask(lead: Doc, seq: Doc, step: Doc, dueDate: string, ctx: PlanContext): Doc {
  return buildTask(lead, {
    title: `Step ${step.stepNumber}: ${step.title} for ${leadName(lead)}`,
    sequenceId: seq.id,
    stepNumber: step.stepNumber,
    type: stepTaskType(step.actionType),
    dueDate,
    messageTemplate: step.messageTemplate || '',
  }, ctx);
}

export function buildActivity(lead: Doc, data: { type: string; title: string; description: string; actorName?: string }, ctx: PlanContext): Doc {
  return {
    id: ctx.newId('act'),
    leadId: lead.id,
    leadName: leadName(lead),
    leadOwnerId: lead.assignedToId || null,
    actorId: ctx.actor.uid,
    actorName: data.actorName || ctx.actor.name,
    timestamp: ctx.now,
    workspaceId: ctx.actor.workspaceId,
    ...data,
  };
}

function cancelPending(pendingTasks: Doc[], note: string, ctx: PlanContext) {
  return pendingTasks.map((t) => ({ id: t.id, data: { status: 'cancelled', notes: note, updatedAt: ctx.now } }));
}

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

/**
 * Moves a lead to the next enabled step of its sequence.
 * - `expectedStep` makes the call idempotent: a duplicate click or a stale tab gets a 409, not a double advance.
 * - Completes the lead's pending tasks and schedules the next step's task.
 */
export function planAdvance(
  lead: Doc,
  seq: Doc | null,
  pendingTasks: Doc[],
  ctx: PlanContext,
  opts: { expectedStep?: number } = {}
): Plan {
  if (!lead.sequenceId) throw new PlanError(409, 'NOT_ENROLLED', 'This lead is not enrolled in a sequence.');
  if (!seq) throw new PlanError(409, 'SEQUENCE_MISSING', 'The lead\'s sequence no longer exists. Re-enrol the lead in another sequence.');
  if (seq.id !== lead.sequenceId) throw new PlanError(409, 'SEQUENCE_MISMATCH', 'Sequence does not match the lead enrolment.');
  if (INACTIVE_OUTREACH.includes(lead.outreachStatus)) {
    throw new PlanError(409, 'LEAD_NOT_ACTIVE', `The lead is ${lead.outreachStatus}; the sequence cannot be advanced.`);
  }

  const current = Number.isInteger(lead.currentStepNumber) ? lead.currentStepNumber : 0;
  if (opts.expectedStep !== undefined && opts.expectedStep !== current) {
    throw new PlanError(409, 'STALE_STEP', 'The lead has already moved on. Refresh and try again.');
  }
  // Decision gate: no value-proposition message before the connection request is accepted.
  if (current === 2 && lead.connectionStatus !== 'connected') {
    throw new PlanError(409, 'CONNECTION_NOT_ACCEPTED', 'Connection has not been accepted yet. Confirm acceptance before sending the next message.');
  }

  const steps = activeSteps(seq);
  const currentStep = steps.find((s) => s.stepNumber === current);
  const next = steps.find((s) => s.stepNumber > current);
  const completedConnect = currentStep?.actionType === 'connection_request';

  const connectionStatus =
    completedConnect && lead.connectionStatus !== 'connected' ? 'request_sent' : lead.connectionStatus;
  // Remember when the request went out (used for the "awaiting acceptance" list).
  const sentStamp = completedConnect && connectionStatus === 'request_sent' && !lead.connectionSentAt ? { connectionSentAt: ctx.now } : {};

  const taskUpdates = pendingTasks.map((t) => ({
    id: t.id,
    data: { status: 'completed', completedAt: ctx.now, updatedAt: ctx.now },
  }));
  const name = leadName(lead);

  if (!next) {
    return {
      leadUpdate: {
        currentStepNumber: steps.length ? steps[steps.length - 1].stepNumber : current,
        connectionStatus,
        ...sentStamp,
        outreachStatus: 'completed',
        disposition: 'complete_details',
        nextFollowUpDate: null,
        nextActionTitle: 'Review Lead & Complete Details',
        updatedAt: ctx.now,
      },
      taskUpdates,
      newTasks: [],
      newActivities: [
        buildActivity(lead, {
          type: 'sequence_completed',
          title: 'Sequence Reached Complete Details',
          description: 'All configured LinkedIn outreach steps completed. Ready for Enrich or Archive decision.',
        }, ctx),
      ],
    };
  }

  const dueDate = addDays(ctx.today, next.delayDays ?? 1);
  return {
    leadUpdate: {
      currentStepNumber: next.stepNumber,
      connectionStatus,
      ...sentStamp,
      outreachStatus: next.stepNumber >= 4 ? 'followup_due' : 'in_sequence',
      nextFollowUpDate: dueDate,
      nextActionTitle: next.title,
      updatedAt: ctx.now,
    },
    taskUpdates,
    newTasks: [buildStepTask(lead, seq, next, dueDate, ctx)],
    newActivities: [
      completedConnect
        ? buildActivity(lead, {
            type: 'connection_request_sent',
            title: 'LinkedIn Connection Request Sent',
            description: `Connection invite sent to ${name}. Status updated to Request Sent. Awaiting prospect acceptance.`,
          }, ctx)
        : buildActivity(lead, {
            type: 'followup_scheduled',
            title: `Advanced to Step ${next.stepNumber}: ${next.title}`,
            description: `Action completed. Next follow-up scheduled for ${dueDate}.`,
          }, ctx),
    ],
  };
}

/** Enrols a lead in an approved sequence at its first enabled step (re-enrolling restarts the cadence). */
export function planEnroll(lead: Doc, seq: Doc, pendingTasks: Doc[], ctx: PlanContext): Plan {
  if (!isSequenceApproved(seq)) {
    throw new PlanError(409, 'SEQUENCE_NOT_APPROVED', 'Only approved sequences can be assigned to leads.');
  }
  const steps = activeSteps(seq);
  if (steps.length === 0) throw new PlanError(400, 'SEQUENCE_EMPTY', 'This sequence has no enabled steps.');
  const first = steps[0];

  return {
    leadUpdate: {
      sequenceId: seq.id,
      sequenceName: seq.name,
      currentStepNumber: first.stepNumber,
      totalSteps: steps.length,
      outreachStatus: 'in_sequence',
      nextFollowUpDate: ctx.today,
      nextActionTitle: first.title || 'Step 1 Action',
      updatedAt: ctx.now,
    },
    taskUpdates: cancelPending(pendingTasks, 'Cancelled: lead was re-enrolled in a sequence.', ctx),
    newTasks: [buildStepTask(lead, seq, first, ctx.today, ctx)],
    newActivities: [
      buildActivity(lead, {
        type: 'sequence_enrolled',
        title: 'Enrolled in Sequence',
        description: `Prospect was enrolled into sequence "${seq.name}". Step ${first.stepNumber} task scheduled for today.`,
      }, ctx),
    ],
  };
}

export function planUnenroll(lead: Doc, pendingTasks: Doc[], ctx: PlanContext): Plan {
  return {
    leadUpdate: {
      sequenceId: null,
      sequenceName: null,
      currentStepNumber: 0,
      outreachStatus: 'unassigned',
      nextFollowUpDate: null,
      nextActionTitle: null,
      updatedAt: ctx.now,
    },
    taskUpdates: cancelPending(pendingTasks, 'Cancelled: lead was removed from the sequence.', ctx),
    newTasks: [],
    newActivities: [
      buildActivity(lead, {
        type: 'sequence_unenrolled',
        title: 'Removed from Sequence',
        description: 'Prospect was removed from their outreach sequence.',
      }, ctx),
    ],
  };
}

/** A prospect replied (or booked a meeting): halt automated follow-ups and create a review task. */
export function planReply(
  lead: Doc,
  pendingTasks: Doc[],
  input: { message?: string; outcome?: string },
  ctx: PlanContext
): Plan {
  const outcome = (input.outcome || 'Interested').slice(0, 100);
  const isMeeting = outcome.toLowerCase().includes('meeting');
  const name = leadName(lead);
  const cancellable = pendingTasks.filter((t) => t.type === 'followup' || t.type === 'linkedin_message');

  return {
    leadUpdate: {
      outreachStatus: 'replied',
      disposition: isMeeting ? 'meeting_booked' : 'interested',
      outcome: isMeeting ? 'Meeting Booked' : outcome,
      nextFollowUpDate: null,
      nextActionTitle: isMeeting ? 'Prepare for Meeting' : 'Respond to prospect reply',
      updatedAt: ctx.now,
    },
    taskUpdates: cancelPending(cancellable, 'Cancelled due to incoming prospect reply.', ctx),
    newTasks: [
      buildTask(lead, {
        title: isMeeting ? `Meeting Booked with ${name} (Prep slides)` : `Respond to Reply from ${name}`,
        type: 'manual_review',
        dueDate: ctx.today,
      }, ctx),
    ],
    newActivities: [
      buildActivity(lead, {
        type: isMeeting ? 'meeting_booked' : 'reply_received',
        title: isMeeting ? 'Meeting Booked on Calendar' : 'Prospect Reply Received',
        description: (input.message || '').slice(0, 2000) || `Reply recorded for ${name}. Future sequence follow-ups halted.`,
        actorName: name,
      }, ctx),
    ],
  };
}

/**
 * An admin approved a sequence: leads that were waiting for it (custom cadences created from the
 * extension) start at step 2, because the step-1 connection request was already sent on LinkedIn.
 * Returns null for leads that are not waiting.
 */
export function planActivateAfterApproval(lead: Doc, seq: Doc, pendingTasks: Doc[], ctx: PlanContext, approverName: string): Plan | null {
  if (lead.outreachStatus !== 'pending_sequence_approval' && lead.outreachStatus !== 'needs_sequence') return null;
  const steps = activeSteps(seq);
  const step2 = steps.find((s) => s.stepNumber > 1);
  if (!step2) return null;

  const dueDate = addDays(ctx.today, step2.delayDays ?? 3);
  return {
    leadUpdate: {
      sequenceId: seq.id,
      sequenceName: seq.name,
      totalSteps: steps.length,
      outreachStatus: 'in_sequence',
      currentStepNumber: step2.stepNumber,
      nextActionTitle: step2.title || 'Step 2: Follow-up 1',
      nextFollowUpDate: lead.nextFollowUpDate || dueDate,
      updatedAt: ctx.now,
    },
    taskUpdates: cancelPending(pendingTasks, 'Cancelled: sequence approved, step scheduled.', ctx),
    newTasks: [buildStepTask(lead, seq, step2, dueDate, ctx)],
    newActivities: [
      buildActivity(lead, {
        type: 'sequence_assigned',
        title: 'Custom Cadence Approved & Activated',
        description: `Cadence "${seq.name}" was approved by ${approverName}. Step ${step2.stepNumber} follow-up scheduled for ${dueDate}.`,
        actorName: approverName,
      }, ctx),
    ],
  };
}

const SENT_OR_BEYOND = ['request_sent', 'pending', 'request_pending', 'connected', 'verified'];

/**
 * The rep sent a LinkedIn connection request outside the app and is recording it.
 * - If the lead is on the connection-request step of its sequence, this completes that step (the same
 *   transition as marking the step task done): the cadence moves on and the next task is scheduled.
 * - Otherwise it just records the status and a log entry.
 * Safe to repeat: a lead that is already past this point is rejected, not changed twice.
 */
export function planConnectionSent(lead: Doc, seq: Doc | null, pendingTasks: Doc[], ctx: PlanContext): Plan {
  if (lead.disposition === 'archived') throw new PlanError(409, 'LEAD_ARCHIVED', 'Archived leads cannot be updated.');
  const status = lead.connectionStatus || 'not_started';
  if (SENT_OR_BEYOND.includes(status)) throw new PlanError(409, 'ALREADY_SENT', 'Connection request was already sent.');
  if (status === 'declined') throw new PlanError(409, 'DECLINED', 'The prospect declined the connection request.');

  if (seq && lead.sequenceId === seq.id && !INACTIVE_OUTREACH.includes(lead.outreachStatus)) {
    const current = activeSteps(seq).find((st) => st.stepNumber === lead.currentStepNumber);
    if (current?.actionType === 'connection_request') {
      return planAdvance(lead, seq, pendingTasks, ctx, { expectedStep: lead.currentStepNumber });
    }
  }

  return {
    leadUpdate: { connectionStatus: 'request_sent', connectionSentAt: lead.connectionSentAt || ctx.now, updatedAt: ctx.now },
    taskUpdates: [],
    newTasks: [],
    newActivities: [
      buildActivity(lead, {
        type: 'connection_request_sent',
        title: 'LinkedIn Connection Request Sent',
        description: `Connection request to ${leadName(lead)} marked as sent. Awaiting acceptance.`,
      }, ctx),
    ],
  };
}

/** Statuses meaning "request sent, not accepted yet". */
export const AWAITING_CONNECTION = ['request_sent', 'pending', 'request_pending'];

/**
 * The prospect accepted the connection request (the rep saw it on LinkedIn and is recording it).
 * Only records the acceptance: it clears the "connection accepted" gate but does not move the cadence,
 * so the rep still completes the next step themselves. Safe to repeat.
 */
export function planConnectionAccepted(lead: Doc, ctx: PlanContext): Plan {
  if (lead.disposition === 'archived') throw new PlanError(409, 'LEAD_ARCHIVED', 'Archived leads cannot be updated.');
  const status = lead.connectionStatus || 'not_started';
  if (status === 'connected' || status === 'verified') throw new PlanError(409, 'ALREADY_ACCEPTED', 'Connection was already accepted.');
  if (!AWAITING_CONNECTION.includes(status)) {
    throw new PlanError(409, 'NOT_SENT', 'No connection request has been sent to this lead yet.');
  }
  return {
    leadUpdate: { connectionStatus: 'connected', connectionAcceptedAt: ctx.now, updatedAt: ctx.now },
    taskUpdates: [],
    newTasks: [],
    newActivities: [
      buildActivity(lead, {
        type: 'connection_accepted',
        title: 'LinkedIn Connection Accepted',
        description: `${leadName(lead)} accepted the connection request. Confirmed by ${ctx.actor.name}.`,
      }, ctx),
    ],
  };
}

export function planArchive(lead: Doc, archived: boolean, ctx: PlanContext): Plan {
  return {
    leadUpdate: {
      disposition: archived ? 'archived' : 'active',
      outcome: archived ? 'Archived' : 'Active',
      updatedAt: ctx.now,
    },
    taskUpdates: [],
    newTasks: [],
    newActivities: [
      buildActivity(lead, {
        type: archived ? 'lead_archived' : 'lead_restored',
        title: archived ? 'Lead Archived' : 'Lead Restored',
        description: archived
          ? 'Lead moved to archive. Historical activities preserved.'
          : 'Lead restored from archive to active CRM pipeline.',
      }, ctx),
    ],
  };
}

export function planEnrich(lead: Doc, pendingTasks: Doc[], enriched: Doc, ctx: PlanContext): Plan {
  const merged = { ...(lead.enrichedData || {}), ...enriched, enrichedAt: ctx.now };
  return {
    leadUpdate: {
      disposition: 'enriched',
      outcome: 'Enriched',
      enrichedData: merged,
      ...(enriched.phone ? { phone: enriched.phone } : {}),
      updatedAt: ctx.now,
    },
    taskUpdates: pendingTasks
      .filter((t) => t.type === 'enrich')
      .map((t) => ({ id: t.id, data: { status: 'completed', completedAt: ctx.now, updatedAt: ctx.now } })),
    newTasks: [],
    newActivities: [
      buildActivity(lead, {
        type: 'lead_enriched',
        title: 'Lead Enriched with Intelligence',
        description: `Verified profile: ${enriched.companySize || 'Updated'}, Tech stack: ${
          Array.isArray(enriched.techStack) ? enriched.techStack.join(', ') : 'Updated'
        }.`,
      }, ctx),
    ],
  };
}

export function planAssign(lead: Doc, assignee: { uid: string; name: string; email: string }, pendingTasks: Doc[], ctx: PlanContext): Plan {
  return {
    leadUpdate: {
      assignedToId: assignee.uid,
      assignedToName: assignee.name,
      assignedToEmail: assignee.email,
      updatedAt: ctx.now,
    },
    // Open tasks follow the lead to its new owner.
    taskUpdates: pendingTasks.map((t) => ({
      id: t.id,
      data: { assignedToId: assignee.uid, assignedToName: assignee.name, updatedAt: ctx.now },
    })),
    newTasks: [],
    newActivities: [
      {
        ...buildActivity({ ...lead, assignedToId: assignee.uid }, {
          type: 'lead_assigned',
          title: 'Lead Reassigned',
          description: `Lead assigned to ${assignee.name}.`,
        }, ctx),
      },
    ],
  };
}

/**
 * Completing a task. If it is the live step task of the lead's sequence, completing it advances
 * the sequence (atomically, in the same transaction) so the UI can never get the two out of sync.
 */
export function shouldAdvanceOnComplete(task: Doc, lead: Doc | null): boolean {
  return Boolean(
    lead &&
      task.sequenceId &&
      Number.isInteger(task.stepNumber) &&
      lead.sequenceId === task.sequenceId &&
      lead.currentStepNumber === task.stepNumber
  );
}
