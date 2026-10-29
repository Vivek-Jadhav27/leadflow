'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Lead,
  Sequence,
  Task,
  ActivityEvent,
  TeamMember,
  WorkspaceSettings,
  EnrichedData,
} from '@/types/crm';
import { prototypeStore } from '@/services/prototypeStore';

export function useCRM() {
  const [, setTick] = useState(0);

  // Subscribe to prototype store changes
  useEffect(() => {
    const unsubscribe = prototypeStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const leads = useMemo(() => prototypeStore.getLeads(), [prototypeStore]);
  const sequences = useMemo(() => prototypeStore.getSequences(), [prototypeStore]);
  const tasks = useMemo(() => prototypeStore.getTasks(), [prototypeStore]);
  const activities = useMemo(() => prototypeStore.getActivityEvents(), [prototypeStore]);
  const team = useMemo(() => prototypeStore.getTeamMembers(), [prototypeStore]);
  const settings = useMemo(() => prototypeStore.getSettings(), [prototypeStore]);

  // Operational metrics matching decision tree
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const activeLeads = leads.filter((l) => l.disposition !== 'archived');
    const totalLeads = activeLeads.length;

    const inActiveSequences = activeLeads.filter(
      (l) => l.sequenceId && l.outreachStatus !== 'completed' && l.outreachStatus !== 'stopped'
    ).length;

    const followupsDueToday = tasks.filter(
      (t) => t.status === 'pending' && t.dueDate <= todayStr
    ).length;

    const repliesReceived = activeLeads.filter(
      (l) => l.outreachStatus === 'replied' || l.disposition === 'meeting_booked'
    ).length;

    const meetingsBooked = activeLeads.filter(
      (l) => l.disposition === 'meeting_booked' || l.outcome === 'Meeting Booked'
    ).length;

    const completeDetailsCount = activeLeads.filter(
      (l) => l.disposition === 'complete_details'
    ).length;

    const enrichedCount = activeLeads.filter(
      (l) => l.disposition === 'enriched'
    ).length;

    const archivedCount = leads.filter((l) => l.disposition === 'archived').length;

    return {
      totalLeads,
      inActiveSequences,
      followupsDueToday,
      repliesReceived,
      meetingsBooked,
      completeDetailsCount,
      enrichedCount,
      archivedCount,
    };
  }, [leads, tasks]);

  // Lead actions
  const createLead = useCallback(
    (input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const lead = prototypeStore.createLead(input);
        toast.success(`Lead captured: ${lead.firstName} ${lead.lastName}`);
        return lead;
      } catch (err) {
        toast.error('Failed to capture lead');
        return undefined;
      }
    },
    []
  );

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    const updated = prototypeStore.updateLead(id, updates);
    if (updated) {
      toast.success('Lead updated successfully');
    }
    return updated;
  }, []);

  const deleteLead = useCallback((id: string) => {
    const success = prototypeStore.deleteLead(id);
    if (success) {
      toast.success('Lead and associated tasks removed');
    }
    return success;
  }, []);

  const archiveLead = useCallback((id: string, isArchived: boolean = true) => {
    const updated = prototypeStore.archiveLead(id, isArchived);
    if (updated) {
      toast.success(isArchived ? 'Lead moved to archive' : 'Lead restored to active');
    }
    return updated;
  }, []);

  const enrichLead = useCallback((id: string, data: EnrichedData) => {
    const updated = prototypeStore.enrichLead(id, data);
    if (updated) {
      toast.success('Lead profile enriched with verified intelligence');
    }
    return updated;
  }, []);

  const markReply = useCallback((id: string, replyMessage?: string, outcome: string = 'Interested') => {
    const updated = prototypeStore.markReply(id, replyMessage, outcome);
    if (updated) {
      toast.success('Reply recorded. Automated sequence halted.');
    }
    return updated;
  }, []);

  const advanceLeadStep = useCallback((id: string) => {
    const updated = prototypeStore.advanceLeadStep(id);
    if (updated) {
      toast.success(`Advanced ${updated.firstName} to step ${updated.currentStepNumber}`);
    }
    return updated;
  }, []);

  const bulkAssign = useCallback((ids: string[], memberId: string) => {
    prototypeStore.bulkAssign(ids, memberId);
    toast.success(`${ids.length} leads reassigned`);
  }, []);

  const bulkArchive = useCallback((ids: string[]) => {
    prototypeStore.bulkArchive(ids);
    toast.success(`${ids.length} leads archived`);
  }, []);

  const bulkDelete = useCallback((ids: string[]) => {
    prototypeStore.bulkDelete(ids);
    toast.success(`${ids.length} leads deleted`);
  }, []);

  // Sequence actions
  const saveSequence = useCallback((seq: Sequence) => {
    const saved = prototypeStore.saveSequence(seq);
    toast.success(`Sequence "${saved.name}" saved`);
    return saved;
  }, []);

  const approveSequence = useCallback((id: string, approverName?: string) => {
    const approved = prototypeStore.approveSequence(id, approverName);
    if (approved) {
      toast.success(`Sequence "${approved.name}" approved and activated!`);
    }
    return approved;
  }, []);

  const duplicateSequence = useCallback((id: string) => {
    const copy = prototypeStore.duplicateSequence(id);
    if (copy) {
      toast.success(`Created duplicate "${copy.name}"`);
    }
    return copy;
  }, []);

  const deleteSequence = useCallback((id: string) => {
    const ok = prototypeStore.deleteSequence(id);
    if (ok) {
      toast.success('Sequence deleted');
    }
    return ok;
  }, []);

  const toggleSequenceStatus = useCallback((id: string) => {
    const updated = prototypeStore.toggleSequenceStatus(id);
    if (updated) {
      toast.success(`Sequence ${updated.status === 'active' ? 'activated' : 'paused'}`);
    }
    return updated;
  }, []);

  // Task actions
  const createTask = useCallback((task: Omit<Task, 'id'>) => {
    const created = prototypeStore.createTask(task);
    toast.success('Task created');
    return created;
  }, []);

  const updateTaskStatus = useCallback((id: string, status: Task['status']) => {
    const updated = prototypeStore.updateTaskStatus(id, status);
    if (updated) {
      if (status === 'completed') {
        toast.success('Task marked as completed');
      } else if (status === 'skipped') {
        toast.info('Task skipped and recorded in activity log');
      } else {
        toast.info(`Task status: ${status}`);
      }
    }
    return updated;
  }, []);

  const rescheduleTask = useCallback((id: string, newDueDate: string) => {
    const updated = prototypeStore.rescheduleTask(id, newDueDate);
    if (updated) {
      toast.success(`Task rescheduled to ${newDueDate}`);
    }
    return updated;
  }, []);

  const deleteTask = useCallback((id: string) => {
    const ok = prototypeStore.deleteTask(id);
    if (ok) toast.success('Task deleted');
    return ok;
  }, []);

  // Team actions
  const addTeamMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    const created = prototypeStore.addTeamMember(member);
    toast.success(`Invited ${created.name} to team`);
    return created;
  }, []);

  // Settings
  const updateSettings = useCallback((newSettings: Partial<WorkspaceSettings>) => {
    const updated = prototypeStore.updateSettings(newSettings);
    toast.success('Workspace settings saved');
    return updated;
  }, []);

  const resetToDefaults = useCallback(() => {
    prototypeStore.resetToDefaults();
    toast.success('Reset all CRM data to initial sample seed');
  }, []);

  return {
    leads,
    sequences,
    tasks,
    activities,
    team,
    settings,
    stats,
    // Actions
    createLead,
    updateLead,
    deleteLead,
    archiveLead,
    enrichLead,
    markReply,
    advanceLeadStep,
    bulkAssign,
    bulkArchive,
    bulkDelete,
    // Sequences
    saveSequence,
    approveSequence,
    duplicateSequence,
    deleteSequence,
    toggleSequenceStatus,
    // Tasks
    createTask,
    updateTaskStatus,
    rescheduleTask,
    deleteTask,
    // Team
    addTeamMember,
    // Settings
    updateSettings,
    resetToDefaults,
  };
}
