export const LEAD_STATUS_OPTIONS = ['New', 'Contacted', 'Closed'] as const;
export const LEAD_SOURCE_OPTIONS = ['LinkedIn', 'Email', 'Website'] as const;

export const STATUS_COLORS = {
  New: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  Contacted: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  Closed: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
};
