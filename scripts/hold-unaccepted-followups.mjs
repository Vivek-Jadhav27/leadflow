/**
 * One-off repair: leads whose connection request was sent but not accepted may already have their first
 * follow-up scheduled as a normal pending task with a due date. Since this release, such a step is HELD
 * until the prospect accepts (then scheduled from the acceptance date). This script converts the existing
 * ones the same way.
 *
 *   node --env-file=.env.local scripts/hold-unaccepted-followups.mjs            # dry run: only lists what would change
 *   node --env-file=.env.local scripts/hold-unaccepted-followups.mjs --apply    # makes the changes
 *
 * Optional: --workspace <id> to limit it to one workspace.
 * (Against the Firestore emulator, set FIRESTORE_EMULATOR_HOST and no credentials are needed.)
 *
 * Only touches: leads whose connection is sent-but-not-accepted, that are in an active sequence, whose current
 * step is a message/follow-up step after a connection-request step, and that have a pending task for that step.
 * Nothing is deleted.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const wsFlag = process.argv.indexOf('--workspace');
const onlyWorkspace = wsFlag > -1 ? process.argv[wsFlag + 1] : null;

function loadServiceAccount() {
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1, -1).trim();
  if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-leadflow' });
  } else {
    const sa = loadServiceAccount();
    if (!sa) {
      console.error('No FIREBASE_SERVICE_ACCOUNT_KEY found. Run with: node --env-file=.env.local scripts/hold-unaccepted-followups.mjs');
      process.exit(1);
    }
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
}
const db = getFirestore();

const AWAITING = ['request_sent', 'pending', 'request_pending'];
const INACTIVE = ['replied', 'completed', 'stopped', 'paused'];
const activeSteps = (seq) =>
  (Array.isArray(seq.steps) ? seq.steps : []).filter((s) => s && s.enabled !== false).sort((a, b) => a.stepNumber - b.stepNumber);

const seqCache = new Map();
async function getSequence(id) {
  if (!seqCache.has(id)) {
    const snap = await db.collection('sequences').doc(id).get();
    seqCache.set(id, snap.exists ? snap.data() : null);
  }
  return seqCache.get(id);
}

const candidates = [];
for (const status of AWAITING) {
  let q = db.collection('leads').where('connectionStatus', '==', status);
  if (onlyWorkspace) q = q.where('workspaceId', '==', onlyWorkspace);
  const snap = await q.get();
  for (const doc of snap.docs) candidates.push(doc);
}

let found = 0;
let changed = 0;
for (const doc of candidates) {
  const lead = { id: doc.id, ...doc.data() };
  if (!lead.sequenceId || lead.awaitingConnection || INACTIVE.includes(lead.outreachStatus) || lead.disposition === 'archived') continue;
  const seq = await getSequence(lead.sequenceId);
  if (!seq) continue;

  const steps = activeSteps(seq);
  const step = steps.find((s) => s.stepNumber === lead.currentStepNumber);
  const isMessageStep = step && (step.actionType === 'send_message' || step.actionType === 'followup');
  const afterConnect = step && steps.some((s) => s.actionType === 'connection_request' && s.stepNumber < step.stepNumber);
  if (!isMessageStep || !afterConnect) continue;

  const tasksSnap = await db
    .collection('tasks')
    .where('leadId', '==', lead.id)
    .where('status', '==', 'pending')
    .get();
  const stepTasks = tasksSnap.docs.filter((t) => t.data().sequenceId === lead.sequenceId && t.data().stepNumber === lead.currentStepNumber);
  if (stepTasks.length === 0) continue;

  found++;
  console.log(
    `${apply ? 'HOLD ' : 'would hold '} ${lead.firstName || ''} ${lead.lastName || ''} (${lead.id}) — step ${lead.currentStepNumber} "${step.title}", was due ${lead.nextFollowUpDate || stepTasks[0].data().dueDate}`
  );
  if (!apply) continue;

  const batch = db.batch();
  const now = new Date().toISOString();
  batch.update(doc.ref, {
    nextFollowUpDate: null,
    nextActionTitle: 'Waiting for connection acceptance',
    awaitingConnection: true,
    updatedAt: now,
  });
  for (const t of stepTasks) batch.update(t.ref, { status: 'held', heldReason: 'awaiting_connection', updatedAt: now });
  await batch.commit();
  changed++;
}

console.log(
  `\n${found} lead(s) ${apply ? 'found and updated' : 'would be updated'}${apply ? ` (${changed} written)` : ''}.` +
    (apply ? '' : ' Re-run with --apply to make the changes.')
);
