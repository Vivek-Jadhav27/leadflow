import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/serverAuth';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { Workspace } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isConfigured = typeof isFirebaseAdminConfigured === 'function' ? isFirebaseAdminConfigured() : isFirebaseAdminConfigured;
    if (!isConfigured) {
      return NextResponse.json(
        {
          error: 'Firebase Admin SDK not configured.',
          hint: 'Please add FIREBASE_SERVICE_ACCOUNT_KEY to your Vercel Project Settings > Environment Variables.',
        },
        { status: 503 }
      );
    }

    const context = await authenticateServerRequest(req);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uid, email, profile, role, workspaceId } = context;

    const accessibleWorkspaces: Workspace[] = [];
    const workspaceIdSet = new Set<string>();

    // 1. Query workspaces where user is the owner (simple query, no composite index needed)
    try {
      const ownedWorkspacesSnap = await adminDb
        .collection('workspaces')
        .where('ownerId', '==', uid)
        .get();

      for (const wsDoc of ownedWorkspacesSnap.docs) {
        const wsData = wsDoc.data() as Workspace;
        if (wsData.status === 'active') {
          accessibleWorkspaces.push(wsData);
          workspaceIdSet.add(wsData.workspaceId);
        }
      }
    } catch (e) {
      console.warn('[AuthMe] Owned workspaces query error:', e);
    }

    // 2. Query memberships by uid only (single field query avoids composite index requirement)
    try {
      const membersSnap = await adminDb
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();

      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        if (memberData?.status === 'active') {
          const wsDocRef = memberDoc.ref.parent.parent;
          if (wsDocRef && !workspaceIdSet.has(wsDocRef.id)) {
            const wsSnapshot = await wsDocRef.get();
            if (wsSnapshot.exists) {
              const wsData = wsSnapshot.data() as Workspace;
              if (wsData.status === 'active') {
                accessibleWorkspaces.push(wsData);
                workspaceIdSet.add(wsData.workspaceId);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AuthMe] CollectionGroup members query error:', e);
    }

    // 3. Resolve active workspace
    let currentWorkspace: Workspace | null = null;
    const targetWsId =
      workspaceId ||
      profile?.currentWorkspaceId ||
      (accessibleWorkspaces.length > 0 ? accessibleWorkspaces[0].workspaceId : null);

    if (targetWsId) {
      const found = accessibleWorkspaces.find((w) => w.workspaceId === targetWsId);
      if (found) {
        currentWorkspace = found;
      } else {
        try {
          const activeWsDoc = await adminDb.collection('workspaces').doc(targetWsId).get();
          if (activeWsDoc.exists) {
            const wsData = activeWsDoc.data() as Workspace;
            if (wsData.status === 'active') {
              currentWorkspace = wsData;
              if (!workspaceIdSet.has(wsData.workspaceId)) {
                accessibleWorkspaces.push(wsData);
              }
            }
          }
        } catch (e) {
          console.warn('[AuthMe] Active workspace query error:', e);
        }
      }
    }

    return NextResponse.json({
      uid,
      email,
      name: profile?.name || profile?.email?.split('@')[0] || 'User',
      role,
      status: profile?.status || 'active',
      currentWorkspaceId: targetWsId,
      currentWorkspace,
      workspaces: accessibleWorkspaces,
    });
  } catch (error) {
    const errorMsg = (error as Error)?.message || 'Internal server error';
    console.error('[AuthMe] Error:', error);
    return NextResponse.json(
      {
        error: errorMsg,
        hint: errorMsg.includes('credentials')
          ? 'Add FIREBASE_SERVICE_ACCOUNT_KEY in Vercel Project Settings > Environment Variables.'
          : undefined,
      },
      { status: 500 }
    );
  }
}
