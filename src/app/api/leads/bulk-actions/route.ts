export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { archiveLeads, assignLeads, enrollLeads, markConnectionSentBulk } from '@/lib/crmEngine';
import { PlanError } from '@/lib/crmPlanner';
import { actorFrom, readJson, requireString, respond } from '@/lib/crmHttp';

const MAX_IDS = 100;

/**
 *   assign   { ids, memberId }       admin only
 *   enroll   { ids, sequenceId|null }
 *   archive  { ids, archived? }
 *   connection_sent { ids }          record that the connection request was sent
 * Each lead is processed in its own transaction; per-lead failures are reported in `errors`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);

  return respond(async () => {
    const body = await readJson(req);
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((i: unknown): i is string => typeof i === 'string' && !!i) : [];
    if (ids.length === 0) throw new PlanError(400, 'BAD_REQUEST', 'ids is required.');
    if (ids.length > MAX_IDS) throw new PlanError(400, 'BAD_REQUEST', `At most ${MAX_IDS} leads per request.`);

    switch (body.action) {
      case 'assign':
        return assignLeads(actor, ids, requireString(body.memberId, 'memberId'));
      case 'enroll':
        return enrollLeads(actor, ids, body.sequenceId ? requireString(body.sequenceId, 'sequenceId') : null);
      case 'connection_sent':
        return markConnectionSentBulk(actor, ids);
      case 'archive':
        return archiveLeads(actor, ids, body.archived !== false);
      default:
        throw new PlanError(400, 'BAD_ACTION', 'Unknown action.');
    }
  }, 'API /leads/bulk-actions');
}
