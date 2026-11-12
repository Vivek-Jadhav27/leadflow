export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';
import { authenticateServerRequest } from '@/lib/serverAuth';

// CORS headers to permit Chrome Extension requests from any origin or chrome-extension://
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

// Use /tmp on Vercel/serverless environments because process.cwd() is read-only
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'extension-leads.json');

function getStoredLeads(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) || [];
  } catch (err) {
    console.error('Error reading extension leads file:', err);
    return [];
  }
}

function saveStoredLeads(leads: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving extension leads file:', err);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// In-memory server cache to minimize Firestore reads across concurrent users/components
interface CachedLeadsResult {
  leads: any[];
  count: number;
  cachedAt: number;
}
const leadsServerCache = new Map<string, CachedLeadsResult>();
const LEADS_SERVER_CACHE_TTL_MS = 45 * 1000; // 45 seconds TTL

export async function GET(req: NextRequest) {
  try {
    const workspaceIdParam =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    const cacheKey = workspaceIdParam || 'all';
    const cached = leadsServerCache.get(cacheKey);
    const nowTs = Date.now();

    if (cached && nowTs - cached.cachedAt < LEADS_SERVER_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          success: true,
          count: cached.count,
          leads: cached.leads,
          fromCache: true,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    let firestoreLeads: any[] = [];
    let authContext: any = null;
    try {
      authContext = await authenticateServerRequest(req);
    } catch (authErr) {
      console.warn('[API /leads GET] Auth check warning:', authErr);
    }

    const resolvedWorkspaceId = workspaceIdParam || authContext?.workspaceId || null;

    if (isAdminReady && adminDb) {
      try {
        let q: any = adminDb.collection('leads');
        if (resolvedWorkspaceId) {
          q = q.where('workspaceId', '==', resolvedWorkspaceId);
        }
        const snap = await q.get();
        if (!snap.empty) {
          firestoreLeads = snap.docs.map((d: any) => ({
            id: d.id,
            ...d.data(),
          }));
        }
      } catch (fsErr) {
        console.warn('[API /leads GET] Firestore read fallback:', fsErr);
      }
    }

    const storedLeads = getStoredLeads();
    // Merge: prefer Firestore leads, supplement with stored extension leads
    // Deduplicate by normalized linkedinUrl so same prospect never exists as separate docs
    const normUrl = (u: string) => (u || '').trim().toLowerCase().replace(/\/+$/, '');
    const leadMap = new Map<string, any>();
    const urlToIdMap = new Map<string, string>();

    const mergeLeadIntoMap = (l: any) => {
      const u = normUrl(l.linkedinUrl);
      if (u && urlToIdMap.has(u)) {
        const primaryId = urlToIdMap.get(u)!;
        const existing = leadMap.get(primaryId);
        if (existing) {
          leadMap.set(primaryId, {
            ...existing,
            ...l,
            id: primaryId,
            connectionNote: l.connectionNote || existing.connectionNote || null,
            notes: l.notes || existing.notes || null,
            company: l.company || existing.company,
            jobTitle: l.jobTitle || existing.jobTitle,
            outreachStatus: (l.outreachStatus === 'needs_sequence' || l.outreachStatus === 'in_sequence') ? l.outreachStatus : existing.outreachStatus,
            connectionStatus: (l.connectionStatus === 'request_sent' || l.connectionStatus === 'connected') ? l.connectionStatus : existing.connectionStatus,
          });
          return;
        }
      }

      if (leadMap.has(l.id)) {
        const existing = leadMap.get(l.id);
        leadMap.set(l.id, {
          ...existing,
          ...l,
          connectionNote: l.connectionNote || existing.connectionNote || null,
          notes: l.notes || existing.notes || null,
        });
      } else {
        leadMap.set(l.id, l);
        if (u) {
          urlToIdMap.set(u, l.id);
        }
      }
    };

    storedLeads.forEach(mergeLeadIntoMap);
    firestoreLeads.forEach(mergeLeadIntoMap);
    const merged = Array.from(leadMap.values());

    // Role-based Access Control & Strict Workspace Scoping:
    // 1. Leads must match the active workspace (if resolved)
    let finalLeads = resolvedWorkspaceId
      ? merged.filter((l) => l.workspaceId === resolvedWorkspaceId)
      : merged;

    if (authContext) {
      if (authContext.role !== 'admin') {
        const userUid = authContext.uid;
        const userEmail = (authContext.email || '').toLowerCase().trim();
        finalLeads = finalLeads.filter((l) => {
          const assignedEmail = (l.assignedToEmail || '').toLowerCase().trim();
          const capturedEmail = (l.capturedBy || '').toLowerCase().trim();
          return (
            (l.assignedToId && l.assignedToId === userUid) ||
            (l.capturedByUid && l.capturedByUid === userUid) ||
            (assignedEmail && assignedEmail === userEmail) ||
            (capturedEmail && capturedEmail === userEmail)
          );
        });
      }
    }

    leadsServerCache.set(cacheKey, {
      leads: finalLeads,
      count: finalLeads.length,
      cachedAt: Date.now(),
    });

    return NextResponse.json(
      {
        success: true,
        count: finalLeads.length,
        leads: finalLeads,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    console.error('[API /leads GET] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch leads' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    leadsServerCache.clear(); // Invalidate cache immediately on new lead creation/update
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

    const body = await req.json();

    if (!body.firstName || !body.company) {
      return NextResponse.json(
        { error: 'First name and company name are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    let capturedBy = body.capturedBy || 'extension_user';
    let capturedByUid = body.capturedByUid || null;
    let resolvedWorkspaceId =
      req.headers.get('x-workspace-id') ||
      body.workspaceId ||
      null;

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    if (isAdminReady && token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.email) {
          capturedBy = decoded.email;
          capturedByUid = decoded.uid;
        }
        if (!resolvedWorkspaceId && decoded?.uid) {
          const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
          if (userDoc.exists) {
            resolvedWorkspaceId = userDoc.data()?.currentWorkspaceId || null;
          }
          if (!resolvedWorkspaceId) {
            const ownedWsSnap = await adminDb.collection('workspaces').where('ownerId', '==', decoded.uid).limit(1).get();
            if (!ownedWsSnap.empty) {
              resolvedWorkspaceId = ownedWsSnap.docs[0].id;
            }
          }
        }
      } catch {
        // Fallback to body properties
      }
    }

    const now = new Date().toISOString();
    const isConnSent = body.isConnectionSent || body.connectionStatus === 'request_sent' || Boolean(body.connectionNote);
    const resolvedConnStatus = isConnSent ? 'request_sent' : (body.connectionStatus || 'not_started');
    const resolvedOutreachStatus = body.outreachStatus || (body.sequenceId ? 'in_sequence' : 'unassigned');
    const resolvedStepNumber = (isConnSent && body.sequenceId) ? 2 : (body.currentStepNumber || (body.sequenceId ? 1 : 0));
    const defaultFollowUp = (isConnSent && body.sequenceId)
      ? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
      : null;

    let defaultActionTitle: string | null = null;
    if (resolvedOutreachStatus === 'needs_sequence') {
      defaultActionTitle = 'Draft Follow-up Cadence';
    } else if (resolvedOutreachStatus === 'pending_sequence_approval') {
      defaultActionTitle = 'Awaiting Admin Approval';
    } else if (isConnSent) {
      defaultActionTitle = 'Step 2: Follow-up 1';
    }

    const normUrl = (u: string) => (u || '').trim().toLowerCase().replace(/\/+$/, '');
    const incomingNormUrl = normUrl(body.linkedinUrl);

    // Look up existing lead in Firestore or local store to avoid duplicate documents
    let existingDocId: string | null = body.id || null;
    let existingDocData: any = null;

    if (isAdminReady && adminDb) {
      try {
        if (existingDocId) {
          const docSnap = await adminDb.collection('leads').doc(existingDocId).get();
          if (docSnap.exists) {
            existingDocData = docSnap.data();
          } else {
            existingDocId = null;
          }
        }

        // 1. First check in-memory cache and local stored leads (0 Firestore reads!)
        const memoryLeads = leadsServerCache.get(resolvedWorkspaceId || 'all')?.leads || getStoredLeads();
        if (!existingDocId && incomingNormUrl) {
          const match = memoryLeads.find((l: any) => l.linkedinUrl && normUrl(l.linkedinUrl) === incomingNormUrl);
          if (match) {
            existingDocId = match.id;
            existingDocData = match;
          }
        }

        if (!existingDocId && body.firstName && body.lastName) {
          const fLower = body.firstName.trim().toLowerCase();
          const lLower = (body.lastName || '').trim().toLowerCase();
          const match = memoryLeads.find(
            (l: any) =>
              (l.firstName || '').trim().toLowerCase() === fLower &&
              (l.lastName || '').trim().toLowerCase() === lLower
          );
          if (match) {
            existingDocId = match.id;
            existingDocData = match;
          }
        }

        // 2. If not found in memory, do a targeted indexed lookup (limit 1) instead of scanning entire collection
        if (!existingDocId && incomingNormUrl && body.linkedinUrl) {
          let q: any = adminDb.collection('leads');
          if (resolvedWorkspaceId) {
            q = q.where('workspaceId', '==', resolvedWorkspaceId);
          }
          q = q.where('linkedinUrl', '==', body.linkedinUrl).limit(1);
          const snap = await q.get();
          if (!snap.empty) {
            existingDocId = snap.docs[0].id;
            existingDocData = snap.docs[0].data();
          }
        }
      } catch (findErr) {
        console.warn('[API /leads POST] Existing lead lookup failed:', findErr);
      }
    }

    const targetLeadId = existingDocId || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const resolvedConnNote = body.connectionNote || existingDocData?.connectionNote || null;

    const newLead = {
      ...(existingDocData || {}),
      id: targetLeadId,
      firstName: body.firstName.trim(),
      lastName: (body.lastName || existingDocData?.lastName || '').trim(),
      company: body.company.trim() || existingDocData?.company,
      jobTitle: (body.jobTitle || existingDocData?.jobTitle || 'Prospect').trim(),
      email: body.email ? body.email.trim() : (existingDocData?.email || null),
      phone: body.phone ? body.phone.trim() : (existingDocData?.phone || null),
      linkedinUrl: body.linkedinUrl || existingDocData?.linkedinUrl || '',
      channel: 'linkedin' as const,
      sequenceId: body.sequenceId || existingDocData?.sequenceId || null,
      sequenceName: body.sequenceName || existingDocData?.sequenceName || (body.sequenceId ? 'LinkedIn 4-Step Outbound' : null),
      sequenceMode: body.sequenceMode || existingDocData?.sequenceMode || (body.sequenceId ? 'approved' : null),
      connectionNote: resolvedConnNote,
      customSteps: body.customSteps || existingDocData?.customSteps || null,
      currentStepNumber: resolvedStepNumber,
      totalSteps: body.totalSteps || existingDocData?.totalSteps || 4,
      connectionStatus: resolvedConnStatus,
      outreachStatus: resolvedOutreachStatus,
      disposition: body.disposition || existingDocData?.disposition || 'active',
      notes: body.notes || (resolvedConnNote ? `Connection note: ${resolvedConnNote}` : (existingDocData?.notes || 'Added to LeadFlow pipeline')),
      capturedBy: capturedBy || existingDocData?.capturedBy,
      capturedByUid: capturedByUid || existingDocData?.capturedByUid,
      assignedToId: body.assignedToId || existingDocData?.assignedToId || (capturedByUid ? capturedByUid : null),
      assignedToName: body.assignedToName || existingDocData?.assignedToName || (capturedBy ? capturedBy.split('@')[0] : null),
      assignedToEmail: body.assignedToEmail || existingDocData?.assignedToEmail || (capturedBy ? capturedBy : null),
      workspaceId: resolvedWorkspaceId || existingDocData?.workspaceId || 'default_workspace',
      nextFollowUpDate: body.nextFollowUpDate || existingDocData?.nextFollowUpDate || defaultFollowUp,
      nextActionTitle: body.nextActionTitle || defaultActionTitle,
      createdAt: existingDocData?.createdAt || body.createdAt || now,
      updatedAt: now,
    };

    // 1. Save to Firestore 'leads' collection
    if (isAdminReady && adminDb) {
      try {
        // If custom sequence was supplied from extension, create it in sequences collection
        if (body.sequenceMode === 'custom' || body.outreachStatus === 'pending_sequence_approval') {
          const customSeqId = newLead.sequenceId || `seq_custom_${newLead.id}`;
          const noteText =
            body.connectionNote ||
            newLead.connectionNote ||
            body.notes?.match(/connection note:\s*(.+)/i)?.[1]?.trim() ||
            body.notes?.match(/connection sent with note:\s*"?([^"]+)"?/i)?.[1]?.trim() ||
            '';

          let steps: any[] = [];
          if (Array.isArray(body.customSteps) && body.customSteps.length > 0) {
            const hasStep1 = body.customSteps.some((s: any) => s.stepNumber === 1 || s.actionType === 'connection_request');
            if (hasStep1) {
              steps = body.customSteps.map((s: any) => {
                if (s.stepNumber === 1 || s.actionType === 'connection_request') {
                  return {
                    stepNumber: 1,
                    actionType: 'connection_request',
                    title: s.title || 'Connection Request',
                    delayDays: 0,
                    messageTemplate: s.messageTemplate || noteText,
                    enabled: true,
                  };
                }
                return {
                  stepNumber: s.stepNumber,
                  actionType: s.actionType || 'send_message',
                  title: s.title || `Follow-up ${s.stepNumber - 1}`,
                  delayDays: s.delayDays || 3,
                  messageTemplate: s.messageTemplate || '',
                  enabled: true,
                };
              });
            } else {
              steps = [
                {
                  stepNumber: 1,
                  actionType: 'connection_request',
                  title: 'Connection Request',
                  delayDays: 0,
                  messageTemplate: noteText,
                  enabled: true,
                },
                ...body.customSteps.map((s: any, idx: number) => ({
                  stepNumber: s.stepNumber || idx + 2,
                  actionType: s.actionType || 'send_message',
                  title: s.title || `Follow-up ${idx + 1}`,
                  delayDays: s.delayDays || (idx === 0 ? 3 : 7),
                  messageTemplate: s.messageTemplate || '',
                  enabled: true,
                }))
              ];
            }
          } else {
            steps = [
              {
                stepNumber: 1,
                actionType: 'connection_request',
                title: 'Connection Request',
                delayDays: 0,
                messageTemplate: noteText,
                enabled: true,
              },
              {
                stepNumber: 2,
                actionType: 'send_message',
                title: 'First Follow-up',
                delayDays: 3,
                messageTemplate: `Hi ${newLead.firstName}, thanks for connecting! Following up to see if you had a moment to review how we help teams at ${newLead.company}.`,
                enabled: true,
              }
            ];
          }

          const customSeq = {
            id: customSeqId,
            name: `Custom Cadence: ${newLead.firstName} ${newLead.lastName}`,
            channel: 'linkedin',
            description: `Bespoke 1:1 cadence created by ${capturedBy} for ${newLead.firstName} ${newLead.lastName} at ${newLead.company}`,
            steps,
            status: 'pending_approval',
            approvalStatus: 'pending',
            workspaceId: newLead.workspaceId,
            createdBy: capturedBy,
            createdByUid: capturedByUid,
            createdByRole: 'sdr',
            targetRole: 'sdr',
            isCustom: true,
            targetLeadId: newLead.id,
            targetLeadName: `${newLead.firstName} ${newLead.lastName}`,
            targetLeadCompany: newLead.company,
            targetLeadLinkedin: newLead.linkedinUrl,
            createdAt: now,
            updatedAt: now,
          };
          await adminDb.collection('sequences').doc(customSeqId).set(customSeq, { merge: true });
          newLead.sequenceId = customSeqId;
          newLead.sequenceName = customSeq.name;
        }

        await adminDb.collection('leads').doc(newLead.id).set(newLead, { merge: true });

        // If connection note was sent, log an activity event
        if (newLead.connectionNote) {
          const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await adminDb.collection('activities').doc(actId).set({
            id: actId,
            leadId: newLead.id,
            leadName: `${newLead.firstName} ${newLead.lastName}`,
            type: 'linkedin_connect',
            title: 'LinkedIn Connection Note Sent',
            description: newLead.connectionNote,
            actorName: newLead.assignedToName || capturedBy,
            timestamp: now,
            workspaceId: newLead.workspaceId,
          }, { merge: true });
        }

        // If SDR chose "Note sent only; draft follow-up cadence later on portal", create pending task
        if (resolvedOutreachStatus === 'needs_sequence') {
          const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await adminDb.collection('tasks').doc(taskId).set({
            id: taskId,
            title: `Draft Follow-up Cadence for ${newLead.firstName} ${newLead.lastName}`,
            leadId: newLead.id,
            leadName: `${newLead.firstName} ${newLead.lastName}`,
            leadCompany: newLead.company,
            leadLinkedin: newLead.linkedinUrl,
            type: 'manual_review',
            dueDate: new Date().toISOString().split('T')[0],
            assignedToId: newLead.assignedToId || 'sdr_current',
            assignedToName: newLead.assignedToName || 'Outbound SDR',
            priority: 'high',
            status: 'pending',
            notes: newLead.connectionNote ? `Connection sent with note: "${newLead.connectionNote}"` : 'Connection request sent on LinkedIn. Needs follow-up sequence.',
            workspaceId: newLead.workspaceId,
            createdAt: now,
            updatedAt: now,
          }, { merge: true });
        }
      } catch (fsErr) {
        console.warn('[API /leads POST] Firestore lead write warning:', fsErr);
      }
    }

    // 2. Also save to local file for offline / development fallback
    const currentLeads = getStoredLeads();
    const existingIndex = currentLeads.findIndex(
      (l) => l.id === newLead.id || (incomingNormUrl && normUrl(l.linkedinUrl) === incomingNormUrl)
    );

    if (existingIndex >= 0) {
      currentLeads[existingIndex] = {
        ...currentLeads[existingIndex],
        ...newLead,
        id: currentLeads[existingIndex].id,
        connectionNote: newLead.connectionNote || currentLeads[existingIndex].connectionNote || null,
        notes: newLead.notes || currentLeads[existingIndex].notes || null,
        updatedAt: now,
      };
    } else {
      currentLeads.unshift(newLead);
    }
    saveStoredLeads(currentLeads);

    return NextResponse.json(
      {
        success: true,
        message: 'Lead saved to Firestore and pipeline store',
        lead: newLead,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.error('API /leads POST Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process lead' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    const now = new Date().toISOString();

    // 1. Batch updates if body.leads array is provided
    if (Array.isArray(body?.leads) && body.leads.length > 0) {
      const itemsToUpdate = body.leads.filter((item: any) => item && item.id);

      if (isAdminReady && adminDb) {
        try {
          const chunkSize = 400;
          for (let i = 0; i < itemsToUpdate.length; i += chunkSize) {
            const chunk = itemsToUpdate.slice(i, i + chunkSize);
            const batch = adminDb.batch();
            for (const item of chunk) {
              const docRef = adminDb.collection('leads').doc(item.id);
              batch.set(docRef, { ...item, updatedAt: now }, { merge: true });
            }
            await batch.commit();
          }
        } catch (fsErr) {
          console.warn('[API /leads PATCH batch] Firestore update error:', fsErr);
        }
      }

      // Update local storage backup
      const currentLeads = getStoredLeads();
      const updatesMap = new Map<string, any>();
      itemsToUpdate.forEach((item: any) => updatesMap.set(item.id, item));

      const updatedStored = currentLeads.map((lead) => {
        if (updatesMap.has(lead.id)) {
          return { ...lead, ...updatesMap.get(lead.id), updatedAt: now };
        }
        return lead;
      });
      saveStoredLeads(updatedStored);

      return NextResponse.json(
        { success: true, count: itemsToUpdate.length, message: 'Leads updated in Firestore' },
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Single lead update
    if (!body.id) {
      return NextResponse.json({ error: 'Lead id or leads array is required' }, { status: 400, headers: corsHeaders });
    }

    const updates = { ...body, updatedAt: now };

    // Update in Firestore
    if (isAdminReady && adminDb) {
      try {
        await adminDb.collection('leads').doc(body.id).set(updates, { merge: true });
      } catch (e) {
        console.warn('[API /leads PATCH] Firestore update error:', e);
      }
    }

    // Update local file
    const currentLeads = getStoredLeads();
    const idx = currentLeads.findIndex((l) => l.id === body.id);
    if (idx >= 0) {
      currentLeads[idx] = { ...currentLeads[idx], ...updates };
      saveStoredLeads(currentLeads);
    }

    return NextResponse.json({ success: true, lead: updates }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('id');
    const queryIds = searchParams.get('ids');
    const linkedinUrl = searchParams.get('linkedinUrl');

    let bodyIds: string[] = [];
    let bodyId: string | null = null;
    let bodyLinkedinUrl: string | null = null;

    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) {
        bodyIds = body.ids;
      }
      bodyId = body?.id;
      bodyLinkedinUrl = body?.linkedinUrl;
    } catch {
      // Body is optional
    }

    const targetIdsSet = new Set<string>();
    if (queryId) targetIdsSet.add(queryId);
    if (bodyId) targetIdsSet.add(bodyId);
    if (queryIds) {
      queryIds.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => targetIdsSet.add(id));
    }
    bodyIds.forEach((id) => {
      if (id && typeof id === 'string') targetIdsSet.add(id.trim());
    });

    const targetIds = Array.from(targetIdsSet);
    const targetUrl = (linkedinUrl || bodyLinkedinUrl || '').trim().toLowerCase();

    if (targetIds.length === 0 && !targetUrl) {
      return NextResponse.json(
        { error: 'Lead id, ids array, or linkedinUrl parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    // Delete from Firestore in batches
    if (isAdminReady && adminDb && targetIds.length > 0) {
      try {
        const chunkSize = 400;
        for (let i = 0; i < targetIds.length; i += chunkSize) {
          const chunk = targetIds.slice(i, i + chunkSize);
          const batch = adminDb.batch();
          for (const tid of chunk) {
            batch.delete(adminDb.collection('leads').doc(tid));
          }
          await batch.commit();
        }
      } catch (fsErr) {
        console.warn('[API /leads DELETE] Firestore delete error:', fsErr);
      }
    }

    // Delete matching items from local backup file
    const currentLeads = getStoredLeads();
    const idSet = new Set(targetIds);
    const filtered = currentLeads.filter((l) => {
      if (idSet.has(l.id) || idSet.has(String(l.id))) return false;
      if (targetUrl && l.linkedinUrl && l.linkedinUrl.trim().toLowerCase() === targetUrl) return false;
      return true;
    });

    saveStoredLeads(filtered);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully deleted ${targetIds.length || 1} lead(s) from database`,
        deletedCount: targetIds.length || 1,
        remainingCount: filtered.length,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('API /leads DELETE Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete lead' },
      { status: 500, headers: corsHeaders }
    );
  }
}
