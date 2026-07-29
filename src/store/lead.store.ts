import { Lead, LeadFilterOptions, LeadDashboardStats } from '@/types/lead';

export interface LeadState {
  leads: Lead[];
  stats: LeadDashboardStats;
  filters: LeadFilterOptions;
  loading: boolean;
  error: string | null;
}

export const initialLeadFilters: LeadFilterOptions = {
  searchQuery: '',
  status: 'All',
  priority: 'All',
  source: 'All',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const initialLeadStats: LeadDashboardStats = {
  totalLeads: 0,
  newLeads: 0,
  interestedLeads: 0,
  closedLeads: 0,
};

export const initialLeadState: LeadState = {
  leads: [],
  stats: initialLeadStats,
  filters: initialLeadFilters,
  loading: true,
  error: null,
};
