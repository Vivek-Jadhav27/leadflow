export type SequenceType = 'linkedin' | 'email';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  designation: string;
  email: string;
  phone: string;
  linkedin: string;
  notes: string;
  sequenceType: SequenceType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateLeadInput = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface LeadFilterOptions {
  searchQuery?: string;
  sequenceType?: SequenceType | 'All';
  sortBy?: 'createdAt' | 'company' | 'firstName';
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardStats {
  totalLeads: number;
  linkedinSequences: number;
  emailSequences: number;
  todayPendingFollowups: number;
}
