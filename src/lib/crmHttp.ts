import { NextResponse } from 'next/server';
import { PlanError } from '@/lib/crmPlanner';
import type { Actor } from '@/lib/crmPlanner';
import type { WorkspaceContext } from '@/lib/serverAuth';

export function actorFrom(ctx: WorkspaceContext): Actor {
  return {
    uid: ctx.uid,
    email: ctx.email,
    name: ctx.profile?.name || ctx.email.split('@')[0] || 'Workspace Member',
    role: ctx.role,
    workspaceId: ctx.workspaceId,
  };
}

/** Runs a handler body, mapping domain errors (PlanError) to their HTTP status and hiding anything else. */
export async function respond(fn: () => Promise<unknown>, label: string): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof PlanError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error(`[${label}] Error:`, err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    throw new PlanError(400, 'BAD_JSON', 'Request body must be valid JSON.');
  }
}

export function requireString(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new PlanError(400, 'BAD_REQUEST', `${name} is required.`);
  }
  return value.trim();
}
