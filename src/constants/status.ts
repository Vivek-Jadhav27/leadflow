import { SequenceType } from '@/types/lead';
import { StepStatus } from '@/types/sequence';

export const SEQUENCE_TYPE_LABELS: Record<SequenceType, string> = {
  linkedin: 'LinkedIn Sequence',
  email: 'Email Sequence',
};

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  Pending: 'Pending',
  Sent: 'Sent',
  Skipped: 'Skipped',
};

export const STEP_STATUS_COLORS: Record<StepStatus, { bg: string; text: string; border: string }> = {
  Pending: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
  },
  Sent: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
  Skipped: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/20',
  },
};
