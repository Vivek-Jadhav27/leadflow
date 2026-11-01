import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// CORS headers to permit Chrome Extension requests from any origin or chrome-extension://
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

export async function GET() {
  const leads = getStoredLeads();
  return NextResponse.json(
    {
      success: true,
      count: leads.length,
      leads,
    },
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.firstName || !body.company) {
      return NextResponse.json(
        { error: 'First name and company name are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const now = new Date().toISOString();
    const newLead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      currentStepNumber: 1,
      totalSteps: 4,
      connectionStatus: body.connectionStatus || 'not_connected',
      outreachStatus: body.sequenceId ? 'in_sequence' : 'unassigned',
      disposition: body.disposition || 'active',
      notes: body.notes || 'Added via LeadFlow LinkedIn Chrome Extension',
      createdAt: now,
      updatedAt: now,
    };

    const currentLeads = getStoredLeads();
    
    // Check if lead with same LinkedIn URL already exists
    const existingIndex = currentLeads.findIndex(
      (l) => l.linkedinUrl && newLead.linkedinUrl && l.linkedinUrl === newLead.linkedinUrl
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
        message: 'Lead saved successfully',
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
