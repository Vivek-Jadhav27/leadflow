import {
  Lead,
  Sequence,
  Task,
  ActivityEvent,
  TeamMember,
  WorkspaceSettings,
  EnrichedData,
} from '@/types/crm';
import { AuthUser } from '@/types/user';

const STORAGE_KEY = 'leadflow_hubspot_crm_db_v3';

export const ADMIN_USER: AuthUser = {
  uid: 'user_admin_marcus',
  email: 'admin@leadflow.io',
  displayName: 'Marcus Sterling',
  photoURL: null,
  role: 'admin',
  title: 'Workspace Owner & Admin',
};

export const SDR_USER: AuthUser = {
  uid: 'user_sdr_alex',
  email: 'sdr@leadflow.io',
  displayName: 'Alex Rivera',
  photoURL: null,
  role: 'sdr',
  title: 'Outbound SDR & Account Specialist',
};

export const SEEDED_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'user_admin_marcus',
    name: 'Marcus Sterling',
    email: 'admin@leadflow.io',
    role: 'admin',
    roleTitle: 'Workspace Owner & Admin',
    avatarBg: 'bg-[#ff7a59]',
    initials: 'MS',
    assignedLeadsCount: 4,
    activeSequencesCount: 3,
    completedTasksWeek: 22,
    status: 'active',
  },
  {
    id: 'user_sdr_alex',
    name: 'Alex Rivera',
    email: 'sdr@leadflow.io',
    role: 'sdr',
    roleTitle: 'Outbound SDR',
    avatarBg: 'bg-[#0091ae]',
    initials: 'AR',
    assignedLeadsCount: 5,
    activeSequencesCount: 2,
    completedTasksWeek: 31,
    status: 'active',
  },
  {
    id: 'user_sarah_connor',
    name: 'Sarah Connor',
    email: 'sarah@leadflow.io',
    role: 'sdr',
    roleTitle: 'Lead SDR & Operations',
    avatarBg: 'bg-[#516f90]',
    initials: 'SC',
    assignedLeadsCount: 3,
    activeSequencesCount: 2,
    completedTasksWeek: 18,
    status: 'active',
  },
  {
    id: 'user_maya_lin',
    name: 'Maya Lin',
    email: 'maya@leadflow.io',
    role: 'sdr',
    roleTitle: 'Outbound Specialist',
    avatarBg: 'bg-[#2e3f50]',
    initials: 'ML',
    assignedLeadsCount: 3,
    activeSequencesCount: 1,
    completedTasksWeek: 14,
    status: 'away',
  },
];

export const SEEDED_SEQUENCES: Sequence[] = [
  {
    id: 'seq_linkedin_founders',
    name: 'SaaS Tech Founders & VPs (LinkedIn)',
    channel: 'linkedin',
    description: 'High-touch multichannel LinkedIn outreach for B2B engineering and product leaders',
    status: 'active',
    approvedBy: 'Marcus Sterling (Admin)',
    enrolledLeadsCount: 6,
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-25T14:30:00Z',
    steps: [
      {
        id: 'step_li_1',
        stepNumber: 1,
        actionType: 'connection_request',
        title: 'Send LinkedIn Connection Request',
        delayDays: 0,
        messageTemplate: 'Hi {{firstName}}, noticed your team\'s recent growth at {{company}}. Would love to connect and follow your journey.',
        enabled: true,
      },
      {
        id: 'step_li_2',
        stepNumber: 2,
        actionType: 'wait_for_acceptance',
        title: 'Wait for Connection Acceptance',
        delayDays: 2,
        enabled: true,
      },
      {
        id: 'step_li_3',
        stepNumber: 3,
        actionType: 'send_message',
        title: 'Send LinkedIn Welcome Message',
        delayDays: 1,
        messageTemplate: 'Thanks for connecting, {{firstName}}! Quick question—how is {{company}} managing multichannel SDR follow-ups this quarter?',
        enabled: true,
      },
      {
        id: 'step_li_4',
        stepNumber: 4,
        actionType: 'followup',
        title: 'Follow-up LinkedIn Message',
        delayDays: 3,
        messageTemplate: 'Hey {{firstName}}, just following up on my previous note. We helped similar B2B SaaS teams cut drop-off by 35%. Worth a 10-min chat next Tuesday?',
        enabled: true,
      },
      {
        id: 'step_li_5',
        stepNumber: 5,
        actionType: 'complete_details',
        title: 'Complete Details',
        delayDays: 2,
        enabled: true,
      },
    ],
  },
  {
    id: 'seq_linkedin_enterprise',
    name: 'Enterprise CISO & Security Leaders (LinkedIn)',
    channel: 'linkedin',
    description: 'Targeted custom sequence for enterprise revenue and security leaders',
    status: 'active',
    approvedBy: 'Marcus Sterling (Admin)',
    enrolledLeadsCount: 4,
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-27T11:00:00Z',
    steps: [
      {
        id: 'step_ent_1',
        stepNumber: 1,
        actionType: 'connection_request',
        title: 'Connection Invitation with Industry Note',
        delayDays: 0,
        messageTemplate: 'Hi {{firstName}}, impressed by your security architecture work at {{company}}. Would appreciate connecting here.',
        enabled: true,
      },
      {
        id: 'step_ent_2',
        stepNumber: 2,
        actionType: 'wait_for_acceptance',
        title: 'Wait for Connection Acceptance',
        delayDays: 2,
        enabled: true,
      },
      {
        id: 'step_ent_3',
        stepNumber: 3,
        actionType: 'send_message',
        title: 'Personalized Value Proposition Note',
        delayDays: 1,
        messageTemplate: 'Hi {{firstName}}, thanks for connecting. Reaching out because enterprise teams like {{company}} are streamlining pipeline review.',
        enabled: true,
      },
      {
        id: 'step_ent_4',
        stepNumber: 4,
        actionType: 'followup',
        title: 'Case Study & Benchmark Follow-up',
        delayDays: 3,
        messageTemplate: 'Hey {{firstName}}, wanted to share how CloudScale boosted their SDR response rates by 42%. Would 5 minutes be useful?',
        enabled: true,
      },
      {
        id: 'step_ent_5',
        stepNumber: 5,
        actionType: 'complete_details',
        title: 'Complete Details',
        delayDays: 2,
        enabled: true,
      },
    ],
  },
  {
    id: 'seq_linkedin_inbound',
    name: 'High-Intent Inbound Whitepaper Download',
    channel: 'linkedin',
    description: 'Custom SDR sequence awaiting manager approval before launch',
    status: 'pending_approval',
    enrolledLeadsCount: 0,
    createdAt: '2026-10-28T16:00:00Z',
    updatedAt: '2026-10-29T10:00:00Z',
    steps: [
      {
        id: 'step_in_1',
        stepNumber: 1,
        actionType: 'connection_request',
        title: 'Connect & Reference Download',
        delayDays: 0,
        messageTemplate: 'Hi {{firstName}}, saw you downloaded our 2026 B2B Outbound Cadence Guide. Let\'s connect!',
        enabled: true,
      },
      {
        id: 'step_in_2',
        stepNumber: 2,
        actionType: 'wait_for_acceptance',
        title: 'Wait for Connection Acceptance',
        delayDays: 1,
        enabled: true,
      },
      {
        id: 'step_in_3',
        stepNumber: 3,
        actionType: 'send_message',
        title: 'Offer Implementation Walkthrough',
        delayDays: 1,
        messageTemplate: 'Thanks for connecting! What was your main priority for {{company}} in the report?',
        enabled: true,
      },
    ],
  },
];

export const SEEDED_LEADS: Lead[] = [
  {
    id: 'lead_1',
    firstName: 'Elena',
    lastName: 'Rostova',
    company: 'CloudScale AI',
    jobTitle: 'VP of Engineering',
    email: 'elena.rostova@cloudscale.ai',
    phone: '+1 (415) 890-2341',
    linkedinUrl: 'https://linkedin.com/in/elena-rostova-tech',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 3,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'message_sent',
    disposition: 'active',
    outcome: 'Interested',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    assignedToEmail: 'sdr@leadflow.io',
    nextFollowUpDate: '2026-10-31',
    nextActionTitle: 'Follow-up LinkedIn Message',
    notes: 'Elena accepted connection warmly. Scaling SDR team from 3 to 10 in Q4.',
    createdAt: '2026-10-20T11:20:00Z',
    updatedAt: '2026-10-27T15:00:00Z',
  },
  {
    id: 'lead_2',
    firstName: 'Marcus',
    lastName: 'Sterling',
    company: 'FinEdge Capital',
    jobTitle: 'Head of Growth',
    email: 'm.sterling@finedge.com',
    phone: '+1 (212) 555-0199',
    linkedinUrl: 'https://linkedin.com/in/marcussterling-growth',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 2,
    totalSteps: 5,
    connectionStatus: 'request_sent',
    outreachStatus: 'in_sequence',
    disposition: 'active',
    assignedToId: 'user_admin_marcus',
    assignedToName: 'Marcus Sterling',
    assignedToEmail: 'admin@leadflow.io',
    nextFollowUpDate: '2026-10-30',
    nextActionTitle: 'Check connection acceptance status',
    notes: 'Met briefly at SaaStr. Waiting for LinkedIn connection acceptance.',
    createdAt: '2026-10-26T09:15:00Z',
    updatedAt: '2026-10-26T09:30:00Z',
  },
  {
    id: 'lead_3',
    firstName: 'David',
    lastName: 'Miller',
    company: 'Omnicorp Systems',
    jobTitle: 'Director of Sales Operations',
    email: 'david.miller@omnicorp-sys.com',
    phone: '+1 (312) 440-8812',
    linkedinUrl: 'https://linkedin.com/in/david-miller-salesops',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_enterprise',
    sequenceName: 'Enterprise CISO & Security Leaders (LinkedIn)',
    currentStepNumber: 2,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'followup_due',
    disposition: 'active',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    assignedToEmail: 'sdr@leadflow.io',
    nextFollowUpDate: '2026-10-29', // Due today
    nextActionTitle: 'Send LinkedIn Welcome Message',
    notes: 'Connection accepted yesterday! Ready for initial direct message.',
    createdAt: '2026-10-25T08:00:00Z',
    updatedAt: '2026-10-28T10:00:00Z',
  },
  {
    id: 'lead_4',
    firstName: 'Sophia',
    lastName: 'Chen',
    company: 'Nexus Robotics',
    jobTitle: 'Chief Technology Officer',
    email: 'sophia.chen@nexusrobotics.io',
    phone: '+1 (650) 782-9901',
    linkedinUrl: 'https://linkedin.com/in/sophia-chen-robotics',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 3,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'replied',
    disposition: 'meeting_booked',
    outcome: 'Meeting Booked',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    assignedToEmail: 'sdr@leadflow.io',
    nextActionTitle: 'Discovery Call on Thursday 2pm',
    notes: 'Sophia replied on LinkedIn: "This looks relevant. Let\'s do a 15-min call next Thursday." Meeting booked in calendar.',
    createdAt: '2026-10-21T14:10:00Z',
    updatedAt: '2026-10-28T16:45:00Z',
  },
  {
    id: 'lead_5',
    firstName: 'James',
    lastName: 'Wilson',
    company: 'Logistics Pro',
    jobTitle: 'VP Operations',
    email: 'j.wilson@logisticspro.net',
    phone: '+1 (773) 290-8821',
    linkedinUrl: 'https://linkedin.com/in/james-wilson-supplychain',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 4,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'followup_due',
    disposition: 'active',
    assignedToId: 'user_maya_lin',
    assignedToName: 'Maya Lin',
    assignedToEmail: 'maya@leadflow.io',
    nextFollowUpDate: '2026-10-29', // Due today!
    nextActionTitle: 'Send Follow-up LinkedIn Message #2',
    notes: 'Initial message was read with objection: "We are locked into another tool until Q1". Needs tailored response.',
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-25T11:15:00Z',
  },
  {
    id: 'lead_6',
    firstName: 'Amara',
    lastName: 'Okafor',
    company: 'PayStream Global',
    jobTitle: 'Chief Product Officer',
    email: 'amara.okafor@paystream.co',
    phone: '+44 20 7946 0912',
    linkedinUrl: 'https://linkedin.com/in/amara-okafor-fintech',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 5,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'completed',
    disposition: 'enriched',
    outcome: 'Converted',
    assignedToId: 'user_admin_marcus',
    assignedToName: 'Marcus Sterling',
    assignedToEmail: 'admin@leadflow.io',
    notes: 'Sequence finished. Lead marked for Complete Details -> Enriched with verified company intelligence.',
    enrichedData: {
      phoneVerified: true,
      phone: '+44 20 7946 0912',
      companySize: '250-500 employees',
      annualRevenue: '$45M ARR',
      techStack: ['HubSpot', 'Salesforce', 'React', 'AWS'],
      headquarters: 'London, UK',
      enrichedAt: '2026-10-28T14:00:00Z',
      enrichmentNotes: 'Verified corporate intelligence. Converted to Enterprise Opportunity.',
    },
    createdAt: '2026-10-14T08:30:00Z',
    updatedAt: '2026-10-28T14:00:00Z',
  },
  {
    id: 'lead_7',
    firstName: 'Liam',
    lastName: 'Patel',
    company: 'Verve Health AI',
    jobTitle: 'Founder & CEO',
    email: 'liam@vervehealth.ai',
    linkedinUrl: 'https://linkedin.com/in/liam-patel-healthtech',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 2,
    totalSteps: 5,
    connectionStatus: 'declined',
    outreachStatus: 'stopped',
    disposition: 'active',
    outcome: 'Lost',
    assignedToId: 'user_sarah_connor',
    assignedToName: 'Sarah Connor',
    assignedToEmail: 'sarah@leadflow.io',
    notes: 'LinkedIn connection request was declined/withdrawn. Sequence halted at Decision 2 gate.',
    createdAt: '2026-10-12T16:00:00Z',
    updatedAt: '2026-10-19T10:00:00Z',
  },
  {
    id: 'lead_8',
    firstName: 'Chloe',
    lastName: 'Dupont',
    company: 'GlobalHR Solutions',
    jobTitle: 'Head of People Operations',
    email: 'c.dupont@globalhr.eu',
    phone: '+33 1 40 20 50 00',
    linkedinUrl: 'https://linkedin.com/in/chloedupont-hr',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 5,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'completed',
    disposition: 'archived',
    outcome: 'Archived',
    assignedToId: 'user_admin_marcus',
    assignedToName: 'Marcus Sterling',
    assignedToEmail: 'admin@leadflow.io',
    notes: 'Outreach completed without response. Transitioned from Complete Details stage to Archived.',
    createdAt: '2026-10-05T09:00:00Z',
    updatedAt: '2026-10-24T18:00:00Z',
  },
  {
    id: 'lead_9',
    firstName: 'Alexander',
    lastName: 'Wright',
    company: 'PulseMedia Agency',
    jobTitle: 'Head of Outbound Marketing',
    email: 'alexander@pulsemedia.io',
    phone: '+1 (512) 309-4411',
    linkedinUrl: 'https://linkedin.com/in/alexander-wright-marketing',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 3,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'followup_due',
    disposition: 'active',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    assignedToEmail: 'sdr@leadflow.io',
    nextFollowUpDate: '2026-10-27', // Overdue
    nextActionTitle: 'Send Follow-up LinkedIn Message #1',
    notes: 'Task overdue! Follow-up was due 2 days ago.',
    createdAt: '2026-10-16T11:00:00Z',
    updatedAt: '2026-10-27T08:00:00Z',
  },
  {
    id: 'lead_10',
    firstName: 'Rachel',
    lastName: 'Green',
    company: 'Apex Cloud Systems',
    jobTitle: 'Enterprise Solutions Director',
    email: 'rachel.green@apexcloud.co',
    phone: '+1 (206) 880-9912',
    linkedinUrl: 'https://linkedin.com/in/rachelgreen-cloud',
    channel: 'linkedin',
    currentStepNumber: 0,
    totalSteps: 0,
    connectionStatus: 'not_started',
    outreachStatus: 'unassigned',
    disposition: 'active',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    assignedToEmail: 'sdr@leadflow.io',
    notes: 'Captured via Chrome Extension. Duplicate check passed: No match found. Ready for sequence assignment.',
    createdAt: '2026-10-29T14:00:00Z',
    updatedAt: '2026-10-29T14:00:00Z',
  },
  {
    id: 'lead_11',
    firstName: 'Vikram',
    lastName: 'Malhotra',
    company: 'CyberShield Security',
    jobTitle: 'VP Strategy & Alliances',
    email: 'vikram.m@cybershield.security',
    phone: '+1 (408) 555-7733',
    linkedinUrl: 'https://linkedin.com/in/vikram-malhotra-cyber',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 5,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'completed',
    disposition: 'complete_details',
    assignedToId: 'user_maya_lin',
    assignedToName: 'Maya Lin',
    assignedToEmail: 'maya@leadflow.io',
    notes: 'Sequence finished. Currently in Complete Details stage awaiting disposition decision (Enrich vs Archive).',
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-28T17:00:00Z',
  },
  {
    id: 'lead_12',
    firstName: 'Daniel',
    lastName: 'Vance',
    company: 'ByteCore Technologies',
    jobTitle: 'Head of Infrastructure',
    email: 'd.vance@bytecore.dev',
    linkedinUrl: 'https://linkedin.com/in/daniel-vance-infra',
    channel: 'linkedin',
    sequenceId: 'seq_linkedin_founders',
    sequenceName: 'SaaS Tech Founders & VPs (LinkedIn)',
    currentStepNumber: 4,
    totalSteps: 5,
    connectionStatus: 'connected',
    outreachStatus: 'stopped',
    disposition: 'not_interested',
    outcome: 'Not Interested',
    assignedToId: 'user_sarah_connor',
    assignedToName: 'Sarah Connor',
    assignedToEmail: 'sarah@leadflow.io',
    notes: 'Replied: "Not interested right now, please remove from cadence." Future tasks cancelled after confirmation.',
    createdAt: '2026-10-19T09:30:00Z',
    updatedAt: '2026-10-24T10:05:00Z',
  },
];

export const SEEDED_TASKS: Task[] = [
  {
    id: 'task_1',
    title: 'Send LinkedIn Welcome Message to David Miller',
    leadId: 'lead_3',
    leadName: 'David Miller',
    leadCompany: 'Omnicorp Systems',
    leadLinkedin: 'https://linkedin.com/in/david-miller-salesops',
    sequenceId: 'seq_linkedin_enterprise',
    stepNumber: 2,
    type: 'linkedin_message',
    dueDate: '2026-10-29',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    priority: 'high',
    status: 'pending',
    messageTemplate: 'Hi David, thanks for connecting. Reaching out because enterprise teams like Omnicorp are streamlining pipeline review.',
  },
  {
    id: 'task_2',
    title: 'Send Follow-up LinkedIn Message #2 to James Wilson',
    leadId: 'lead_5',
    leadName: 'James Wilson',
    leadCompany: 'Logistics Pro',
    leadLinkedin: 'https://linkedin.com/in/james-wilson-supplychain',
    sequenceId: 'seq_linkedin_founders',
    stepNumber: 4,
    type: 'linkedin_message',
    dueDate: '2026-10-29',
    assignedToId: 'user_maya_lin',
    assignedToName: 'Maya Lin',
    priority: 'high',
    status: 'pending',
    messageTemplate: 'Hey James, just following up on my previous note. We helped similar B2B SaaS teams cut drop-off by 35%. Worth a 10-min chat next Tuesday?',
  },
  {
    id: 'task_3',
    title: 'OVERDUE: Send Follow-up LinkedIn Message #1 to Alexander Wright',
    leadId: 'lead_9',
    leadName: 'Alexander Wright',
    leadCompany: 'PulseMedia Agency',
    leadLinkedin: 'https://linkedin.com/in/alexander-wright-marketing',
    sequenceId: 'seq_linkedin_founders',
    stepNumber: 3,
    type: 'followup',
    dueDate: '2026-10-27',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    priority: 'high',
    status: 'overdue',
    messageTemplate: 'Hi Alexander, wanted to follow up on my note regarding pipeline conversion.',
  },
  {
    id: 'task_4',
    title: 'Confirm Calendar Meeting with Sophia Chen (Reply Received)',
    leadId: 'lead_4',
    leadName: 'Sophia Chen',
    leadCompany: 'Nexus Robotics',
    leadLinkedin: 'https://linkedin.com/in/sophia-chen-robotics',
    sequenceId: 'seq_linkedin_founders',
    type: 'manual_review',
    dueDate: '2026-10-30',
    assignedToId: 'user_sdr_alex',
    assignedToName: 'Alex Rivera',
    priority: 'high',
    status: 'pending',
    notes: 'Prepare slide deck for 15-minute intro call.',
  },
  {
    id: 'task_5',
    title: 'Review Complete Details & Enrich Vikram Malhotra',
    leadId: 'lead_11',
    leadName: 'Vikram Malhotra',
    leadCompany: 'CyberShield Security',
    leadLinkedin: 'https://linkedin.com/in/vikram-malhotra-cyber',
    sequenceId: 'seq_linkedin_founders',
    stepNumber: 5,
    type: 'enrich',
    dueDate: '2026-10-30',
    assignedToId: 'user_maya_lin',
    assignedToName: 'Maya Lin',
    priority: 'medium',
    status: 'pending',
  },
  {
    id: 'task_6',
    title: 'Check connection acceptance status for Marcus Sterling',
    leadId: 'lead_2',
    leadName: 'Marcus Sterling',
    leadCompany: 'FinEdge Capital',
    leadLinkedin: 'https://linkedin.com/in/marcussterling-growth',
    sequenceId: 'seq_linkedin_founders',
    stepNumber: 2,
    type: 'linkedin_connect',
    dueDate: '2026-10-30',
    assignedToId: 'user_admin_marcus',
    assignedToName: 'Marcus Sterling',
    priority: 'medium',
    status: 'pending',
  },
];

export const SEEDED_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act_1',
    leadId: 'lead_4',
    type: 'meeting_booked',
    title: 'Meeting Booked via LinkedIn',
    description: 'Sophia Chen scheduled 15-min discovery call. Automated follow-ups halted.',
    actorName: 'Sophia Chen',
    timestamp: '2026-10-28T16:45:00Z',
  },
  {
    id: 'act_2',
    leadId: 'lead_6',
    type: 'lead_enriched',
    title: 'Lead Enriched with Intelligence',
    description: 'Added verified phone, tech stack (Salesforce, AWS), and $45M ARR profile.',
    actorName: 'Marcus Sterling',
    timestamp: '2026-10-28T14:00:00Z',
  },
  {
    id: 'act_3',
    leadId: 'lead_1',
    type: 'message_sent',
    title: 'LinkedIn Welcome Message Sent',
    description: 'Sent personal introduction note after Elena accepted connection.',
    actorName: 'Alex Rivera',
    timestamp: '2026-10-27T15:00:00Z',
  },
  {
    id: 'act_4',
    leadId: 'lead_1',
    type: 'connection_accepted',
    title: 'LinkedIn Connection Accepted',
    description: 'Elena Rostova accepted connection invitation. Proceeded to message step.',
    actorName: 'Elena Rostova',
    timestamp: '2026-10-27T10:15:00Z',
  },
  {
    id: 'act_5',
    leadId: 'lead_10',
    type: 'duplicate_checked',
    title: 'Duplicate Check Passed',
    description: 'No match found in workspace. Created new lead record for Rachel Green.',
    actorName: 'Alex Rivera',
    timestamp: '2026-10-29T14:00:00Z',
  },
];

export const SEEDED_SETTINGS: WorkspaceSettings = {
  name: 'LeadFlow B2B Outbound',
  domain: 'leadflow.io',
  timezone: 'America/New_York (UTC-5)',
  currency: 'USD ($)',
  defaultAssignmentRule: 'round_robin',
  defaultFollowupDays: 3,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  skipWeekends: true,
  stopSequenceOnReply: true,
  dailyLinkedInConnectLimit: 25,
  dailyLinkedInMessageLimit: 50,
};

interface PrototypeDB {
  leads: Lead[];
  sequences: Sequence[];
  tasks: Task[];
  activities: ActivityEvent[];
  team: TeamMember[];
  settings: WorkspaceSettings;
}

class PrototypeStore {
  private db: PrototypeDB;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.db = this.loadFromStorage();
  }

  private loadFromStorage(): PrototypeDB {
    if (typeof window === 'undefined') {
      return {
        leads: SEEDED_LEADS,
        sequences: SEEDED_SEQUENCES,
        tasks: SEEDED_TASKS,
        activities: SEEDED_ACTIVITIES,
        team: SEEDED_TEAM_MEMBERS,
        settings: SEEDED_SETTINGS,
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.leads) && parsed.leads.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse localStorage prototype DB', e);
    }

    const initial: PrototypeDB = {
      leads: SEEDED_LEADS,
      sequences: SEEDED_SEQUENCES,
      tasks: SEEDED_TASKS,
      activities: SEEDED_ACTIVITIES,
      team: SEEDED_TEAM_MEMBERS,
      settings: SEEDED_SETTINGS,
    };
    this.saveToStorage(initial);
    return initial;
  }

  private saveToStorage(data: PrototypeDB) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to write to localStorage', e);
      }
    }
  }

  private persistAndNotify() {
    this.saveToStorage(this.db);
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in listener', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Leads Operations ---
  public getLeads(): Lead[] {
    return [...this.db.leads];
  }

  public getLeadById(id: string): Lead | undefined {
    return this.db.leads.find((l) => l.id === id);
  }

  public createLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...input,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.db.leads.unshift(newLead);

    // Record activity
    this.addActivityEvent({
      leadId: newLead.id,
      type: 'lead_created',
      title: 'Lead Captured',
      description: `${newLead.firstName} ${newLead.lastName} from ${newLead.company} captured and verified.`,
      actorName: newLead.assignedToName || 'Alex Rivera',
      timestamp: now,
    });

    // If sequence assigned, record and create first task
    if (newLead.sequenceId) {
      const seq = this.getSequenceById(newLead.sequenceId);
      if (seq && seq.steps.length > 0) {
        const firstStep = seq.steps[0];
        this.createTask({
          title: `Step 1: ${firstStep.title} for ${newLead.firstName} ${newLead.lastName}`,
          leadId: newLead.id,
          leadName: `${newLead.firstName} ${newLead.lastName}`,
          leadCompany: newLead.company,
          leadLinkedin: newLead.linkedinUrl,
          sequenceId: seq.id,
          stepNumber: 1,
          type: 'linkedin_connect',
          dueDate: new Date().toISOString().split('T')[0],
          assignedToId: newLead.assignedToId,
          assignedToName: newLead.assignedToName,
          priority: 'high',
          status: 'pending',
          messageTemplate: firstStep.messageTemplate,
        });
      }
    }

    this.persistAndNotify();
    return newLead;
  }

  public updateLead(id: string, updates: Partial<Lead>): Lead | undefined {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) return undefined;

    const existing = this.db.leads[index];
    const updated: Lead = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.db.leads[index] = updated;
    this.persistAndNotify();
    return updated;
  }

  public deleteLead(id: string): boolean {
    const lead = this.getLeadById(id);
    if (!lead) return false;

    this.db.leads = this.db.leads.filter((l) => l.id !== id);
    this.db.tasks = this.db.tasks.filter((t) => t.leadId !== id);
    this.db.activities = this.db.activities.filter((a) => a.leadId !== id);

    this.persistAndNotify();
    return true;
  }

  public archiveLead(id: string, isArchived: boolean = true): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const disposition = isArchived ? 'archived' : 'active';
    const updated = this.updateLead(id, { disposition, outcome: isArchived ? 'Archived' : 'Active' });

    this.addActivityEvent({
      leadId: id,
      type: isArchived ? 'lead_archived' : 'lead_assigned',
      title: isArchived ? 'Lead Archived' : 'Lead Restored',
      description: isArchived
        ? 'Lead moved to archive. Historical activities preserved.'
        : 'Lead restored from archive to active CRM pipeline.',
      actorName: 'Alex Rivera',
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  public enrichLead(id: string, enrichedData: EnrichedData): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const updated = this.updateLead(id, {
      disposition: 'enriched',
      outcome: 'Enriched',
      enrichedData: {
        ...lead.enrichedData,
        ...enrichedData,
        enrichedAt: new Date().toISOString(),
      },
    });

    this.addActivityEvent({
      leadId: id,
      type: 'lead_enriched',
      title: 'Lead Enriched with Intelligence',
      description: `Verified profile: ${enrichedData.companySize || 'Updated'}, Tech stack: ${enrichedData.techStack?.join(', ') || 'Updated'}.`,
      actorName: 'Alex Rivera',
      timestamp: new Date().toISOString(),
    });

    // Mark any enrich tasks complete
    this.db.tasks
      .filter((t) => t.leadId === id && t.type === 'enrich')
      .forEach((t) => {
        t.status = 'completed';
        t.completedAt = new Date().toISOString();
      });

    this.persistAndNotify();
    return updated;
  }

  public markReply(id: string, replyMessage?: string, outcome: string = 'Interested'): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const now = new Date().toISOString();
    const isMeeting = outcome.toLowerCase().includes('meeting');

    const updated = this.updateLead(id, {
      outreachStatus: 'replied',
      disposition: isMeeting ? 'meeting_booked' : 'interested',
      outcome: isMeeting ? 'Meeting Booked' : outcome,
      nextFollowUpDate: undefined,
      nextActionTitle: isMeeting ? 'Prepare for Meeting' : 'Respond to prospect reply',
    });

    // Cancel pending follow-up tasks for this sequence
    this.db.tasks
      .filter((t) => t.leadId === id && t.status === 'pending' && (t.type === 'followup' || t.type === 'linkedin_message'))
      .forEach((t) => {
        t.status = 'cancelled';
        t.notes = 'Cancelled due to incoming prospect reply.';
      });

    // Create meeting / reply review task
    this.createTask({
      title: isMeeting
        ? `Meeting Booked with ${lead.firstName} ${lead.lastName} (Prep slides)`
        : `Respond to Reply from ${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadCompany: lead.company,
      leadLinkedin: lead.linkedinUrl,
      type: 'manual_review',
      dueDate: now.split('T')[0],
      assignedToId: lead.assignedToId,
      assignedToName: lead.assignedToName,
      priority: 'high',
      status: 'pending',
    });

    // Record activity
    this.addActivityEvent({
      leadId: id,
      type: isMeeting ? 'meeting_booked' : 'reply_received',
      title: isMeeting ? 'Meeting Booked on Calendar' : 'Prospect Reply Received',
      description: replyMessage || `Reply recorded for ${lead.firstName} ${lead.lastName}. Future sequence follow-ups halted.`,
      actorName: `${lead.firstName} ${lead.lastName}`,
      timestamp: now,
    });

    this.persistAndNotify();
    return updated;
  }

  public advanceLeadStep(id: string): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead || !lead.sequenceId) return undefined;

    const seq = this.getSequenceById(lead.sequenceId);
    if (!seq) return undefined;

    const nextStepNum = lead.currentStepNumber + 1;
    const now = new Date().toISOString();

    if (nextStepNum > seq.steps.length) {
      // Completed sequence -> moves to complete_details stage
      const updated = this.updateLead(id, {
        currentStepNumber: seq.steps.length,
        outreachStatus: 'completed',
        disposition: 'complete_details',
        nextFollowUpDate: undefined,
        nextActionTitle: 'Review Lead & Complete Details',
      });

      this.addActivityEvent({
        leadId: id,
        type: 'sequence_completed',
        title: 'Sequence Reached Complete Details',
        description: 'All configured LinkedIn outreach steps completed. Ready for Enrich or Archive decision.',
        actorName: 'Alex Rivera',
        timestamp: now,
      });

      this.persistAndNotify();
      return updated;
    }

    const step = seq.steps.find((s) => s.stepNumber === nextStepNum);
    const dueDate = new Date(Date.now() + (step?.delayDays || 1) * 86400000).toISOString().split('T')[0];

    let newConnStatus = lead.connectionStatus;
    let newOutreachStatus = lead.outreachStatus;

    if (nextStepNum === 2) {
      newConnStatus = 'connected';
    } else if (nextStepNum === 3) {
      newOutreachStatus = 'message_sent';
    } else if (nextStepNum >= 4) {
      newOutreachStatus = 'followup_due';
    }

    const updated = this.updateLead(id, {
      currentStepNumber: nextStepNum,
      connectionStatus: newConnStatus,
      outreachStatus: newOutreachStatus,
      nextFollowUpDate: dueDate,
      nextActionTitle: step?.title,
    });

    this.addActivityEvent({
      leadId: id,
      type: 'followup_scheduled',
      title: `Advanced to Step ${nextStepNum}: ${step?.title}`,
      description: `Action completed. Next follow-up scheduled for ${dueDate}.`,
      actorName: 'Alex Rivera',
      timestamp: now,
    });

    this.persistAndNotify();
    return updated;
  }

  public bulkAssign(ids: string[], memberId: string): void {
    const member = this.db.team.find((m) => m.id === memberId);
    if (!member) return;

    ids.forEach((id) => {
      this.updateLead(id, {
        assignedToId: member.id,
        assignedToName: member.name,
        assignedToEmail: member.email,
      });
      this.addActivityEvent({
        leadId: id,
        type: 'lead_assigned',
        title: 'Lead Reassigned',
        description: `Lead assigned to ${member.name}.`,
        actorName: 'Alex Rivera',
        timestamp: new Date().toISOString(),
      });
    });
  }

  public bulkArchive(ids: string[]): void {
    ids.forEach((id) => this.archiveLead(id, true));
  }

  public bulkDelete(ids: string[]): void {
    ids.forEach((id) => this.deleteLead(id));
  }

  // --- Sequences Operations ---
  public getSequences(): Sequence[] {
    return [...this.db.sequences];
  }

  public getSequenceById(id: string): Sequence | undefined {
    return this.db.sequences.find((s) => s.id === id);
  }

  public saveSequence(sequence: Sequence): Sequence {
    const index = this.db.sequences.findIndex((s) => s.id === sequence.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      const updated: Sequence = {
        ...sequence,
        updatedAt: now,
      };
      this.db.sequences[index] = updated;
      this.persistAndNotify();
      return updated;
    } else {
      const created: Sequence = {
        ...sequence,
        id: sequence.id || `seq_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      this.db.sequences.unshift(created);
      this.persistAndNotify();
      return created;
    }
  }

  public approveSequence(id: string, approverName: string = 'Marcus Sterling (Admin)'): Sequence | undefined {
    const seq = this.getSequenceById(id);
    if (!seq) return undefined;

    seq.status = 'active';
    seq.approvedBy = approverName;
    seq.updatedAt = new Date().toISOString();

    this.persistAndNotify();
    return seq;
  }

  public duplicateSequence(id: string): Sequence | undefined {
    const original = this.getSequenceById(id);
    if (!original) return undefined;

    const copy: Sequence = {
      ...original,
      id: `seq_${Date.now()}_copy`,
      name: `${original.name} (Copy)`,
      enrolledLeadsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: original.steps.map((st, i) => ({
        ...st,
        id: `step_${Date.now()}_${i + 1}`,
      })),
    };

    this.db.sequences.unshift(copy);
    this.persistAndNotify();
    return copy;
  }

  public toggleSequenceStatus(id: string): Sequence | undefined {
    const seq = this.getSequenceById(id);
    if (!seq) return undefined;

    const newStatus = seq.status === 'active' ? 'paused' : 'active';
    seq.status = newStatus;
    seq.updatedAt = new Date().toISOString();

    this.persistAndNotify();
    return seq;
  }

  public deleteSequence(id: string): boolean {
    const exists = this.db.sequences.some((s) => s.id === id);
    if (!exists) return false;

    this.db.sequences = this.db.sequences.filter((s) => s.id !== id);
    this.persistAndNotify();
    return true;
  }

  // --- Tasks Operations ---
  public getTasks(): Task[] {
    return [...this.db.tasks];
  }

  public createTask(task: Omit<Task, 'id'>): Task {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.db.tasks.unshift(newTask);
    this.persistAndNotify();
    return newTask;
  }

  public updateTaskStatus(id: string, status: Task['status']): Task | undefined {
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return undefined;

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date().toISOString();
      this.addActivityEvent({
        leadId: task.leadId,
        type: 'task_completed',
        title: 'Task Completed',
        description: `Task "${task.title}" was marked complete.`,
        actorName: task.assignedToName || 'Alex Rivera',
        timestamp: new Date().toISOString(),
      });
    }

    this.persistAndNotify();
    return task;
  }

  public rescheduleTask(id: string, newDueDate: string): Task | undefined {
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return undefined;

    task.dueDate = newDueDate;
    if (task.status === 'overdue' && newDueDate >= new Date().toISOString().split('T')[0]) {
      task.status = 'pending';
    }

    this.persistAndNotify();
    return task;
  }

  public deleteTask(id: string): boolean {
    const initialLen = this.db.tasks.length;
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
    const deleted = this.db.tasks.length < initialLen;
    if (deleted) this.persistAndNotify();
    return deleted;
  }

  // --- Team Operations ---
  public getTeamMembers(): TeamMember[] {
    return [...this.db.team];
  }

  public addTeamMember(member: Omit<TeamMember, 'id'>): TeamMember {
    const newMember: TeamMember = {
      ...member,
      id: `user_${Date.now()}`,
    };
    this.db.team.push(newMember);
    this.persistAndNotify();
    return newMember;
  }

  // --- Activities Operations ---
  public getActivityEvents(leadId?: string): ActivityEvent[] {
    if (leadId) {
      return this.db.activities.filter((a) => a.leadId === leadId);
    }
    return [...this.db.activities];
  }

  public addActivityEvent(event: Omit<ActivityEvent, 'id'>): ActivityEvent {
    const newEvent: ActivityEvent = {
      ...event,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.db.activities.unshift(newEvent);
    this.persistAndNotify();
    return newEvent;
  }

  // --- Settings Operations ---
  public getSettings(): WorkspaceSettings {
    return { ...this.db.settings };
  }

  public updateSettings(settings: Partial<WorkspaceSettings>): WorkspaceSettings {
    this.db.settings = {
      ...this.db.settings,
      ...settings,
    };
    this.persistAndNotify();
    return this.db.settings;
  }

  // --- Reset & Export ---
  public resetToDefaults(): void {
    this.db = {
      leads: SEEDED_LEADS,
      sequences: SEEDED_SEQUENCES,
      tasks: SEEDED_TASKS,
      activities: SEEDED_ACTIVITIES,
      team: SEEDED_TEAM_MEMBERS,
      settings: SEEDED_SETTINGS,
    };
    this.persistAndNotify();
  }

  public exportAllData(): string {
    return JSON.stringify(this.db, null, 2);
  }
}

export const prototypeStore = new PrototypeStore();
