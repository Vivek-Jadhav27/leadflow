import { NextResponse } from 'next/server';
import { isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public liveness probe. It deliberately reveals nothing about configuration, credentials or errors.
export async function GET() {
  let configured = false;
  try {
    configured = isFirebaseAdminConfigured();
  } catch {
    configured = false;
  }
  return NextResponse.json(
    { status: configured ? 'healthy' : 'degraded', timestamp: new Date().toISOString() },
    { status: configured ? 200 : 503 }
  );
}
