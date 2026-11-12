export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { createManualTask, deleteTask, updateTask } from '@/lib/crmEngine';
import { PlanError } from '@/lib/crmPlanner';
import { actorFrom, readJson, requireString, respond } from '@/lib/crmHttp';

const DEFAULT_PAGE = 300;
const MAX_PAGE = 500;

// GET /api/tasks?limit=&cursor=&status=
// Admins see the workspace's tasks; everyone else only tasks assigned to them.
export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const { uid, role, workspaceId } = auth.context;

  return respond(async () => {
    const sp = req.nextUrl.searchParams;
    const parsed = parseInt(sp.get('limit') || '', 10);
    const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE, MAX_PAGE);
    const cursor = sp.get('cursor');
    const status = sp.get('status');

    let q: Query<DocumentData> = adminDb.collection('tasks').where('workspaceId', '==', workspaceId);
    if (role !== 'admin') q = q.where('assignedToId', '==', uid);
    if (status) q = q.where('status', '==', status);
    q = q.orderBy(FieldPath.documentId());
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.limit(limit).get();
    const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, tasks, nextCursor: snap.size === limit ? snap.docs[snap.size - 1].id : null };
  }, 'API /tasks GET');
}

// POST /api/tasks  { title, leadId, type?, dueDate?, priority?, notes?, assignedToId? }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);

  return respond(async () => createManualTask(actor, await readJson(req)), 'API /tasks POST');
}

// PATCH /api/tasks  { id, status?, dueDate? }
// Completing the live step task of a sequence advances the lead atomically.
export async function PATCH(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);

  return respond(async () => {
    const body = await readJson(req);
    if (body.status === undefined && body.dueDate === undefined) {
      throw new PlanError(400, 'BAD_REQUEST', 'Nothing to update.');
    }
    return updateTask(actor, requireString(body.id, 'id'), { status: body.status, dueDate: body.dueDate });
  }, 'API /tasks PATCH');
}

// DELETE /api/tasks?id=
export async function DELETE(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const actor = actorFrom(auth.context);

  return respond(async () => deleteTask(actor, requireString(req.nextUrl.searchParams.get('id'), 'id')), 'API /tasks DELETE');
}
