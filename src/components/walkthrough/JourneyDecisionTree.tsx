'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Play,
  Compass,
  ArrowRight,
  Check,
  Building2,
  UserCheck,
  Layers,
  Sparkles,
  Shield,
  Clock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeData {
  x: number;
  y: number;
  w?: number;
  h?: number;
  type: 'admin' | 'member' | 'system' | 'decision' | 'end';
  owner: string;
  title: string;
  sub: string;
  status: string;
  desc: string;
  actions: [string, string, 'good' | 'blue' | 'warn' | 'bad', string][];
}

const NODES_DATA: Record<string, NodeData> = {
  start: {
    x: 860,
    y: 35,
    type: 'admin',
    owner: 'ADMIN',
    title: 'Create workspace',
    sub: 'Start a new LeadFlow account',
    status: 'Start',
    desc: 'The admin starts by choosing an individual workspace or creating a team workspace.',
    actions: [
      ['Individual account', 'Private workspace for one user.', 'good', 'individual'],
      ['Create team workspace', 'Set up a shared workspace.', 'blue', 'team'],
    ],
  },
  individual: {
    x: 410,
    y: 145,
    type: 'admin',
    owner: 'ADMIN',
    title: 'Individual workspace',
    sub: 'One user manages their own leads',
    status: 'Individual',
    desc: 'An individual account skips team invitations and goes directly to lead capture.',
    actions: [['Capture a lead', 'Start the prospect workflow.', 'blue', 'capture']],
  },
  team: {
    x: 1110,
    y: 145,
    type: 'admin',
    owner: 'ADMIN',
    title: 'Create team',
    sub: 'Admin owns workspace settings',
    status: 'Team created',
    desc: 'The admin creates a team workspace. Team records are private to authorized members of that team.',
    actions: [['Invite team member', 'Send an invitation.', 'blue', 'invite']],
  },
  invite: {
    x: 1110,
    y: 275,
    type: 'admin',
    owner: 'ADMIN',
    title: 'Invite member',
    sub: 'Invitation sent to teammate',
    status: 'Invited',
    desc: 'An invitation is sent. The member does not gain access until accepting it.',
    actions: [
      ['Accept invitation', 'Member joins the workspace.', 'good', 'joined'],
      ['Decline invitation', 'Member stays outside the team.', 'bad', 'declined'],
    ],
  },
  joined: {
    x: 980,
    y: 405,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Member joins team',
    sub: 'Access follows team permissions',
    status: 'Joined',
    desc: 'After joining, the member sees only the team records and functions their permissions allow.',
    actions: [['Capture a lead', 'Move to prospect capture.', 'blue', 'capture']],
  },
  declined: {
    x: 1250,
    y: 405,
    type: 'end',
    owner: 'END STATE',
    title: 'Invitation declined',
    sub: 'No member access granted',
    status: 'Closed',
    desc: 'The invite was declined. The admin can invite someone else; the prospect workflow is not blocked for other members.',
    actions: [
      ['Invite another member', 'Return to invite step.', 'blue', 'invite'],
      ['Continue as admin', 'Admin can capture a lead.', 'good', 'capture'],
    ],
  },
  capture: {
    x: 800,
    y: 275,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Capture lead',
    sub: 'Browser extension or manual entry',
    status: 'Lead capture',
    desc: 'A member saves a prospect from the browser extension or enters their details manually.',
    actions: [['Run duplicate check', 'Compare against existing leads.', 'blue', 'duplicate']],
  },
  duplicate: {
    x: 800,
    y: 535,
    type: 'decision',
    owner: 'DECISION 1',
    title: 'Possible duplicate?',
    sub: 'Does this prospect already exist?',
    status: 'Check required',
    desc: 'LeadFlow checks for a likely match before creating a duplicate record.',
    actions: [
      ['No match found', 'Continue with a new lead.', 'good', 'validate'],
      ['Possible duplicate', 'Open existing record; avoid duplicate creation.', 'warn', 'existing'],
      ['Missing information', 'Request required details.', 'bad', 'missing'],
    ],
  },
  existing: {
    x: 470,
    y: 660,
    type: 'end',
    owner: 'END STATE',
    title: 'Open existing lead',
    sub: 'Duplicate creation prevented',
    status: 'Existing record',
    desc: 'The user opens the matching record instead of creating a second lead.',
    actions: [
      ['Continue with existing lead', 'Review details and validate.', 'good', 'validate'],
      ['End this path', 'Leave the existing record unchanged.', 'blue', 'duplicate'],
    ],
  },
  missing: {
    x: 800,
    y: 660,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Complete lead details',
    sub: 'Fill required fields / verify data',
    status: 'Needs information',
    desc: 'The lead remains unready until required information is supplied and verified.',
    actions: [
      ['Details completed', 'Re-run validation.', 'good', 'validate'],
      ['Archive lead', 'Remove from active outreach.', 'bad', 'archived'],
    ],
  },
  archived: {
    x: 1070,
    y: 790,
    type: 'end',
    owner: 'END STATE',
    title: 'Lead archived',
    sub: 'No sequence is started',
    status: 'Archived',
    desc: 'The lead is archived and excluded from active outreach.',
    actions: [['Return to capture', 'Capture another lead.', 'blue', 'capture']],
  },
  validate: {
    x: 800,
    y: 790,
    type: 'system',
    owner: 'LEADFLOW SYSTEM',
    title: 'Enrich & validate',
    sub: 'Check quality and required fields',
    status: 'Validated',
    desc: 'LeadFlow checks data quality and required fields before outreach. Invalid records must be corrected or held for review.',
    actions: [
      ['Validation passed', 'Check LinkedIn connection status.', 'good', 'connection'],
      ['Needs verification', 'Hold until reviewed.', 'warn', 'verify'],
    ],
  },
  verify: {
    x: 510,
    y: 920,
    type: 'end',
    owner: 'END STATE',
    title: 'Needs verification',
    sub: 'Outreach remains blocked',
    status: 'On hold',
    desc: 'The record needs manual verification before it can move forward.',
    actions: [
      ['Verify details', 'Return to validation.', 'good', 'validate'],
      ['Archive lead', 'End this lead journey.', 'bad', 'archived'],
    ],
  },
  connection: {
    x: 800,
    y: 920,
    type: 'decision',
    owner: 'DECISION 2',
    title: 'Connection accepted?',
    sub: 'LinkedIn connection status',
    status: 'Choose status',
    desc: 'For LinkedIn sequences, acceptance is a gate. Pending, rejected, withdrawn, or unknown states cannot start outreach.',
    actions: [
      ['Accepted', 'Eligible to assign a sequence.', 'good', 'sequence'],
      ['Pending', 'Wait; do not start sequence.', 'warn', 'pending'],
      ['Rejected / withdrawn', 'Stop this path; no sequence.', 'bad', 'rejected'],
      ['Unknown', 'Verify status first.', 'warn', 'verify'],
    ],
  },
  pending: {
    x: 480,
    y: 1050,
    type: 'end',
    owner: 'WAIT STATE',
    title: 'Connection pending',
    sub: 'No sequence tasks created',
    status: 'Waiting',
    desc: 'LeadFlow waits for acceptance. No LinkedIn outreach sequence starts while pending.',
    actions: [
      ['Now accepted', 'Continue to sequence setup.', 'good', 'sequence'],
      ['Still pending', 'Keep waiting.', 'warn', 'pending'],
    ],
  },
  rejected: {
    x: 800,
    y: 1050,
    type: 'end',
    owner: 'END STATE',
    title: 'Rejected / withdrawn',
    sub: 'LinkedIn sequence blocked',
    status: 'Blocked',
    desc: 'A rejected or withdrawn connection cannot proceed to a LinkedIn outreach sequence.',
    actions: [
      ['Review status', 'Return to connection decision.', 'blue', 'connection'],
      ['End this path', 'Keep sequence inactive.', 'bad', 'rejected'],
    ],
  },
  sequence: {
    x: 1120,
    y: 920,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Choose sequence',
    sub: 'Standard or custom · LinkedIn',
    status: 'Not assigned',
    desc: 'The member selects a standard or custom sequence and reviews follow-up timing.',
    actions: [
      ['Standard sequence', 'Use a prepared template.', 'blue', 'approval'],
      ['Custom sequence', 'Build personalized steps.', 'blue', 'approval'],
    ],
  },
  approval: {
    x: 1120,
    y: 1050,
    type: 'decision',
    owner: 'DECISION 3',
    title: 'Approved to start?',
    sub: 'Review messages and schedule',
    status: 'Awaiting approval',
    desc: 'A sequence must be approved before activation. Saving or drafting a sequence does not start it.',
    actions: [
      ['Approve', 'Activate sequence and create tasks.', 'good', 'tasks'],
      ['Request changes', 'Return sequence for edits.', 'warn', 'changes'],
      ['Reject sequence', 'Keep it inactive.', 'bad', 'sequenceRejected'],
    ],
  },
  changes: {
    x: 1400,
    y: 1180,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Edit sequence',
    sub: 'Update steps and timing',
    status: 'Needs edits',
    desc: 'The sequence remains inactive while requested changes are made.',
    actions: [['Resubmit for approval', 'Return to approval decision.', 'blue', 'approval']],
  },
  sequenceRejected: {
    x: 1660,
    y: 1180,
    type: 'end',
    owner: 'END STATE',
    title: 'Sequence not approved',
    sub: 'No outreach tasks activated',
    status: 'Inactive',
    desc: 'The sequence is rejected and remains inactive.',
    actions: [['Create / choose another', 'Return to sequence setup.', 'blue', 'sequence']],
  },
  tasks: {
    x: 1120,
    y: 1180,
    type: 'system',
    owner: 'LEADFLOW SYSTEM',
    title: 'Create daily tasks',
    sub: 'Scheduled · Due today · Overdue',
    status: 'Task queue',
    desc: 'After approval, LeadFlow creates tasks based on sequence timing and makes the next action visible to the member.',
    actions: [['Open due task', 'Review the message and send manually.', 'blue', 'send']],
  },
  send: {
    x: 1120,
    y: 1310,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Send message manually',
    sub: 'Open profile, copy, send, log',
    status: 'Due today',
    desc: 'For LinkedIn, the member opens the profile, reviews the message, sends it manually, then records the task as sent.',
    actions: [
      ['Mark sent', 'Record completion and check replies.', 'good', 'reply'],
      ['Skip task', 'Record skipped task and continue per policy.', 'warn', 'skipped'],
      ['Pause sequence', 'Hold future tasks.', 'bad', 'paused'],
    ],
  },
  skipped: {
    x: 800,
    y: 1440,
    type: 'system',
    owner: 'LEADFLOW SYSTEM',
    title: 'Task skipped',
    sub: 'Skip recorded in activity history',
    status: 'Skipped',
    desc: 'The task is marked skipped. The sequence remains active unless the user pauses or stops it.',
    actions: [
      ['Continue to reply tracking', 'Review whether a reply arrived.', 'blue', 'reply'],
      ['Pause sequence', 'Put upcoming tasks on hold.', 'warn', 'paused'],
    ],
  },
  paused: {
    x: 510,
    y: 1440,
    type: 'end',
    owner: 'END STATE',
    title: 'Sequence paused',
    sub: 'Future tasks held until resumed',
    status: 'Paused',
    desc: 'A paused sequence does not create or execute new outreach tasks until resumed.',
    actions: [
      ['Resume sequence', 'Return to the task queue.', 'good', 'tasks'],
      ['Stop sequence', 'Cancel future tasks after confirmation.', 'bad', 'stopped'],
    ],
  },
  reply: {
    x: 1120,
    y: 1440,
    type: 'system',
    owner: 'SYSTEM + MEMBER',
    title: 'Check for reply',
    sub: 'Manual tracking or supported detection',
    status: 'No reply yet',
    desc: 'The user records the prospect response. No reply leaves the next scheduled follow-up in place unless the user changes it.',
    actions: [
      ['No reply', 'Keep next follow-up scheduled.', 'warn', 'noReply'],
      ['Positive reply', 'Prioritize conversation.', 'good', 'positive'],
      ['Objection', 'Review response and next steps.', 'warn', 'objection'],
      ['Not interested', 'Stop outreach.', 'bad', 'notInterested'],
      ['Meeting booked', 'Record meeting and close outreach.', 'good', 'meeting'],
    ],
  },
  noReply: {
    x: 800,
    y: 1570,
    type: 'system',
    owner: 'FOLLOW-UP PATH',
    title: 'Follow-up remains scheduled',
    sub: 'Continue if no response',
    status: 'Scheduled',
    desc: 'No reply is not the same as a negative reply. The next approved task remains scheduled.',
    actions: [['Continue journey', 'Update outcome or review analytics.', 'blue', 'analytics']],
  },
  positive: {
    x: 1050,
    y: 1570,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Positive reply',
    sub: 'Continue conversation',
    status: 'Interested',
    desc: 'The member can continue the conversation, qualify interest, or book a meeting.',
    actions: [
      ['Meeting booked', 'Update lead outcome.', 'good', 'meetingQualified'],
      ['Still qualifying', 'Keep working the lead.', 'blue', 'outcome'],
    ],
  },
  objection: {
    x: 1300,
    y: 1570,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Review objection',
    sub: 'Decide whether to pause',
    status: 'Review needed',
    desc: 'A real objection deserves review. The member decides whether to respond, pause, or stop future steps.',
    actions: [
      ['Pause for review', 'Hold future tasks.', 'warn', 'paused'],
      ['Continue after review', 'Keep approved tasks.', 'blue', 'outcome'],
      ['Stop sequence', 'Cancel future tasks.', 'bad', 'stopped'],
    ],
  },
  notInterested: {
    x: 1550,
    y: 1440,
    type: 'end',
    owner: 'END STATE',
    title: 'Not interested',
    sub: 'Stop outreach and update outcome',
    status: 'Stopped',
    desc: 'Negative reply stops the sequence after confirmation and updates the lead outcome.',
    actions: [['Save outcome', 'Record Not Interested.', 'bad', 'outcome']],
  },
  meeting: {
    x: 1550,
    y: 1570,
    type: 'end',
    owner: 'SUCCESS OUTCOME',
    title: 'Meeting booked',
    sub: 'Close sequence and update lead',
    status: 'Meeting booked',
    desc: 'Meeting booked becomes the lead outcome. The active outreach sequence is stopped and remaining tasks are cancelled as appropriate.',
    actions: [['View analytics', 'Review the updated result.', 'blue', 'analytics']],
  },
  meetingQualified: {
    x: 1550,
    y: 1570,
    type: 'end',
    owner: 'SUCCESS OUTCOME',
    title: 'Meeting booked',
    sub: 'Qualified conversation converted to meeting',
    status: 'Meeting booked',
    desc: 'The positive reply progressed to a booked meeting. The lead outcome is updated and outreach is closed.',
    actions: [['View analytics', 'Review the updated result.', 'blue', 'analytics']],
  },
  stopped: {
    x: 510,
    y: 1570,
    type: 'end',
    owner: 'END STATE',
    title: 'Sequence stopped',
    sub: 'Future tasks cancelled',
    status: 'Stopped',
    desc: 'The sequence has stopped and future tasks are cancelled. The lead record remains available.',
    actions: [['Update lead outcome', 'Record final status.', 'blue', 'outcome']],
  },
  outcome: {
    x: 800,
    y: 1310,
    type: 'member',
    owner: 'TEAM MEMBER',
    title: 'Update lead outcome',
    sub: 'Interested · Meeting · Converted · Lost',
    status: 'Outcome pending',
    desc: 'The final lead outcome is separate from reply status and should reflect the actual sales result.',
    actions: [
      ['Interested', 'Save lead as Interested.', 'good', 'analytics'],
      ['Converted', 'Save Converted and stop outreach.', 'good', 'analytics'],
      ['Lost / unresponsive', 'Record unsuccessful outcome.', 'bad', 'analytics'],
    ],
  },
  analytics: {
    x: 800,
    y: 1440,
    type: 'system',
    owner: 'LEADFLOW SYSTEM',
    title: 'Analytics & reporting',
    sub: 'Reply rate · Meetings · Conversion · Drop-off',
    status: 'Updated',
    desc: 'LeadFlow aggregates activity and outcomes into individual and team analytics. Demo metrics reflect only actions taken in this simulation.',
    actions: [
      ['Finish demo', 'Review final sample metrics.', 'good', 'finish'],
      ['Explore another branch', 'Return to the full tree.', 'blue', 'start'],
    ],
  },
  finish: {
    x: 800,
    y: 1570,
    type: 'end',
    owner: 'JOURNEY COMPLETE',
    title: 'Journey complete',
    sub: 'Lead outcome and activity recorded',
    status: 'Complete',
    desc: 'The walkthrough has reached a terminal outcome. You can reset the demo to explore alternate branches.',
    actions: [['Restart walkthrough', 'Reset the simulation.', 'blue', 'reset']],
  },
};

const EDGES_DATA: [string, string, string?][] = [
  ['start', 'individual', 'Individual'],
  ['start', 'team', 'Team'],
  ['team', 'invite', 'Invite'],
  ['invite', 'joined', 'Accepted'],
  ['invite', 'declined', 'Declined'],
  ['joined', 'capture', 'Capture lead'],
  ['individual', 'capture', 'Capture lead'],
  ['capture', 'duplicate', 'Check'],
  ['duplicate', 'validate', 'No match'],
  ['duplicate', 'existing', 'Match found'],
  ['duplicate', 'missing', 'Missing info'],
  ['existing', 'validate', 'Use existing'],
  ['missing', 'validate', 'Completed'],
  ['missing', 'archived', 'Archive'],
  ['validate', 'connection', 'Valid'],
  ['validate', 'verify', 'Verify'],
  ['verify', 'validate', 'Verified'],
  ['verify', 'archived', 'Archive'],
  ['connection', 'sequence', 'Accepted'],
  ['connection', 'pending', 'Pending'],
  ['connection', 'rejected', 'Rejected'],
  ['connection', 'verify', 'Unknown'],
  ['pending', 'sequence', 'Accepted later'],
  ['pending', 'pending', 'Still pending'],
  ['rejected', 'connection', 'Review'],
  ['sequence', 'approval', 'Standard / Custom'],
  ['approval', 'tasks', 'Approved'],
  ['approval', 'changes', 'Changes'],
  ['approval', 'sequenceRejected', 'Rejected'],
  ['changes', 'approval', 'Resubmit'],
  ['sequenceRejected', 'sequence', 'Try again'],
  ['tasks', 'send', 'Task due'],
  ['send', 'reply', 'Sent'],
  ['send', 'skipped', 'Skip'],
  ['send', 'paused', 'Pause'],
  ['skipped', 'reply', 'Continue'],
  ['skipped', 'paused', 'Pause'],
  ['paused', 'tasks', 'Resume'],
  ['paused', 'stopped', 'Stop'],
  ['reply', 'noReply', 'No reply'],
  ['reply', 'positive', 'Positive'],
  ['reply', 'objection', 'Objection'],
  ['reply', 'notInterested', 'Not interested'],
  ['reply', 'meeting', 'Meeting booked'],
  ['noReply', 'analytics', 'Continue'],
  ['positive', 'meetingQualified', 'Meeting booked'],
  ['positive', 'outcome', 'Qualifying'],
  ['meetingQualified', 'analytics', 'Review results'],
  ['objection', 'paused', 'Pause'],
  ['objection', 'outcome', 'Continue'],
  ['objection', 'stopped', 'Stop'],
  ['notInterested', 'outcome', 'Save outcome'],
  ['meeting', 'analytics', 'Review results'],
  ['stopped', 'outcome', 'Update outcome'],
  ['outcome', 'analytics', 'Save outcome'],
  ['analytics', 'finish', 'Finish'],
];

// Layout layering for clear hierarchy
function computeNodeCoordinates(): { nodes: Record<string, NodeData>; width: number; height: number } {
  const layers = [
    ['start'],
    ['individual', 'team'],
    ['invite'],
    ['joined', 'declined'],
    ['capture'],
    ['duplicate'],
    ['existing', 'missing'],
    ['validate'],
    ['connection'],
    ['verify', 'pending', 'rejected', 'sequence'],
    ['approval'],
    ['archived', 'changes', 'sequenceRejected', 'tasks'],
    ['send'],
    ['skipped', 'reply'],
    ['noReply', 'positive', 'objection', 'notInterested', 'meeting'],
    ['paused', 'meetingQualified'],
    ['stopped'],
    ['outcome'],
    ['analytics'],
    ['finish'],
  ];

  const width = 3200;
  const nodeW = 210;
  const gap = 76;
  const top = 58;
  const levelGap = 145;
  const placed = new Set<string>();
  const copyNodes = { ...NODES_DATA };

  layers.forEach((ids, depth) => {
    const total = ids.length * nodeW + Math.max(0, ids.length - 1) * gap;
    const startX = Math.max(28, (width - total) / 2);
    ids.forEach((id, i) => {
      if (!copyNodes[id]) return;
      copyNodes[id] = {
        ...copyNodes[id],
        x: startX + i * (nodeW + gap),
        y: top + depth * levelGap,
      };
      placed.add(id);
    });
  });

  const extra = Object.keys(copyNodes).filter((id) => !placed.has(id));
  if (extra.length) {
    const depth = layers.length;
    const total = extra.length * nodeW + Math.max(0, extra.length - 1) * gap;
    const startX = Math.max(28, (width - total) / 2);
    extra.forEach((id, i) => {
      copyNodes[id] = {
        ...copyNodes[id],
        x: startX + i * (nodeW + gap),
        y: top + depth * levelGap,
      };
    });
  }

  const height = top + (layers.length + Math.max(0, extra.length ? 1 : 0)) * levelGap + 140;
  return { nodes: copyNodes, width, height };
}

interface JourneyDecisionTreeProps {
  onClose?: () => void;
  isModal?: boolean;
}

export function JourneyDecisionTree({ onClose, isModal = false }: JourneyDecisionTreeProps) {
  const { nodes: layoutNodes, width: canvasW, height: canvasH } = React.useMemo(
    () => computeNodeCoordinates(),
    []
  );

  const [state, setState] = useState({
    selected: 'start',
    path: ['start'],
    visited: new Set(['start']),
    history: ['Demo ready. Choose one of the faint options on the canvas to begin.'],
    status: {} as Record<string, string>,
    leads: 0,
    seq: 0,
    tasks: 0,
    outcome: '—',
    zoom: 1.0,
    activeEdges: new Set<string>(),
    mode: 'explore' as 'explore' | 'present',
  });

  const viewportRef = useRef<HTMLDivElement>(null);

  // Progressive disclosure helper
  const branchParent = () => {
    if (layoutNodes[state.selected]?.type !== 'end') return null;
    for (let i = state.path.length - 2; i >= 0; i--) {
      const id = state.path[i];
      if ((layoutNodes[id]?.actions || []).filter((a) => a[3] !== 'reset').length > 1) {
        return id;
      }
    }
    return null;
  };

  const visibleCanvas = () => {
    const visible = new Set(state.path);
    const ghosts = new Set<string>();

    const addChildren = (id: string) => {
      EDGES_DATA.filter((e) => e[0] === id).forEach((e) => {
        visible.add(e[1]);
        if (!state.path.includes(e[1])) ghosts.add(e[1]);
      });
    };

    addChildren(state.selected);
    const bp = branchParent();
    if (bp) {
      visible.add(bp);
      addChildren(bp);
    }
    return { visible, ghosts, bp };
  };

  const cv = visibleCanvas();

  // Scroll to active node and center it horizontally in the viewport
  const scrollToNode = (nodeId: string, smooth: boolean = true) => {
    const n = layoutNodes[nodeId];
    if (n && viewportRef.current) {
      const container = viewportRef.current;
      const viewW = container.clientWidth || 900;

      // Node center in scaled coordinates
      const nodeCenterX = (n.x + (n.w || 210) / 2) * state.zoom;
      const nodeCenterY = (n.y + (n.h || 94) / 2) * state.zoom;

      // Center the node horizontally, position in the top third vertically
      const targetLeft = Math.max(0, nodeCenterX - viewW / 2);
      const targetTop = Math.max(0, nodeCenterY - 140);

      container.scrollTo({
        top: Math.min(targetTop, container.scrollHeight),
        left: targetLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Automatically scroll horizontally to center the start node on initial arrival
  useEffect(() => {
    scrollToNode('start', false);

    const t1 = setTimeout(() => {
      scrollToNode('start', false);
    }, 80);

    const t2 = setTimeout(() => {
      scrollToNode('start', true);
    }, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // State transitions
  const go = (from: string, to: string, msg?: string) => {
    setState((prev) => {
      const idx = prev.path.lastIndexOf(from);
      let newPath = idx >= 0 ? prev.path.slice(0, idx + 1) : [...prev.path];

      const existing = newPath.lastIndexOf(to);
      if (existing >= 0) {
        newPath = newPath.slice(0, existing + 1);
      } else {
        newPath.push(to);
      }

      const activeEdges = new Set(
        newPath.slice(0, -1).map((id, i) => `${id}-${newPath[i + 1]}`)
      );
      const visited = new Set(prev.visited);
      visited.add(to);

      const history = msg ? [msg, ...prev.history.slice(0, 5)] : prev.history;

      return {
        ...prev,
        path: newPath,
        selected: to,
        visited,
        activeEdges,
        history,
      };
    });

    setTimeout(() => scrollToNode(to), 50);
  };

  const act = (action: string, label: string) => {
    const from = state.selected;
    if (action === 'reset') {
      reset();
      return;
    }
    if (action === 'individual') {
      setState((s) => ({ ...s, status: { ...s.status, start: 'Individual' } }));
      go(from, 'individual', 'Individual workspace selected');
      return;
    }
    if (action === 'team') {
      setState((s) => ({ ...s, status: { ...s.status, start: 'Team' } }));
      go(from, 'team', 'Team workspace created');
      return;
    }
    if (action === 'capture') {
      go(from, 'capture', 'Opened lead capture');
      return;
    }
    if (action === 'captureLead') {
      setState((s) => ({ ...s, leads: s.leads + 1, status: { ...s.status, capture: 'Lead captured' } }));
      go(from, 'duplicate', 'Lead saved; checking for duplicates');
      return;
    }
    if (action === 'validate') {
      setState((s) => ({ ...s, status: { ...s.status, validate: 'Validated' } }));
      go(from, 'validate', 'Lead validation reviewed');
      return;
    }
    if (action === 'sequence') {
      go(from, 'sequence', 'Sequence setup opened');
      return;
    }
    if (action === 'approval') {
      go(from, 'approval', 'Sequence saved; approval required');
      return;
    }
    if (action === 'tasks') {
      setState((s) => ({
        ...s,
        seq: s.seq + 1,
        status: { ...s.status, approval: 'Approved', tasks: 'Due today' },
      }));
      go(from, 'tasks', 'Sequence approved; first task created');
      return;
    }
    if (action === 'send') {
      go(from, 'send', 'Opened due task');
      return;
    }
    if (action === 'reply') {
      setState((s) => ({
        ...s,
        tasks: s.tasks + 1,
        status: { ...s.status, send: 'Completed' },
      }));
      go(from, 'reply', 'Message marked as manually sent');
      return;
    }
    if (action === 'duplicate') {
      go(from, 'duplicate', 'Duplicate check opened');
      return;
    }
    if (action === 'invite') {
      go(from, 'invite', 'Invitation sent');
      return;
    }
    if (action === 'joined') {
      go(from, 'joined', 'Member joined the workspace');
      return;
    }
    if (action === 'declined') {
      go(from, 'declined', 'Invitation declined; access not granted');
      return;
    }
    if (action === 'existing') {
      setState((s) => ({ ...s, status: { ...s.status, duplicate: 'Possible duplicate' } }));
      go(from, 'existing', 'Existing record opened; duplicate prevented');
      return;
    }
    if (action === 'missing') {
      setState((s) => ({ ...s, status: { ...s.status, duplicate: 'Missing information' } }));
      go(from, 'missing', 'Lead held for missing information');
      return;
    }
    if (action === 'archived') {
      setState((s) => ({ ...s, status: { ...s.status, archived: 'Archived' } }));
      go(from, 'archived', 'Lead archived; outreach blocked');
      return;
    }
    if (action === 'verify') {
      go(from, 'verify', 'Verification required before outreach');
      return;
    }
    if (action === 'pending') {
      setState((s) => ({ ...s, status: { ...s.status, connection: 'Pending' } }));
      go(from, 'pending', 'Connection pending; sequence not started');
      return;
    }
    if (action === 'rejected') {
      setState((s) => ({ ...s, status: { ...s.status, connection: 'Rejected' } }));
      go(from, 'rejected', 'Connection rejected; sequence blocked');
      return;
    }
    if (action === 'changes') {
      go(from, 'changes', 'Changes requested; sequence remains inactive');
      return;
    }
    if (action === 'sequenceRejected') {
      go(from, 'sequenceRejected', 'Sequence rejected; no tasks activated');
      return;
    }
    if (action === 'skipped') {
      setState((s) => ({ ...s, tasks: s.tasks + 1, status: { ...s.status, send: 'Skipped' } }));
      go(from, 'skipped', 'Task skipped and recorded');
      return;
    }
    if (action === 'paused') {
      setState((s) => ({ ...s, status: { ...s.status, send: 'Paused' } }));
      go(from, 'paused', 'Sequence paused; future tasks held');
      return;
    }
    if (action === 'noReply') {
      setState((s) => ({ ...s, status: { ...s.status, reply: 'No reply' } }));
      go(from, 'noReply', 'No reply; next follow-up retained');
      return;
    }
    if (action === 'positive') {
      setState((s) => ({ ...s, outcome: 'Interested', status: { ...s.status, reply: 'Positive' } }));
      go(from, 'positive', 'Positive reply recorded');
      return;
    }
    if (action === 'objection') {
      setState((s) => ({ ...s, status: { ...s.status, reply: 'Objection' } }));
      go(from, 'objection', 'Objection recorded; review next steps');
      return;
    }
    if (action === 'notInterested') {
      setState((s) => ({ ...s, outcome: 'Not Interested', status: { ...s.status, reply: 'Not interested' } }));
      go(from, 'notInterested', 'Negative reply recorded; stop outreach');
      return;
    }
    if (action === 'meeting' || action === 'meetingQualified') {
      setState((s) => ({ ...s, outcome: 'Meeting Booked', status: { ...s.status, reply: 'Meeting booked' } }));
      go(from, action, 'Meeting booked; outreach closed');
      return;
    }
    if (action === 'stopped') {
      setState((s) => ({ ...s, status: { ...s.status, stopped: 'Stopped' } }));
      go(from, 'stopped', 'Sequence stopped; future tasks cancelled');
      return;
    }
    if (action === 'outcome') {
      setState((s) => ({ ...s, outcome: label }));
      go(from, 'outcome', 'Lead outcome updated: ' + label);
      return;
    }
    if (action === 'analytics') {
      go(from, 'analytics', 'Analytics updated from demo activity');
      return;
    }
    if (action === 'finish') {
      setState((s) => ({ ...s, outcome: s.outcome === '—' ? 'Journey complete' : s.outcome }));
      go(from, 'finish', 'Journey complete');
      return;
    }
    if (action === 'start') {
      go(from, 'start', 'Returned to journey start');
      return;
    }
    go(from, action, label);
  };

  const chooseGhost = (id: string) => {
    let parent: string | null = null;
    let targetAction: any = null;

    for (let i = state.path.length - 1; i >= 0; i--) {
      const p = state.path[i];
      const action = (layoutNodes[p]?.actions || []).find((a) => a[3] === id);
      if (action) {
        parent = p;
        targetAction = action;
        break;
      }
    }

    if (!parent) {
      const bp = branchParent();
      if (bp) {
        const action = (layoutNodes[bp]?.actions || []).find((a) => a[3] === id);
        if (action) {
          parent = bp;
          targetAction = action;
        }
      }
    }

    if (!parent || !targetAction) {
      selectNode(id);
      return;
    }

    const idx = state.path.lastIndexOf(parent);
    state.path = state.path.slice(0, idx + 1);
    state.selected = parent;
    act(targetAction[3], targetAction[0]);
  };

  const selectNode = (id: string) => {
    if (!layoutNodes[id]) return;
    const idx = state.path.lastIndexOf(id);
    if (idx >= 0) {
      state.path = state.path.slice(0, idx + 1);
    }
    setState((s) => ({
      ...s,
      selected: id,
      visited: new Set([...s.visited, id]),
    }));
    setTimeout(() => scrollToNode(id, true), 40);
  };

  const reset = () => {
    setState({
      selected: 'start',
      path: ['start'],
      visited: new Set(['start']),
      history: ['Demo reset. Choose one of the faint options to begin.'],
      status: {},
      leads: 0,
      seq: 0,
      tasks: 0,
      outcome: '—',
      zoom: 1.0,
      activeEdges: new Set(),
      mode: 'explore',
    });
    setTimeout(() => scrollToNode('start', true), 40);
  };

  const activeNode = layoutNodes[state.selected] || layoutNodes.start;

  return (
    <div className={`flex flex-col bg-[#f5f7fb] text-[#17243d] font-sans ${isModal ? 'fixed inset-0 z-50 overflow-hidden' : 'w-full h-full min-h-[800px]'}`}>
      {/* Header Bar */}
      <header className="bg-[#142b55] text-white px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white text-[#18366b] flex items-center justify-center font-black text-lg">
            L
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white m-0 leading-tight">
              LeadFlow Journey Canvas
            </h1>
            <p className="text-[11px] text-[#cbd9f4] m-0">Interactive decision tree · Stakeholder walkthrough</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full border border-[#425b76] bg-[#223345] text-[11px] font-bold tracking-wider text-slate-200">
            {state.mode === 'present' ? 'Guided Walkthrough' : 'Explore Mode'}
          </span>

          <Button
            size="sm"
            onClick={() =>
              setState((s) => ({
                ...s,
                mode: s.mode === 'present' ? 'explore' : 'present',
              }))
            }
            className="h-8 px-3 text-xs font-bold bg-[#ff7a59] text-white hover:bg-[#e06545] border-0 shadow-sm flex items-center gap-1.5"
          >
            {state.mode === 'present' ? (
              <>
                <Compass className="h-3.5 w-3.5 text-white" />
                <span>Explore Freely</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current text-white" />
                <span>Guided Walkthrough</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={reset}
            className="h-8 px-3 text-xs bg-[#223345] text-white border-[#425b76] hover:bg-[#2d3e50] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            <span>Reset</span>
          </Button>

          {isModal && onClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-8 w-8 p-0 bg-[#223345] text-white border-[#425b76] hover:bg-[#2d3e50]"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Canvas & Inspector Workarea */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-3 p-3 overflow-hidden">
        {/* Canvas Area */}
        <section className="rounded-xl border border-[#dfe6f0] bg-white overflow-hidden shadow-xs flex flex-col min-h-0">
          {/* Controls Bar */}
          <div className="px-4 py-2.5 border-b border-[#e5ebf4] bg-white flex items-center justify-between text-xs">
            <div>
              <strong className="text-xs text-[#17243d]">Progressive journey canvas</strong>
              <span className="text-[11px] text-[#78869d] block">
                Follow one path at a time; choose faint nodes to reveal subsequent decisions
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#f5f8fa] p-1 rounded-lg border border-[#cbd6e2]">
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, zoom: Math.max(0.4, s.zoom - 0.08) }))}
                className="h-7 w-7 flex items-center justify-center rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5 text-[#33475b]" />
              </button>
              <span className="px-2 font-mono text-xs font-bold text-[#2d3e50] min-w-[42px] text-center select-none">
                {Math.round(state.zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, zoom: Math.min(1.2, s.zoom + 0.08) }))}
                className="h-7 w-7 flex items-center justify-center rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5 text-[#33475b]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((s) => ({ ...s, zoom: 1.0 }));
                  setTimeout(() => scrollToNode(state.selected || 'start', true), 40);
                }}
                className="h-7 px-2.5 flex items-center gap-1.5 rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Fit and center active node"
                aria-label="Fit and center active node"
              >
                <Maximize2 className="h-3 w-3 text-[#33475b]" />
                <span>Fit / Reset</span>
              </button>
            </div>
          </div>

          {/* Viewport Surface */}
          <div
            ref={viewportRef}
            className="flex-1 overflow-auto relative bg-[#f9fbff]"
            style={{
              backgroundImage: 'radial-gradient(#dce4f0 0.8px, transparent 0.8px)',
              backgroundSize: '18px 18px',
            }}
          >
            <div
              className="relative"
              style={{
                width: `${canvasW}px`,
                height: `${canvasH}px`,
                transform: `scale(${state.zoom})`,
                transformOrigin: 'top left',
                marginBottom: `${canvasH * (state.zoom - 1)}px`,
                marginRight: `${canvasW * (state.zoom - 1)}px`,
              }}
            >
              {/* SVG Edges Layer */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-1 overflow-visible"
                viewBox={`0 0 ${canvasW} ${canvasH}`}
              >
                <defs>
                  <marker id="walk-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6" fill="#8fa2c0" />
                  </marker>
                  <marker id="walk-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6" fill="#3978e0" />
                  </marker>
                </defs>

                {EDGES_DATA.map(([a, b, label], i) => {
                  const A = layoutNodes[a];
                  const B = layoutNodes[b];
                  if (!A || !B) return null;

                  const inPath = state.path.some((id, idx) => idx < state.path.length - 1 && id === a && state.path[idx + 1] === b);
                  const active = state.activeEdges.has(`${a}-${b}`);
                  const visible = cv.visible.has(a) && cv.visible.has(b) && (inPath || a === state.selected || cv.bp === a);

                  if (!visible) return null;

                  const ax = A.x + 105;
                  const ay = A.y + 94;
                  const bx = B.x + 105;
                  const by = B.y;

                  let d = '';
                  if (Math.abs(bx - ax) < 24) {
                    const mid = (ay + by) / 2;
                    d = `M ${ax} ${ay} C ${ax} ${mid}, ${bx} ${mid}, ${bx} ${by}`;
                  } else {
                    const midY = ay + Math.max(22, (by - ay) * 0.5);
                    d = `M ${ax} ${ay} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by}`;
                  }

                  return (
                    <g key={`${a}-${b}-${i}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke={active ? '#3978e0' : inPath ? '#5c6c85' : '#9aabc5'}
                        strokeWidth={active ? 3.2 : 2}
                        strokeDasharray={!inPath && !active ? '5,6' : undefined}
                        opacity={!inPath && !active ? 0.38 : 1}
                        markerEnd={active ? 'url(#walk-arrow-active)' : 'url(#walk-arrow)'}
                      />
                      {label && (
                        <text
                          x={(ax + bx) / 2}
                          y={(ay + by) / 2 - 3}
                          textAnchor="middle"
                          fill="#536987"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Render Nodes */}
              {Object.entries(layoutNodes).map(([id, n]) => {
                const shown = cv.visible.has(id);
                if (!shown) return null;

                const isGhost = cv.ghosts.has(id);
                const isActive = id === state.selected;
                const isVisited = state.path.includes(id) && id !== state.selected;
                const dynamicStatus = state.status[id] || n.status;

                let borderTopColor = '#cbd8eb';
                if (n.type === 'admin') borderTopColor = '#7d5bd6';
                if (n.type === 'member') borderTopColor = '#2f7edb';
                if (n.type === 'system') borderTopColor = '#159780';
                if (n.type === 'decision') borderTopColor = '#d9a42b';
                if (n.type === 'end') borderTopColor = '#aab8ca';

                return (
                  <button
                    key={id}
                    onClick={() => (isGhost ? chooseGhost(id) : selectNode(id))}
                    className={`absolute w-[210px] min-h-[94px] rounded-xl p-2.5 text-left transition-all z-2 shadow-xs border text-xs ${
                      isGhost
                        ? 'opacity-50 border-dashed bg-[#f6f9ff] text-slate-500 hover:opacity-90'
                        : isActive
                        ? 'border-2 border-[#3978e0] bg-white ring-4 ring-[#3978e0]/20 shadow-md text-[#1b2a44]'
                        : 'border-[#cbd8eb] bg-white text-[#1b2a44] hover:-translate-y-0.5 hover:shadow-sm'
                    } ${n.type === 'decision' ? 'bg-[#fffaf0] border-[#d9a42b]' : ''}`}
                    style={{
                      left: `${n.x}px`,
                      top: `${n.y}px`,
                      borderTop: `4px solid ${borderTopColor}`,
                    }}
                  >
                    {isVisited && (
                      <span className="absolute -top-2 -right-2 bg-[#15966a] text-white border-2 border-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}

                    <span className="text-[9px] uppercase tracking-wider font-black text-[#6b84b1] block">
                      {n.owner}
                    </span>
                    <strong className="block text-xs font-bold leading-tight my-1">
                      {n.title}
                    </strong>
                    <span className="block text-[10px] text-[#718098] leading-tight mb-1.5">
                      {n.sub}
                    </span>
                    <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-[#eef3fc] text-[#4a638d] font-semibold">
                      {dynamicStatus}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Inspection & Decisions Sidebar */}
        <aside className="space-y-3 flex flex-col text-xs overflow-y-auto">
          {/* Selected Node Details Card */}
          <div className="rounded-xl border border-[#dfe6f0] bg-white p-4 shadow-xs space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-[#7b8ba5] font-black">
              Selected Node
            </span>

            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-[#e8efff] text-[#18366b] flex items-center justify-center font-bold text-base shrink-0">
                {activeNode.type === 'decision' ? <Compass className="h-4 w-4" /> : activeNode.type === 'admin' ? <Shield className="h-4 w-4" /> : activeNode.type === 'member' ? <UserCheck className="h-4 w-4" /> : activeNode.type === 'system' ? <Layers className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#17243d] leading-snug">
                  {activeNode.title}
                </h3>
                <p className="text-[11px] text-[#697992] leading-relaxed mt-1">
                  {activeNode.desc}
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#edf3ff] text-[#315eae] font-bold text-[10px]">
                  Owner: {activeNode.owner}
                </span>
              </div>
            </div>

            <div className="h-px bg-[#e8edf5] my-2" />

            {/* Decisions / Actions List */}
            <span className="font-black text-xs text-[#17243d] block">
              Available decisions / actions
            </span>

            <div className="space-y-1.5">
              {activeNode.actions.map(([title, desc, kind, action], i) => (
                <button
                  key={i}
                  onClick={() => act(action, title)}
                  className="w-full text-left p-2.5 rounded-lg border border-[#e0e7f1] hover:border-[#6288d5] hover:bg-[#f6f9ff] transition-colors flex items-start gap-2"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${
                      kind === 'good'
                        ? 'bg-[#169a6a]'
                        : kind === 'bad'
                        ? 'bg-[#d34c58]'
                        : kind === 'warn'
                        ? 'bg-[#d49a19]'
                        : 'bg-[#3978df]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="block text-xs text-[#17243d] font-bold">
                      {title}
                    </strong>
                    <span className="text-[10px] text-[#78869b] leading-tight block mt-0.5">
                      {desc}
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-[#7890b9] shrink-0 mt-1" />
                </button>
              ))}
            </div>

            <p className="text-[10px] text-[#8290a4] italic mt-2">
              Choose a branch to reveal its outcome and highlight the route on the tree.
            </p>
          </div>

          {/* Current State & Demo Counters */}
          <div className="rounded-xl border border-[#dfe6f0] bg-white p-4 shadow-xs space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-[#7b8ba5] font-black">
              Current State History
            </span>

            <div className="space-y-1.5">
              {state.history.map((msg, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-[#6c7b93]">
                  <span className="h-4 w-4 rounded-full bg-[#e7f7ef] text-[#13845b] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                    {i === 0 ? <Check className="h-2.5 w-2.5" /> : '·'}
                  </span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-[#e8edf5] my-2" />

            <span className="text-[10px] uppercase tracking-wider text-[#7b8ba5] font-black">
              Journey Metrics
            </span>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#6c7b93]">Leads captured:</span>
                <strong className="text-[#17243d]">{state.leads}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c7b93]">Sequences activated:</span>
                <strong className="text-[#17243d]">{state.seq}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c7b93]">Tasks completed:</span>
                <strong className="text-[#17243d]">{state.tasks}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6c7b93]">Lead outcome:</span>
                <strong className="text-[#15966a]">{state.outcome}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
