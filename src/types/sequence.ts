import { Lead, SequenceType } from './lead';

export type StepStatus = 'Pending' | 'Sent' | 'Skipped';

export interface Sequence {
  id: string;
  leadId: string;
  type: SequenceType;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  leadId: string;
  stepNumber: number;
  scheduledDate: string; // ISO format or YYYY-MM-DD
  message: string;       // LinkedIn message text or Email body
  subject?: string;      // Email subject (optional for LinkedIn)
  status: StepStatus;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateSequenceStepInput = Omit<
  SequenceStep,
  'id' | 'sequenceId' | 'leadId' | 'status' | 'sentAt' | 'createdAt' | 'updatedAt'
>;

export interface PendingFollowUp {
  step: SequenceStep;
  lead: Lead;
}
