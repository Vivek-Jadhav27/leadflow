export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import fs from 'fs';
import path from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'extension-sequences.json');

const DEFAULT_SEQUENCES = [
  {
    id: 'seq_default_outbound',
    name: 'LinkedIn 4-Step Outbound Cadence',
    channel: 'linkedin',
    description: 'Standard multi-touch LinkedIn outbound sequence for decision makers.',
    steps: [
      { id: 'step_def_1', stepNumber: 1, actionType: 'connection_request', title: 'Connection Request', delayDays: 0, messageTemplate: 'Hi {{firstName}}, noticing your work at {{company}}. Would love to connect and share insights.', enabled: true },
      { id: 'step_def_2', stepNumber: 2, actionType: 'send_message', title: 'First Follow-up', delayDays: 3, messageTemplate: 'Hi {{firstName}}, thanks for connecting! Following up to see if you had a moment to review how we help teams at {{company}} optimize outbound sales outreach.', enabled: true },
      { id: 'step_def_3', stepNumber: 3, actionType: 'send_message', title: 'Second Follow-up', delayDays: 7, messageTemplate: 'Hi {{firstName}}, following up on my previous message. Wanted to see if you had 5 minutes this week for a brief conversation?', enabled: true },
    ],
    status: 'active',
    approvalStatus: 'approved',
    workspaceId: 'default_workspace',
    targetRole: 'all',
    createdBy: 'Workspace Admin',
    createdByRole: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

function getStoredSequences(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_SEQUENCES, null, 2), 'utf-8');
      return DEFAULT_SEQUENCES;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEQUENCES;
  } catch {
    return DEFAULT_SEQUENCES;
  }
}

function saveStoredSequences(sequences: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(sequences, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sequences file:', err);
  }
}

interface CachedSequencesResult {
  sequences: any[];
  count: number;
  cachedAt: number;
}
const sequencesServerCache = new Map<string, CachedSequencesResult>();
const SEQUENCES_CACHE_TTL_MS = 60 * 1000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const workspaceIdParam =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    const cacheKey = workspaceIdParam || 'all';
    const cached = sequencesServerCache.get(cacheKey);
    const nowTs = Date.now();

    if (cached && nowTs - cached.cachedAt < SEQUENCES_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          success: true,
          count: cached.count,
          sequences: cached.sequences,
          fromCache: true,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

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

    if (isAdminReady && token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.uid) {
          callerUid = decoded.uid;
          callerEmail = decoded.email || null;
          if (adminDb) {
            try {
              const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
              if (userDoc.exists) {
                const uData = userDoc.data();
                callerRole = uData?.role || 'sdr';
                if (!resolvedWorkspaceId && uData?.currentWorkspaceId) {
                  resolvedWorkspaceId = uData.currentWorkspaceId;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    let firestoreSequences: any[] = [];
    if (isAdminReady && adminDb) {
      try {
        let q: any = adminDb.collection('sequences');
        const snapshot = await q.get();
        firestoreSequences = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (fsErr) {
        console.warn('[API /sequences GET] Firestore read fallback (quota/network):', (fsErr as any)?.message || fsErr);
      }
    }

    const stored = getStoredSequences();
    const seqMap = new Map<string, any>();
    stored.forEach((s) => seqMap.set(s.id, s));
    firestoreSequences.forEach((s) => seqMap.set(s.id, { ...seqMap.get(s.id), ...s }));
    let sequences = Array.from(seqMap.values());

    // Scope to current workspace while including default_workspace fallbacks and bespoke custom cadences
    if (resolvedWorkspaceId) {
      sequences = sequences.filter((s: any) =>
        !s.workspaceId ||
        s.workspaceId === resolvedWorkspaceId ||
        s.workspaceId === 'default_workspace' ||
        s.id?.startsWith('seq_custom_')
      );
    }

    // If caller is not admin (SDR or AE), enforce access rules:
    // Individual can see sequences created by them, custom sequences for their leads, or admin templates targeting their role
    if (callerRole && callerRole !== 'admin') {
      sequences = sequences.filter((s: any) => {
        const isCreator =
          (callerUid && s.createdByUid === callerUid) ||
          (callerEmail && s.createdBy?.toLowerCase().trim() === callerEmail.toLowerCase().trim());
        const isCustomCadence = s.id?.startsWith('seq_custom_');
        const isAdminCreated =
          s.createdByRole === 'admin' ||
          !s.createdByUid ||
          s.createdBy === 'Workspace Admin' ||
          (s.createdBy && s.createdBy.toLowerCase().includes('admin'));
        const matchesTargetRole = !s.targetRole || s.targetRole === 'all' || s.targetRole === callerRole;
        return isCreator || isCustomCadence || (isAdminCreated && matchesTargetRole);
      });
    }

    sequencesServerCache.set(cacheKey, {
      sequences,
      count: sequences.length,
      cachedAt: Date.now(),
    });

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
    sequencesServerCache.clear(); // Invalidate cache on sequence creation/update
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

    // 1. Save to local fallback storage
    const currentSequences = getStoredSequences();
    const existingIndex = currentSequences.findIndex((s) => s.id === seqId);
    if (existingIndex >= 0) {
      currentSequences[existingIndex] = { ...currentSequences[existingIndex], ...sequenceData };
    } else {
      currentSequences.unshift(sequenceData);
    }
    saveStoredSequences(currentSequences);

    // 2. Also save to Firestore if available
    if (isAdminReady && adminDb) {
      try {
        await adminDb.collection('sequences').doc(seqId).set(sequenceData, { merge: true });
      } catch (fsErr) {
        console.warn('[API /sequences POST] Firestore sequence write warning (quota/network):', (fsErr as any)?.message || fsErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Sequence saved successfully',
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
    sequencesServerCache.clear();
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

