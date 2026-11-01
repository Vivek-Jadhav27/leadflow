export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { adminAuth, adminDb, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-workspace-id',
};

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'extension-leads.json');

function saveStoredLeads(leads: any[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    let existing: any[] = [];
    if (fs.existsSync(DATA_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) || [];
      } catch {}
    }
    const map = new Map<string, any>();
    existing.forEach((l) => map.set(l.id, l));
    leads.forEach((l) => map.set(l.id, l));
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(map.values()), null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local extension leads backup:', err);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
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
    const rawLeads = body.leads;

    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      return NextResponse.json(
        { error: 'No leads provided. An array of leads is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    let capturedBy = body.capturedBy || 'csv_bulk_import';
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
      } catch {}
    }

    const workspaceId = resolvedWorkspaceId || 'default_workspace';
    const now = new Date().toISOString();

    const formattedLeads = rawLeads.map((item: any, idx: number) => {
      const id = item.id || `lead_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const seqId = item.sequenceId || body.defaultSequenceId || null;
      const seqName = item.sequenceName || (seqId ? 'LinkedIn 4-Step Outbound' : null);

      return {
        id,
        firstName: (item.firstName || '').trim(),
        lastName: (item.lastName || '').trim(),
        company: (item.company || '').trim(),
        jobTitle: (item.jobTitle || 'Prospect').trim(),
        email: null,
        phone: null,
        linkedinUrl: (item.linkedinUrl || '').trim(),
        channel: 'linkedin' as const,
        sequenceId: seqId,
        sequenceName: seqName,
        currentStepNumber: seqId ? (item.currentStepNumber || 1) : 0,
        totalSteps: item.totalSteps || 4,
        connectionStatus: item.connectionStatus || 'not_started',
        outreachStatus: item.outreachStatus || (seqId ? 'in_sequence' : 'unassigned'),
        disposition: item.disposition || 'active',
        notes: item.notes || 'Imported via CSV bulk upload',
        capturedBy,
        capturedByUid,
        assignedToId: item.assignedToId || body.defaultAssignedToId || (capturedByUid ? capturedByUid : null),
        assignedToName: item.assignedToName || body.defaultAssignedToName || (capturedBy ? capturedBy.split('@')[0] : null),
        assignedToEmail: item.assignedToEmail || (capturedBy ? capturedBy : null),
        workspaceId: item.workspaceId || workspaceId,
        nextFollowUpDate: item.nextFollowUpDate || null,
        nextActionTitle: item.nextActionTitle || null,
        createdAt: item.createdAt || now,
        updatedAt: now,
      };
    });

    // Write to Firestore in chunks of up to 400 documents per batch
    if (isAdminReady && adminDb) {
      try {
        const chunkSize = 400;
        for (let i = 0; i < formattedLeads.length; i += chunkSize) {
          const chunk = formattedLeads.slice(i, i + chunkSize);
          const batch = adminDb.batch();
          for (const lead of chunk) {
            const docRef = adminDb.collection('leads').doc(lead.id);
            batch.set(docRef, lead, { merge: true });
          }
          await batch.commit();
        }
      } catch (fsErr) {
        console.error('[API /leads/bulk POST] Firestore batch error:', fsErr);
      }
    }

    // Server-side backup save
    saveStoredLeads(formattedLeads);

    return NextResponse.json(
      {
        success: true,
        count: formattedLeads.length,
        leads: formattedLeads,
        message: `Successfully imported ${formattedLeads.length} lead(s) to Firestore!`,
      },
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (err: any) {
    console.error('[API /leads/bulk POST] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to bulk import leads' },
      { status: 500, headers: corsHeaders }
    );
  }
}

