/** Workspace-timezone date helpers. Pure and dependency-free so they run identically on server and client. */

/** Extracts an IANA zone from a free-form setting such as "America/New_York (UTC-5)"; falls back to UTC. */
export function parseTimezone(raw?: string | null): string {
  const m = /([A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)/.exec(raw || '');
  if (m) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: m[1] });
      return m[1];
    } catch {
      // fall through
    }
  }
  return 'UTC';
}

/** YYYY-MM-DD for `now` in the given time zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Pure calendar arithmetic on a YYYY-MM-DD string (no local-time or DST effects). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

