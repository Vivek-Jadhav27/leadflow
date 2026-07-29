import { Lead, LeadFilterOptions, DashboardStats } from '@/types/lead';

export interface LeadState {
  leads: Lead[];
  stats: DashboardStats;
  filters: LeadFilterOptions;
  loading: boolean;
  error: string | null;
}

export const initialLeadFilters: LeadFilterOptions = {
  searchQuery: '',
  sequenceType: 'All',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const initialLeadStats: DashboardStats = {
  totalLeads: 0,
  linkedinSequences: 0,
  emailSequences: 0,
  todayPendingFollowups: 0,
};

export const initialLeadState: LeadState = {
  leads: [],
  stats: initialLeadStats,
  filters: initialLeadFilters,
  loading: true,
  error: null,
};

