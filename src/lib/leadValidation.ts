import { adminDb } from '@/lib/firebaseAdmin';

export const MAX_BATCH = 400;

/** Fields a client may never set through the lead update endpoints. */
const PROTECTED_LEAD_FIELDS = [
  'id',
  'workspaceId',
  'createdAt',
  'capturedBy',
  'capturedByUid',
];
const ASSIGNMENT_FIELDS = ['assignedToId', 'assignedToName', 'assignedToEmail'];

export function str(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

/**
 * Returns a canonical https LinkedIn URL, or null if the value is not an http(s) linkedin.com URL.
 * Rejects javascript:, data:, other hosts, and lookalike hosts such as linkedin.com.evil.com.
 */
export function normalizeLinkedinUrl(value: unknown): string | null {
  const raw = str(value, 500);
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase();
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
    u.protocol = 'https:';
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Removes undefined values (Firestore rejects them) and keys that could address nested paths. */
export function cleanObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (k.includes('.') || k.startsWith('__')) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Builds the set of lead fields a caller is allowed to write from a PATCH body.
 * Identity/tenancy fields are always dropped; reassignment is admin-only.
 */
export function sanitizeLeadUpdate(
  body: Record<string, unknown>,
  isAdmin: boolean
): { updates: Record<string, unknown> } | { error: string } {
  const updates: Record<string, unknown> = { ...body };
  for (const f of PROTECTED_LEAD_FIELDS) delete updates[f];
  if (!isAdmin) {
    for (const f of ASSIGNMENT_FIELDS) delete updates[f];
  }

  if ('linkedinUrl' in updates && updates.linkedinUrl !== '' && updates.linkedinUrl !== null) {
    const url = normalizeLinkedinUrl(updates.linkedinUrl);
    if (!url) return { error: 'linkedinUrl must be a valid https://linkedin.com URL.' };
    updates.linkedinUrl = url;
  }
  for (const f of ['firstName', 'lastName', 'company', 'jobTitle']) {
    if (f in updates) updates[f] = str(updates[f], 200);
  }
  if ('email' in updates && updates.email) {
    const email = str(updates.email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address.' };
    updates.email = email;
  }
  if ('notes' in updates && typeof updates.notes === 'string') updates.notes = updates.notes.slice(0, 5000);

  return { updates: cleanObject(updates) };
}

/** True when an admin may act on the lead, or a non-admin owns (is assigned) the lead. */
export function canAccessLead(
  lead: Record<string, unknown> | undefined,
  ctx: { uid: string; role: string; workspaceId: string }
): boolean {
  if (!lead || lead.workspaceId !== ctx.workspaceId) return false;
  if (ctx.role === 'admin') return true;
  return lead.assignedToId === ctx.uid;
}

/** Resolves an assignee, which must be an active member of the workspace. */
export async function resolveAssignee(
  workspaceId: string,
  uid: string
): Promise<{ uid: string; name: string; email: string } | null> {
  const [memberDoc, userDoc] = await Promise.all([
    adminDb.collection('workspaces').doc(workspaceId).collection('members').doc(uid).get(),
    adminDb.collection('users').doc(uid).get(),
  ]);
  if (!memberDoc.exists || memberDoc.data()?.status !== 'active') return null;
  const u = userDoc.data() || {};
  const m = memberDoc.data() || {};
  const email = (u.email as string) || '';
  return { uid, name: (u.name as string) || (m.name as string) || email.split('@')[0], email };
}

const STEP_ACTIONS = ['connection_request', 'wait_for_acceptance', 'send_message', 'wait_delay', 'followup', 'complete_details'];
export const MAX_STEPS = 50;

/** Normalises user-supplied sequence steps: bounded, typed, renumbered from 1. */
export function sanitizeSteps(input: unknown): Record<string, any>[] | null {
  if (!Array.isArray(input)) return null;
  return input.slice(0, MAX_STEPS).map((s: any, idx: number) => ({
    ...(typeof s?.id === 'string' ? { id: str(s.id, 100) } : {}),
    stepNumber: idx + 1,
    actionType: STEP_ACTIONS.includes(s?.actionType) ? s.actionType : 'send_message',
    title: str(s?.title, 200) || `Step ${idx + 1}`,
    delayDays: Number.isFinite(s?.delayDays) && s.delayDays >= 0 ? Math.min(s.delayDays, 365) : 0,
    messageTemplate: str(s?.messageTemplate, 3000),
    enabled: s?.enabled !== false,
  }));
}
