import type { Sequence } from '@/types/crm';

/**
 * Labels for who owns, last edited and approved a sequence.
 *
 * Ownership is the record's `createdBy*` fields: it never changes when someone else (e.g. an admin)
 * edits or approves the sequence. "You" is decided by user id; the role shown is the creator's role
 * as stored, never the viewer's.
 */

type Viewer = { uid?: string | null; email?: string | null; displayName?: string | null } | null | undefined;

const roleTag = (role?: string | null) => (role ? ` (${role.toUpperCase()})` : '');
const nameOf = (email?: string | null, fallback = 'Member') => (email ? email.split('@')[0] : fallback);

function isSame(uid: string | null | undefined, email: string | null | undefined, viewer: Viewer): boolean {
  if (!viewer) return false;
  // Prefer the stable id; only fall back to email for legacy records that never stored one.
  if (uid) return uid === viewer.uid;
  return Boolean(email && viewer.email && email.toLowerCase().trim() === viewer.email.toLowerCase().trim());
}

export function sequenceOwnerLabel(seq: Sequence, viewer: Viewer): string {
  if (isSame(seq.createdByUid, seq.createdBy, viewer)) return `Created by You${roleTag(seq.createdByRole)}`;
  return `Created by ${nameOf(seq.createdBy, 'SDR')}${roleTag(seq.createdByRole)}`;
}

/** Shown only when someone other than the owner last changed the sequence. */
export function sequenceEditorLabel(seq: Sequence, viewer: Viewer): string | null {
  const editorUid = seq.updatedByUid;
  if (!editorUid || editorUid === seq.createdByUid) return null;
  const who = editorUid === viewer?.uid ? 'You' : seq.updatedByName || nameOf(seq.updatedBy, 'Admin');
  return `Edited by ${who}${roleTag(seq.updatedByRole)}`;
}

export function sequenceApproverLabel(seq: Sequence, viewer: Viewer): string {
  if (!seq.approvedBy && !seq.approvedByUid) return 'Approved by Admin';
  const mine = seq.approvedByUid
    ? seq.approvedByUid === viewer?.uid
    : Boolean(
        seq.approvedBy &&
          ((viewer?.email && seq.approvedBy.toLowerCase().trim() === viewer.email.toLowerCase().trim()) ||
            (viewer?.displayName && seq.approvedBy.toLowerCase().trim() === viewer.displayName.toLowerCase().trim()))
      );
  return mine ? 'Approved by You (Admin)' : `Approved by ${nameOf(seq.approvedBy, 'Admin')}`;
}
