export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (!isAdminReady || !adminDb) {
      return NextResponse.json({ success: true, count: 0, sequences: [] }, { status: 200, headers: corsHeaders });
    }

    let token = '';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      const tokenCookie = req.cookies.get('leadflow_auth_token');
      if (tokenCookie) {
        token = tokenCookie.value;
      }
    }

    let resolvedWorkspaceId =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId') ||
      null;

    let callerUid: string | null = null;
    let callerEmail: string | null = null;
    let callerRole: string = 'admin';

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.uid) {
          callerUid = decoded.uid;
          callerEmail = decoded.email || null;
          const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            callerRole = uData?.role || 'sdr';
            if (!resolvedWorkspaceId && uData?.currentWorkspaceId) {
              resolvedWorkspaceId = uData.currentWorkspaceId;
            }
          }
          if (!resolvedWorkspaceId) {
            const ownedWsSnap = await adminDb.collection('workspaces').where('ownerId', '==', decoded.uid).limit(1).get();
            if (!ownedWsSnap.empty) {
              resolvedWorkspaceId = ownedWsSnap.docs[0].id;
              callerRole = 'admin';
            }
          }
        }
      } catch {}
    }

    let q: any = adminDb.collection('sequences');
    if (resolvedWorkspaceId) {
      q = q.where('workspaceId', '==', resolvedWorkspaceId);
    }

    const snapshot = await q.get();
    let sequences = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // If caller is not admin (SDR or AE), enforce access rules:
    // Only sequences created by them, or created by admin and matching their targetRole
    if (callerRole && callerRole !== 'admin') {
      sequences = sequences.filter((s: any) => {
        const isCreator =
          (callerUid && s.createdByUid === callerUid) ||
          (callerEmail && s.createdBy?.toLowerCase().trim() === callerEmail.toLowerCase().trim());
        const isAdminCreated =
          s.createdByRole === 'admin' ||
          !s.createdByUid ||
          s.createdBy === 'Workspace Admin' ||
          (s.createdBy && s.createdBy.toLowerCase().includes('admin'));
        const matchesTargetRole = !s.targetRole || s.targetRole === 'all' || s.targetRole === callerRole;
        return isCreator || (isAdminCreated && matchesTargetRole);
      });
    }

    return NextResponse.json(
      {
        success: true,
        count: sequences.length,
        sequences,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[API /sequences GET] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch sequences' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Sequence name is required' }, { status: 400, headers: corsHeaders });
    }

    let token = '';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      const tokenCookie = req.cookies.get('leadflow_auth_token');
      if (tokenCookie) {
        token = tokenCookie.value;
      }
    }

    let resolvedWorkspaceId = req.headers.get('x-workspace-id') || body.workspaceId || null;
    let author = body.createdBy || 'Workspace Admin';
    let authorUid: string | null = body.createdByUid || null;

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (isAdminReady && token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.email) author = decoded.email;
        if (decoded?.uid) {
          authorUid = decoded.uid;
          if (!resolvedWorkspaceId) {
            const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
            if (userDoc.exists && userDoc.data()?.currentWorkspaceId) {
              resolvedWorkspaceId = userDoc.data()?.currentWorkspaceId;
            } else {
              const ownedWsSnap = await adminDb.collection('workspaces').where('ownerId', '==', decoded.uid).limit(1).get();
              if (!ownedWsSnap.empty) {
                resolvedWorkspaceId = ownedWsSnap.docs[0].id;
              }
            }
          }
        }
      } catch {}
    }

    const now = new Date().toISOString();
    const seqId = body.id || `seq_${Date.now()}`;
    const sequenceData = {
      id: seqId,
      name: body.name.trim(),
      channel: 'linkedin',
      description: body.description || 'LinkedIn multi-step outbound cadence',
      steps: body.steps || [],
      status: body.status || 'active',
      approvalStatus: body.approvalStatus || 'approved',
      approvedBy: body.approvedBy || author,
      approvedAt: body.approvedAt || now,
      workspaceId: resolvedWorkspaceId || 'default_workspace',
      createdBy: author,
      createdByUid: authorUid,
      createdByRole: body.createdByRole || 'admin',
      targetRole: body.targetRole || 'all',
      enrolledLeadsCount: body.enrolledLeadsCount || 0,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    if (isAdminReady && adminDb) {
      await adminDb.collection('sequences').doc(seqId).set(sequenceData, { merge: true });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Sequence saved to Firestore',
        sequence: sequenceData,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[API /sequences POST] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to save sequence' }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sequence id required' }, { status: 400, headers: corsHeaders });
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (isAdminReady && adminDb) {
      await adminDb.collection('sequences').doc(id).delete();
    }

    return NextResponse.json({ success: true, message: 'Sequence deleted from Firestore' }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete sequence' }, { status: 500, headers: corsHeaders });
  }
}

