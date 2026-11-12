import { NextRequest } from 'next/server';

// Best-effort, per-instance fixed-window limiter. On multi-instance/serverless deployments it only
// bounds abuse per instance; use a shared store (Redis/Upstash) or edge rate limiting for hard limits.
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}

/** Returns true if the request is allowed, false if the limit for `key` is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}
