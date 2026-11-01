export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

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

export async function GET(req: NextRequest) {
  try {
    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    let firestoreLeads: any[] = [];
    const workspaceId =
      req.headers.get('x-workspace-id') ||
      req.nextUrl.searchParams.get('workspaceId');

    if (isAdminReady && adminDb) {
      try {
        let q: any = adminDb.collection('leads');
        if (workspaceId) {
          q = q.where('workspaceId', '==', workspaceId);
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
    const leadMap = new Map<string, any>();
    storedLeads.forEach((l) => leadMap.set(l.id, l));
    firestoreLeads.forEach((l) => leadMap.set(l.id, l));
    const merged = Array.from(leadMap.values());

    return NextResponse.json(
      {
        success: true,
        count: merged.length,
        leads: merged,
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
        }
      } catch {
        // Fallback to body properties
      }
    }

    const now = new Date().toISOString();
    const newLead = {
      id: body.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      firstName: body.firstName.trim(),
      lastName: (body.lastName || '').trim(),
      company: body.company.trim(),
      jobTitle: (body.jobTitle || 'Prospect').trim(),
      email: body.email ? body.email.trim() : null,
      phone: body.phone ? body.phone.trim() : null,
      linkedinUrl: body.linkedinUrl || '',
      channel: 'linkedin' as const,
      sequenceId: body.sequenceId || null,
      sequenceName: body.sequenceName || (body.sequenceId ? 'LinkedIn 4-Step Outbound' : null),
      currentStepNumber: body.currentStepNumber || (body.sequenceId ? 1 : 0),
      totalSteps: body.totalSteps || 4,
      connectionStatus: body.connectionStatus || 'not_started',
      outreachStatus: body.outreachStatus || (body.sequenceId ? 'in_sequence' : 'unassigned'),
      disposition: body.disposition || 'active',
      notes: body.notes || 'Added to LeadFlow pipeline',
      capturedBy,
      capturedByUid,
      assignedToId: body.assignedToId || null,
      assignedToName: body.assignedToName || null,
      assignedToEmail: body.assignedToEmail || null,
      workspaceId: resolvedWorkspaceId || 'default_workspace',
      nextFollowUpDate: body.nextFollowUpDate || null,
      nextActionTitle: body.nextActionTitle || null,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    // 1. Save to Firestore 'leads' collection
    if (isAdminReady && adminDb) {
      try {
        await adminDb.collection('leads').doc(newLead.id).set(newLead, { merge: true });
      } catch (fsErr) {
        console.warn('[API /leads POST] Firestore lead write warning:', fsErr);
      }
    }

    // 2. Also save to local file for offline / development fallback
    const currentLeads = getStoredLeads();
    const existingIndex = currentLeads.findIndex(
      (l) => l.id === newLead.id || (l.linkedinUrl && newLead.linkedinUrl && l.linkedinUrl === newLead.linkedinUrl)
    );

    if (existingIndex >= 0) {
      currentLeads[existingIndex] = {
        ...currentLeads[existingIndex],
        ...newLead,
        id: currentLeads[existingIndex].id,
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
    if (!body.id) {
      return NextResponse.json({ error: 'Lead id is required' }, { status: 400, headers: corsHeaders });
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    const now = new Date().toISOString();
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
    const id = searchParams.get('id');
    const linkedinUrl = searchParams.get('linkedinUrl');

    let bodyId = null;
    let bodyLinkedinUrl = null;
    try {
      const body = await req.json();
      bodyId = body?.id;
      bodyLinkedinUrl = body?.linkedinUrl;
    } catch {
      // Body is optional
    }

    const targetId = id || bodyId;
    const targetUrl = (linkedinUrl || bodyLinkedinUrl || '').trim().toLowerCase();

    if (!targetId && !targetUrl) {
      return NextResponse.json(
        { error: 'Lead id or linkedinUrl parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const isAdminReady =
      typeof isFirebaseAdminConfigured === 'function'
        ? isFirebaseAdminConfigured()
        : isFirebaseAdminConfigured;

    // Delete from Firestore
    if (isAdminReady && adminDb && targetId) {
      try {
        await adminDb.collection('leads').doc(targetId).delete();
      } catch (fsErr) {
        console.warn('[API /leads DELETE] Firestore delete error:', fsErr);
      }
    }

    const currentLeads = getStoredLeads();
    const filtered = currentLeads.filter((l) => {
      if (targetId && (l.id === targetId || String(l.id) === String(targetId))) return false;
      if (targetUrl && l.linkedinUrl && l.linkedinUrl.trim().toLowerCase() === targetUrl) return false;
      return true;
    });

    saveStoredLeads(filtered);

    return NextResponse.json(
      {
        success: true,
        message: 'Lead deleted from Firestore and store',
        count: filtered.length,
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
