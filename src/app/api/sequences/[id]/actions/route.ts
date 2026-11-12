export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { approveSequence } from '@/lib/crmEngine';
import { PlanError } from '@/lib/crmPlanner';
import { actorFrom, readJson, respond } from '@/lib/crmHttp';

/**
 *   approve    admin only; approves the sequence and activates leads explicitly waiting on it
 *   toggle     admin only; active <-> paused (approved sequences only)
 *   duplicate  copies into a new draft that must be approved before use
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);
  const { id } = await ctx.params;

  return respond(async () => {
    const body = await readJson(req);
    const now = new Date().toISOString();

    if (body.action === 'approve') return approveSequence(actor, id);

    const ref = adminDb.collection('sequences').doc(id);
    const snap = await ref.get();
    const seq = snap.data();
    if (!snap.exists || !seq || seq.workspaceId !== actor.workspaceId) {
      throw new PlanError(404, 'SEQUENCE_NOT_FOUND', 'Sequence not found.');
    }

    if (body.action === 'toggle') {
      if (actor.role !== 'admin') throw new PlanError(403, 'FORBIDDEN', 'Only admins can pause or resume sequences.');
      if (seq.approvalStatus !== 'approved' && seq.status !== 'active' && seq.status !== 'paused') {
        throw new PlanError(409, 'SEQUENCE_NOT_APPROVED', 'Approve the sequence before activating it.');
      }
      const update = { status: seq.status === 'active' ? 'paused' : 'active', updatedAt: now, updatedBy: actor.email };
      await ref.update(update);
      return { sequence: { id, ...seq, ...update }, tasks: [], activities: [] };
    }

    if (body.action === 'duplicate') {
      const isOwner = seq.createdByUid === actor.uid;
      if (actor.role !== 'admin' && !isOwner && seq.approvalStatus !== 'approved') {
        throw new PlanError(404, 'SEQUENCE_NOT_FOUND', 'Sequence not found.');
      }
      const copyId = `seq_${randomUUID()}`;
      const copy = {
        ...seq,
        id: copyId,
        name: `${seq.name} (Copy)`.slice(0, 200),
        status: 'draft',
        approvalStatus: 'pending',
        approvedBy: null,
        approvedAt: null,
        isCustom: false,
        targetLeadId: null,
        targetLeadName: null,
        targetLeadCompany: null,
        targetLeadLinkedin: null,
        enrolledLeadsCount: 0,
        createdBy: actor.email,
        createdByUid: actor.uid,
        createdByRole: actor.role,
        createdAt: now,
        updatedAt: now,
        updatedBy: actor.email,
        steps: (Array.isArray(seq.steps) ? seq.steps : []).map((s: Record<string, any>, i: number) => ({ ...s, id: `step_${randomUUID()}_${i + 1}` })),
      };
      await adminDb.collection('sequences').doc(copyId).create(copy);
      return { sequence: copy, tasks: [], activities: [] };
    }

    throw new PlanError(400, 'BAD_ACTION', 'Unknown action.');
  }, 'API /sequences/[id]/actions');
}
