export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
      return NextResponse.json({ success: false, error: 'Firebase Admin not configured' }, { status: 503, headers: corsHeaders });
    }

    const workspaceId =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    let leadsQ: any = adminDb.collection('leads');
    let seqQ: any = adminDb.collection('sequences');

    if (workspaceId) {
      leadsQ = leadsQ.where('workspaceId', '==', workspaceId);
      seqQ = seqQ.where('workspaceId', '==', workspaceId);
    }

    let leads: any[] = [];
    let sequences: any[] = [];

    try {
      const [leadsSnap, seqSnap] = await Promise.all([leadsQ.get(), seqQ.get()]);
      leads = leadsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      sequences = seqSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } catch (dbErr) {
      console.warn('[API /sync GET] Firestore read fallback:', (dbErr as any)?.message || dbErr);
    }

    return NextResponse.json(
      {
        success: true,
        workspaceId,
        counts: {
          leadsCount: leads.length,
          sequencesCount: sequences.length,
        },
        leads,
        sequences,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[API /sync GET] Error:', error);
    return NextResponse.json({ error: error?.message || 'Sync read error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (!isAdminReady || !adminDb) {
      return NextResponse.json({ success: false, error: 'Firebase Admin not configured' }, { status: 503, headers: corsHeaders });
    }

    const body = await req.json();
    const { leads = [], sequences = [], workspaceId: rawWorkspaceId } = body;

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

    let workspaceId = req.headers.get('x-workspace-id') || rawWorkspaceId || null;

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.uid) {
          if (!workspaceId) {
            const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
            if (userDoc.exists && userDoc.data()?.currentWorkspaceId) {
              workspaceId = userDoc.data()?.currentWorkspaceId;
            } else {
              const ownedWsSnap = await adminDb.collection('workspaces').where('ownerId', '==', decoded.uid).limit(1).get();
              if (!ownedWsSnap.empty) {
                workspaceId = ownedWsSnap.docs[0].id;
              }
            }
          }
        }
      } catch {}
    }

    workspaceId = workspaceId || 'default_workspace';

    const batch = adminDb.batch();
    let writeCount = 0;

    // Batch sync leads
    if (Array.isArray(leads) && leads.length > 0) {
      for (const lead of leads) {
        if (!lead.id) continue;
        const leadRef = adminDb.collection('leads').doc(lead.id);
        batch.set(
          leadRef,
          {
            ...lead,
            workspaceId: lead.workspaceId || workspaceId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        writeCount++;
      }
    }

    // Batch sync sequences
    if (Array.isArray(sequences) && sequences.length > 0) {
      for (const seq of sequences) {
        if (!seq.id) continue;
        const seqRef = adminDb.collection('sequences').doc(seq.id);
        batch.set(
          seqRef,
          {
            ...seq,
            workspaceId: seq.workspaceId || workspaceId,
            approvalStatus: seq.approvalStatus || (seq.status === 'active' ? 'approved' : 'pending'),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        writeCount++;
      }
    }

    if (writeCount > 0) {
      await batch.commit();
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully synchronized ${writeCount} record(s) to Firestore!`,
        syncedCount: writeCount,
        workspaceId,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[API /sync POST] Error:', error);
    return NextResponse.json({ error: error?.message || 'Sync write error' }, { status: 500, headers: corsHeaders });
  }
}

