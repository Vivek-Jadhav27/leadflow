/**
 * Notes the system itself writes when a lead is created or imported (older leads still carry them).
 * They tell the rep nothing, so they are not shown; anything a person typed is.
 */
const SYSTEM_NOTES = [/^added to leadflow pipeline\.?$/i, /^imported via csv( bulk upload)?\.?$/i];

export function visibleNotes(notes?: string | null): string {
  const n = (notes || '').trim();
  return n && !SYSTEM_NOTES.some((re) => re.test(n)) ? n : '';
}
