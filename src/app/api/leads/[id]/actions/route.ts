export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import {
  advanceLead,
  archiveLead,
  enrichLead,
  enrollLead,
  recordActivity,
  recordReply,
  submitCustomSequence,
} from '@/lib/crmEngine';
import { PlanError } from '@/lib/crmPlanner';
import { actorFrom, readJson, requireString, respond } from '@/lib/crmHttp';
import { str } from '@/lib/leadValidation';

/**
 * Workflow actions on a single lead. The client sends an intent; the server applies the business
 * rules transactionally and returns the resulting lead, tasks and activities.
 *
 *   advance   { expectedStep? }          move to the next sequence step
 *   enroll    { sequenceId | null }      enrol in (or remove from) a sequence
 *   reply     { message?, outcome? }     prospect replied / meeting booked
 *   archive   { archived: boolean }      archive or restore
 *   enrich    { data }                   attach enrichment data
 *   custom_sequence { name?, steps, connectionNote? } propose a bespoke cadence (pending admin approval)
 *   activity  { type, title, description } append a note to the activity log
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);
  const { id } = await ctx.params;

  return respond(async () => {
    const body = await readJson(req);
    switch (body.action) {
      case 'advance': {
        const expected = body.expectedStep;
        if (expected !== undefined && !Number.isInteger(expected)) {
          throw new PlanError(400, 'BAD_REQUEST', 'expectedStep must be an integer.');
        }
        return advanceLead(actor, id, { expectedStep: expected });
      }
      case 'enroll': {
        const sequenceId = body.sequenceId === null || body.sequenceId === undefined ? null : requireString(body.sequenceId, 'sequenceId');
        return enrollLead(actor, id, sequenceId);
      }
      case 'reply':
        return recordReply(actor, id, { message: str(body.message, 2000), outcome: str(body.outcome, 100) || undefined });
      case 'archive':
        return archiveLead(actor, id, body.archived !== false);
      case 'enrich': {
        const d = body.data && typeof body.data === 'object' ? body.data : {};
        return enrichLead(actor, id, {
          ...(typeof d.phone === 'string' ? { phone: str(d.phone, 50) } : {}),
          ...(typeof d.phoneVerified === 'boolean' ? { phoneVerified: d.phoneVerified } : {}),
          ...(typeof d.companySize === 'string' ? { companySize: str(d.companySize, 100) } : {}),
          ...(typeof d.annualRevenue === 'string' ? { annualRevenue: str(d.annualRevenue, 100) } : {}),
          ...(Array.isArray(d.techStack) ? { techStack: d.techStack.slice(0, 50).map((t: unknown) => str(t, 50)).filter(Boolean) } : {}),
          ...(typeof d.headquarters === 'string' ? { headquarters: str(d.headquarters, 200) } : {}),
          ...(typeof d.enrichmentNotes === 'string' ? { enrichmentNotes: str(d.enrichmentNotes, 2000) } : {}),
        });
      }
      case 'custom_sequence':
        return submitCustomSequence(actor, id, { name: body.name, steps: body.steps, connectionNote: body.connectionNote });
      case 'activity':
        return recordActivity(actor, id, {
          type: requireString(body.type, 'type', 50),
          title: requireString(body.title, 'title', 200),
          description: str(body.description, 2000),
        });
      default:
        throw new PlanError(400, 'BAD_ACTION', 'Unknown action.');
    }
  }, 'API /leads/[id]/actions');
}
