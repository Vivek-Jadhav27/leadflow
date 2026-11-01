import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const vercelEnv = process.env.VERCEL_ENV || 'unknown';
  const nodeEnv = process.env.NODE_ENV;

  // 1. Inspect Service Account Key format safely without importing any SDK
  let saParseError: string | null = null;
  let saParsed: { project_id?: string; client_email?: string; hasPrivateKey?: boolean } | null = null;

  if (rawKey) {
    try {
      let str = rawKey.trim();
      if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
        str = str.slice(1, -1).trim();
      }
      if (!str.startsWith('{') && !str.includes('\n') && str.length > 50) {
        try {
          const decoded = Buffer.from(str, 'base64').toString('utf8').trim();
          if (decoded.startsWith('{')) str = decoded;
        } catch {}
      }
      if (str.startsWith('{')) {
        const obj = JSON.parse(str);
        saParsed = {
          project_id: obj.project_id,
          client_email: obj.client_email,
          hasPrivateKey: !!obj.private_key,
        };
      } else {
        saParseError = 'String does not start with { or base64 JSON object';
      }
    } catch (e) {
      saParseError = (e as Error).message;
    }
  }

  // 2. Safely attempt dynamic import of firebaseAdmin to test runtime initialization
  let adminImportError: { message: string; stack?: string } | null = null;
  let adminAppReady = false;
  let adminAuthReady = false;
  let adminDbReady = false;
  let isConfigured = false;

  try {
    const fbAdmin = await import('@/lib/firebaseAdmin');
    isConfigured = typeof fbAdmin.isFirebaseAdminConfigured === 'function' 
      ? Boolean(fbAdmin.isFirebaseAdminConfigured()) 
      : Boolean(fbAdmin.isFirebaseAdminConfigured);

    if (isConfigured) {
      try {
        const app = fbAdmin.getAdminApp();
        adminAppReady = !!app;
        const auth = fbAdmin.getAdminAuth();
        adminAuthReady = !!auth;
        const db = fbAdmin.getAdminDb();
        adminDbReady = !!db;
      } catch (initErr) {
        adminImportError = {
          message: (initErr as Error).message,
          stack: (initErr as Error).stack,
        };
      }
    }
  } catch (importErr) {
    adminImportError = {
      message: (importErr as Error).message,
      stack: (importErr as Error).stack,
    };
  }

  // 3. Always return 200 JSON with comprehensive diagnostics
  return NextResponse.json({
    status: isConfigured && adminDbReady ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    deployment: {
      vercelEnv,
      nodeEnv,
      branchHint: 'If testing on *.vercel.app preview domain, ensure environment variables have "Preview" checked in Vercel Settings',
    },
    serviceAccountEnv: {
      hasServiceAccountKeyEnv: !!rawKey,
      keyLength: rawKey ? rawKey.length : 0,
      keyPreviewPrefix: rawKey ? rawKey.trim().substring(0, 15) : null,
      saParseError,
      parsedInfo: saParsed,
    },
    firebaseAdminStatus: {
      isConfigured,
      adminAppReady,
      adminAuthReady,
      adminDbReady,
      error: adminImportError,
    },
    smtpStatus: {
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      hasUser: !!process.env.SMTP_USER,
      hasPass: !!process.env.SMTP_PASS,
      emailFrom: process.env.EMAIL_FROM || null,
    },
  }, { status: 200 });
}
