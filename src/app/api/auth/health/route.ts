import { NextResponse } from 'next/server';
import { loadServiceAccount, isFirebaseAdminConfigured } from '@/lib/firebaseAdmin';

export async function GET() {
  const sa = loadServiceAccount();
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    nodeEnv: process.env.NODE_ENV,
    environmentChecks: {
      hasServiceAccountKeyEnv: !!rawKey,
      rawKeyLength: rawKey ? rawKey.length : 0,
      rawKeyStartsWith: rawKey ? rawKey.trim().substring(0, 10) : null,
      isServiceAccountParsed: !!sa,
      projectId: sa?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
      clientEmail: sa?.client_email || null,
      hasPrivateKey: !!sa?.private_key,
      isFirebaseAdminReady: isFirebaseAdminConfigured,
      smtpConfigured: {
        host: process.env.SMTP_HOST || null,
        port: process.env.SMTP_PORT || null,
        hasUser: !!process.env.SMTP_USER,
        hasPass: !!process.env.SMTP_PASS,
        emailFrom: process.env.EMAIL_FROM || null,
      },
    },
  });
}

