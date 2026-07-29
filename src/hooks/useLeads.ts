'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilterOptions,
  DashboardStats,
} from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { leadService } from '@/services/lead.service';
import { sequenceService } from '@/services/sequence.service';
import { useAuth } from '@/hooks/useAuth';

export const initialLeadFilters: LeadFilterOptions = {
  searchQuery: '',
  sequenceType: 'All',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const initialDashboardStats: DashboardStats = {
  totalLeads: 0,
  linkedinSequences: 0,
  emailSequences: 0,
  todayPendingFollowups: 0,
};

export function useLeads() {
  const { user } = useAuth();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<DashboardStats>(initialDashboardStats);
  const [filters, setFilters] = useState<LeadFilterOptions>(initialLeadFilters);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refreshes and loads all leads & stats for current user
   */
  const fetchLeads = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const rawLeads = await leadService.getLeads(user.uid);
      const filtered = await leadService.getLeads(user.uid, filters);
      const pendingFollowUps = await sequenceService.getTodayPendingFollowUps(rawLeads);

      setAllLeads(rawLeads);
      setFilteredLeads(filtered);
      setStats(leadService.calculateStats(rawLeads, pendingFollowUps.length));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load leads';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  /**
   * Fetches a single lead by ID
   */
  const getLeadById = async (id: string): Promise<Lead | null> => {
    if (!user?.uid) return null;
    try {
      return await leadService.getLeadById(user.uid, id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch lead';
      toast.error(msg);
      return null;
    }
  };

  /**
   * Creates a lead with sequence steps
   */
  const createLeadWithSequence = async (
    input: CreateLeadInput,
    steps: CreateSequenceStepInput[]
  ): Promise<Lead | null> => {
    if (!user?.uid) return null;
    try {
      const newLead = await leadService.createLeadWithSequence(user.uid, input, steps);
      toast.success(`Lead for "${newLead.company}" & sequence created!`);
      await fetchLeads();
      return newLead;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create lead & sequence';
      toast.error(msg);
      return null;
    }
  };

  /**
   * Updates an existing lead
   */
  const updateLead = async (id: string, input: UpdateLeadInput): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      await leadService.updateLead(user.uid, id, input);
      toast.success('Lead updated successfully!');
      await fetchLeads();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update lead';
      toast.error(msg);
      return false;
    }
  };

  /**
   * Deletes a lead by ID
   */
  const deleteLead = async (id: string): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      await leadService.deleteLead(user.uid, id);
      toast.success('Lead deleted successfully');
      await fetchLeads();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete lead';
      toast.error(msg);
      return false;
    }
  };

  /**
   * Update filter state
   */
  const updateFilters = (newFilters: Partial<LeadFilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  /**
   * Reset filters
   */
  const resetFilters = () => {
    setFilters(initialLeadFilters);
  };

  return {
    leads: filteredLeads,
    allLeads,
    allLeadsCount: allLeads.length,
    stats,
    filters,
    loading,
    error,
    fetchLeads,
    getLeadById,
    createLeadWithSequence,
    updateLead,
    deleteLead,
    updateFilters,
    resetFilters,
  };
}
