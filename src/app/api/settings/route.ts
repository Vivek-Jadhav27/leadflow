export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceAdmin, requireWorkspaceMember } from '@/lib/serverAuth';
import { DEFAULT_SETTINGS } from '@/constants/defaultSettings';
import { PlanError, parseTimezone } from '@/lib/crmPlanner';
import { readJson, respond } from '@/lib/crmHttp';
import { str } from '@/lib/leadValidation';
import type { WorkspaceSettings } from '@/types/crm';

function intIn(value: unknown, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new PlanError(400, 'BAD_SETTING', `${name} must be a whole number between ${min} and ${max}.`);
  }
  return value as number;
}

function hhmm(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new PlanError(400, 'BAD_SETTING', `${name} must be HH:MM.`);
  }
  return value;
}

function validate(input: Record<string, any>): Partial<WorkspaceSettings> {
  const out: Partial<WorkspaceSettings> = {};
  if (input.name !== undefined) out.name = str(input.name, 100);
  if (input.domain !== undefined) out.domain = str(input.domain, 100);
  if (input.currency !== undefined) out.currency = str(input.currency, 50);
  if (input.timezone !== undefined) {
    const tz = str(input.timezone, 100);
    if (parseTimezone(tz) === 'UTC' && !/\b(UTC|GMT)\b/i.test(tz)) {
      throw new PlanError(400, 'BAD_SETTING', 'timezone must contain a valid IANA zone, e.g. "Europe/London".');
    }
    out.timezone = tz;
  }
  if (input.defaultAssignmentRule !== undefined) {
    if (!['round_robin', 'manual'].includes(input.defaultAssignmentRule)) {
      throw new PlanError(400, 'BAD_SETTING', 'defaultAssignmentRule must be round_robin or manual.');
    }
    out.defaultAssignmentRule = input.defaultAssignmentRule;
  }
  if (input.defaultFollowupDays !== undefined) out.defaultFollowupDays = intIn(input.defaultFollowupDays, 'defaultFollowupDays', 0, 60);
  if (input.workHoursStart !== undefined) out.workHoursStart = hhmm(input.workHoursStart, 'workHoursStart');
  if (input.workHoursEnd !== undefined) out.workHoursEnd = hhmm(input.workHoursEnd, 'workHoursEnd');
  if (input.skipWeekends !== undefined) out.skipWeekends = Boolean(input.skipWeekends);
  if (input.stopSequenceOnReply !== undefined) out.stopSequenceOnReply = Boolean(input.stopSequenceOnReply);
  if (input.dailyLinkedInConnectLimit !== undefined) out.dailyLinkedInConnectLimit = intIn(input.dailyLinkedInConnectLimit, 'dailyLinkedInConnectLimit', 0, 1000);
  if (input.dailyLinkedInMessageLimit !== undefined) out.dailyLinkedInMessageLimit = intIn(input.dailyLinkedInMessageLimit, 'dailyLinkedInMessageLimit', 0, 1000);
  return out;
}

async function loadSettings(workspaceId: string): Promise<WorkspaceSettings> {
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  const ws = snap.data() || {};
  return { ...DEFAULT_SETTINGS, name: ws.companyName || DEFAULT_SETTINGS.name, ...(ws.settings || {}) };
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  return respond(async () => ({ success: true, settings: await loadSettings(auth.context.workspaceId) }), 'API /settings GET');
}

// PUT /api/settings  (admin only) — partial update, validated.
export async function PUT(req: NextRequest) {
  const auth = await requireWorkspaceAdmin(req);
  if (auth.response) return auth.response;
  const { workspaceId } = auth.context;

  return respond(async () => {
    const changes = validate(await readJson(req));
    if (Object.keys(changes).length === 0) throw new PlanError(400, 'BAD_REQUEST', 'No valid settings supplied.');
    const merged = { ...(await loadSettings(workspaceId)), ...changes };
    await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .set({ settings: merged, updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true, settings: merged };
  }, 'API /settings PUT');
}
