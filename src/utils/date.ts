/**
 * Formats a date string (ISO or YYYY-MM-DD) into a clean display format.
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Returns today's date in YYYY-MM-DD format based on local midnight.
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a scheduled date string matches today or is overdue (<= today).
 */
export function isTodayOrOverdue(scheduledDate: string): boolean {
  if (!scheduledDate) return false;
  const todayStr = getTodayString();
  // Extract YYYY-MM-DD from scheduledDate if it's ISO
  const stepDateStr = scheduledDate.split('T')[0];
  return stepDateStr <= todayStr;
}

/**
 * Calculates a default scheduled date N days from today in YYYY-MM-DD format.
 */
export function getFutureDateString(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
