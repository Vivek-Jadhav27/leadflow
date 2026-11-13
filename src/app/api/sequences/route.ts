export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceAdmin, requireWorkspaceMember } from '@/lib/serverAuth';
import { editorStamp, sanitizeSteps, str } from '@/lib/leadValidation';
import { approveSequence } from '@/lib/crmEngine';
import type { EngineResult } from '@/lib/crmEngine';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SEQUENCE_STATUSES = ['active', 'paused', 'draft', 'archived', 'pending_approval'];

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

    const snap = await adminDb.collection('sequences').where('workspaceId', '==', workspaceId).limit(500).get();
    let sequences = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, any>[];

    // Non-admins see sequences they created, plus approved shared (non-custom) templates for their role.
    if (role !== 'admin') {
      sequences = sequences.filter((s) => {
        if (s.createdByUid === uid) return true;
        const sharedTemplate = s.approvalStatus === 'approved' && !s.isCustom;
        const matchesRole = !s.targetRole || s.targetRole === 'all' || s.targetRole === role;
        return sharedTemplate && matchesRole;
      });
    }

    return json({ success: true, count: sequences.length, sequences });
  } catch (error) {
    console.error('[API /sequences GET] Error:', error);
    return json({ error: 'Failed to fetch sequences' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMember(req, corsHeaders);
    if (auth.response) return auth.response;
    const { uid, email, role, workspaceId } = auth.context;
    const isAdmin = role === 'admin';

    const body = await req.json();
    const name = str(body?.name, 200);
    if (!name) return json({ error: 'Sequence name is required' }, 400);

    const now = new Date().toISOString();

    // Updating an existing sequence requires it to be in this workspace.
    let existing: Record<string, any> | null = null;
    let seqId = '';
    if (typeof body.id === 'string' && body.id) {
      const snap = await adminDb.collection('sequences').doc(body.id).get();
      if (snap.exists) {
        if (snap.data()?.workspaceId !== workspaceId) {
          return json({ error: 'Sequence not found' }, 404);
        }
        existing = snap.data() as Record<string, any>;
        seqId = snap.id;
      }
    }
    if (existing && !isAdmin) {
      // Members may only edit their own, not-yet-approved sequences.
      if (existing.createdByUid !== uid || existing.approvalStatus === 'approved') {
        return json({ error: 'Forbidden: only admins can modify approved or shared sequences.' }, 403);
      }
    }
    if (!existing) seqId = `seq_${randomUUID()}`;

    const steps = sanitizeSteps(body.steps);
    const requestedStatus = SEQUENCE_STATUSES.includes(body.status) ? body.status : null;

    // Only admins can approve/activate. Everything created by a member starts pending.
    const wantsApproval = body.approvalStatus === 'approved' || body.status === 'active';
    const isApproved = isAdmin
      ? wantsApproval || (existing?.approvalStatus === 'approved' && body.approvalStatus !== 'pending')
      : false;
    const wasApproved = existing?.approvalStatus === 'approved';

    const status = isAdmin ? requestedStatus || existing?.status || 'active' : 'pending_approval';
    const approvalStatus = isApproved ? 'approved' : 'pending';

    const sequenceData: Record<string, any> = {
      id: seqId,
      name,
      channel: 'linkedin',
      description: str(body.description, 1000) || existing?.description || 'LinkedIn multi-step outbound sequence',
      steps: steps ?? existing?.steps ?? [],
      status,
      approvalStatus,
      approvedBy: isApproved ? (wasApproved ? existing?.approvedBy || email : email) : null,
      approvedByUid: isApproved ? (wasApproved ? existing?.approvedByUid || uid : uid) : null,
      approvedAt: isApproved ? (wasApproved ? existing?.approvedAt || now : now) : null,
      workspaceId,
      // Ownership is set once at creation. An edit (including by an admin) never changes it.
      createdBy: existing ? existing.createdBy ?? null : email,
      createdByUid: existing ? existing.createdByUid ?? null : uid,
      createdByRole: existing ? existing.createdByRole ?? null : role,
      targetRole: ['all', 'sdr', 'ae'].includes(body.targetRole) ? body.targetRole : existing?.targetRole || 'all',
      isCustom: Boolean(existing?.isCustom),
      targetLeadId: existing?.targetLeadId || null,
      targetLeadName: existing?.targetLeadName || null,
      targetLeadCompany: existing?.targetLeadCompany || null,
      targetLeadLinkedin: existing?.targetLeadLinkedin || null,
      enrolledLeadsCount: existing?.enrolledLeadsCount || 0,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      ...editorStamp({ uid, email, name: auth.context.profile?.name || email.split('@')[0], role }),
    };

    await adminDb.collection('sequences').doc(seqId).set(sequenceData, { merge: true });

    // Newly approved: activate leads that were waiting on this sequence (same workspace only).
    // The engine matches leads by explicit links only and also schedules their first task.
    let activation: EngineResult | null = null;
    if (isApproved && !wasApproved) {
      activation = await approveSequence(
        { uid, email, name: auth.context.profile?.name || email.split('@')[0], role, workspaceId },
        seqId
      );
    }

    return json({
      success: true,
      message: 'Sequence saved successfully',
      sequence: activation?.sequence ?? sequenceData,
      leads: activation?.leads ?? [],
      tasks: activation?.tasks ?? [],
      activities: activation?.activities ?? [],
    });
  } catch (error) {
    console.error('[API /sequences POST] Error:', error);
    return json({ error: 'Failed to save sequence' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin(req, corsHeaders);
    if (auth.response) return auth.response;
    const { workspaceId } = auth.context;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return json({ error: 'Sequence id required' }, 400);

    const ref = adminDb.collection('sequences').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.workspaceId !== workspaceId) {
      return json({ error: 'Sequence not found' }, 404);
    }

    const enrolled = await adminDb
      .collection('leads')
      .where('workspaceId', '==', workspaceId)
      .where('sequenceId', '==', id)
      .count()
      .get();
    if (enrolled.data().count > 0) {
      return json(
        { error: `Cannot delete: ${enrolled.data().count} lead(s) are enrolled in this sequence. Unenrol them first.` },
        409
      );
    }

    await ref.delete();
    return json({ success: true, message: 'Sequence deleted' });
  } catch (error) {
    console.error('[API /sequences DELETE] Error:', error);
    return json({ error: 'Failed to delete sequence' }, 500);
  }
}
