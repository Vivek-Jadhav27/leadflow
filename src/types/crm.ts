export type LeadChannel = 'linkedin';

export type LinkedInConnectionStatus =
  | 'not_started'
  | 'pending'
  | 'request_pending'
  | 'request_sent'
  | 'connected'
  | 'declined'
  | 'verified'
  | 'not_connected';

export type ConnectionStatus = LinkedInConnectionStatus;

export type OutreachStatus =
  | 'unassigned'
  | 'in_sequence'
  | 'approval_pending'
  | 'pending_sequence_approval'
  | 'needs_sequence'
  | 'message_sent'
  | 'followup_due'
  | 'replied'
  | 'completed'
  | 'paused'
  | 'stopped';

export type LeadOutcome =
  | 'active'
  | 'complete_details'
  | 'enriched'
  | 'archived'
  | 'meeting_booked'
  | 'interested'
  | 'not_interested'
  | 'lost'
  | 'Meeting Booked'
  | 'Interested'
  | 'Converted'
  | 'Not Interested'
  | 'Lost / Unresponsive'
  | 'Complete Details Stage'
  | 'Enriched'
  | 'Archived';

export interface EnrichedData {
  phoneVerified?: boolean;
  phone?: string;
  companySize?: string;
  annualRevenue?: string;
  techStack?: string[];
  headquarters?: string;
  enrichedAt?: string;
  enrichmentNotes?: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  email: string | null;
  phone?: string | null;
  linkedinUrl: string;
  channel: 'linkedin';
  sequenceId?: string | null;
  sequenceName?: string | null;
  currentStepNumber: number;
  totalSteps?: number;
  connectionStatus: LinkedInConnectionStatus;
  outreachStatus: OutreachStatus;
  disposition: LeadOutcome;
  outcome?: string | null;
  workspaceId?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  capturedBy?: string | null;
  capturedByUid?: string | null;
  nextFollowUpDate?: string | null; // YYYY-MM-DD
  sequenceStartDate?: string | null;
  nextActionTitle?: string | null;
  connectionNote?: string | null;
  sequenceMode?: 'approved' | 'custom' | null;
  customSteps?: SequenceStep[] | null;
  notes?: string | null;
  activityHistory?: ActivityEvent[];
  enrichedData?: EnrichedData;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id?: string;
  stepNumber: number;
  actionType:
    | 'connection_request'
    | 'wait_for_acceptance'
    | 'send_message'
    | 'wait_delay'
    | 'followup'
    | 'complete_details';
  title: string;
  delayDays: number;
  messageTemplate?: string;
  enabled: boolean;
}

export interface Sequence {
  id: string;
  name: string;
  channel: 'linkedin';
  description: string;
  steps: SequenceStep[];
  status: 'active' | 'paused' | 'draft' | 'archived' | 'pending_approval';
  approvalStatus?: 'approved' | 'pending';
  approvedBy?: string;
  approvedByUid?: string | null;
  approvedAt?: string;
  enrolledLeadsCount?: number;
  workspaceId?: string | null;
  createdBy?: string | null;
  createdByUid?: string | null;
  createdByRole?: 'admin' | 'sdr' | 'ae';
  /** Who last edited the sequence. Never changes ownership (createdBy*). */
  updatedBy?: string | null;
  updatedByUid?: string | null;
  updatedByName?: string | null;
  updatedByRole?: 'admin' | 'sdr' | 'ae' | null;
  targetRole?: 'all' | 'sdr' | 'ae';
  isCustom?: boolean;
  targetLeadId?: string | null;
  targetLeadName?: string | null;
  targetLeadCompany?: string | null;
  targetLeadLinkedin?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadLinkedin?: string;
  sequenceId?: string;
  stepNumber?: number;
  messageTemplate?: string;
  notes?: string;
  type:
    | 'linkedin_connect'
    | 'linkedin_message'
    | 'followup'
    | 'enrich'
    | 'manual_review'
    | 'check_reply'
    | string;
  dueDate: string; // YYYY-MM-DD
  assignedToId: string;
  assignedToName: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'overdue' | 'skipped' | 'held' | 'cancelled';
  completedAt?: string;
}

export interface ActivityEvent {
  id: string;
  leadId: string;
  leadName?: string;
  type:
    | 'lead_created'
    | 'connection_request_sent'
    | 'connection_accepted'
    | 'message_sent'
    | 'reply_received'
    | 'task_completed'
    | 'task_skipped'
    | 'enriched'
    | 'lead_enriched'
    | 'status_changed'
    | 'meeting_booked'
    | 'archived'
    | 'lead_archived'
    | 'lead_assigned'
    | 'duplicate_checked'
    | 'sequence_completed'
    | 'followup_scheduled'
    | 'note_added'
    | string;
  title: string;
  description: string;
  actorId?: string;
  actorName: string;
  timestamp: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  roleTitle?: string;
  avatarBg?: string;
  initials: string;
  assignedLeadsCount: number;
  activeSequencesCount: number;
  completedTasksWeek: number;
  status: 'active' | 'away' | 'offline';
}

export interface WorkspaceSettings {
  name: string;
  domain: string;
  timezone: string;
  currency: string;
  defaultAssignmentRule: 'round_robin' | 'manual';
  defaultFollowupDays: number;
  workHoursStart: string;
  workHoursEnd: string;
  skipWeekends: boolean;
  stopSequenceOnReply: boolean;
  dailyLinkedInConnectLimit: number;
  dailyLinkedInMessageLimit: number;
}
