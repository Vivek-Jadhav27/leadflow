export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireWorkspaceMember } from '@/lib/serverAuth';
import { respond } from '@/lib/crmHttp';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

// GET /api/activities?leadId=&limit=
// Newest first. Non-admins only see activity on leads they own (`leadOwnerId`).
export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceMember(req);
  if (auth.response) return auth.response;
  const { uid, role, workspaceId } = auth.context;

  return respond(async () => {
    const sp = req.nextUrl.searchParams;
    const parsed = parseInt(sp.get('limit') || '', 10);
    const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT, MAX_LIMIT);
    const leadId = sp.get('leadId');

    let base: Query<DocumentData> = adminDb.collection('activities').where('workspaceId', '==', workspaceId);
    if (role !== 'admin') base = base.where('leadOwnerId', '==', uid);
    if (leadId) base = base.where('leadId', '==', leadId);

    let docs;
    try {
      // Needs the composite indexes in firestore.indexes.json for the global feed.
      docs = (await base.orderBy('timestamp', 'desc').limit(limit).get()).docs;
    } catch (err) {
      if ((err as { code?: number }).code !== 9) throw err; // FAILED_PRECONDITION: index not deployed yet
      docs = (await base.limit(limit).get()).docs;
    }

    const activities = docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, any>)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return { success: true, activities };
  }, 'API /activities GET');
}
