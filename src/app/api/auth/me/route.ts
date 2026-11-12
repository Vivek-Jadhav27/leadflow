import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { Workspace } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json({ error: 'Server is not configured.' }, { status: 503 });
    }

    const context = await authenticateServerRequest(req);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uid, email, profile, role, workspaceId } = context;

    // A user belongs to at most one workspace, and only an active membership counts.
    let currentWorkspace: Workspace | null = null;
    if (workspaceId) {
      const wsDoc = await adminDb.collection('workspaces').doc(workspaceId).get();
      if (wsDoc.exists) currentWorkspace = wsDoc.data() as Workspace;
    }

    return NextResponse.json({
      uid,
      email,
      name: profile?.name || profile?.email?.split('@')[0] || 'User',
      role,
      status: profile?.status || 'active',
      currentWorkspaceId: workspaceId,
      currentWorkspace,
      workspaces: currentWorkspace ? [currentWorkspace] : [],
    });
  } catch (error) {
    console.error('[AuthMe] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
