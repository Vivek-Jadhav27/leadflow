import { NextResponse } from 'next/server';
import { loadServiceAccount, isFirebaseAdminConfigured, getAdminApp, getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let parseError: string | null = null;
    let sa = null;

    try {
      sa = loadServiceAccount();
    } catch (e) {
      parseError = (e as Error).message;
    }

    let adminInitError: string | null = null;
    let authReady = false;
    let dbReady = false;

    if (sa) {
      try {
        const app = getAdminApp();
        const auth = getAdminAuth();
        const db = getAdminDb();
        authReady = !!auth;
        dbReady = !!db;
      } catch (e) {
        adminInitError = (e as Error).message;
      }
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      nodeEnv: process.env.NODE_ENV,
      diagnostics: {
        hasServiceAccountKeyEnv: !!rawKey,
        keyCharacterLength: rawKey ? rawKey.length : 0,
        keyPreviewPrefix: rawKey ? rawKey.trim().substring(0, 15) : null,
        isServiceAccountParsed: !!sa,
        parseError,
        projectId: sa?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
        clientEmail: sa?.client_email || null,
        hasPrivateKey: !!sa?.private_key,
        adminInitError,
        authReady,
        dbReady,
        isFirebaseAdminReady: typeof isFirebaseAdminConfigured === 'function' ? isFirebaseAdminConfigured() : isFirebaseAdminConfigured,
        smtpConfigured: {
          host: process.env.SMTP_HOST || null,
          port: process.env.SMTP_PORT || null,
          hasUser: !!process.env.SMTP_USER,
          hasPass: !!process.env.SMTP_PASS,
          emailFrom: process.env.EMAIL_FROM || null,
        },
      },
    });
  } catch (fatalError) {
    return NextResponse.json(
      {
        status: 'fatal_diagnostic_error',
        message: (fatalError as Error)?.message || 'Unknown error',
      },
      { status: 200 }
    );
  }
}
