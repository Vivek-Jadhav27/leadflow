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
  const [leads, setLeads] = useState<Lead[]>(() => prototypeStore.getLeads());
  const [sequences, setSequences] = useState<Sequence[]>(() => prototypeStore.getSequences());
  const [tasks, setTasks] = useState<Task[]>(() => prototypeStore.getTasks());
  const [activities, setActivities] = useState<ActivityEvent[]>(() => prototypeStore.getActivityEvents());
  const [team, setTeam] = useState<TeamMember[]>(() => prototypeStore.getTeamMembers());
  const [settings, setSettings] = useState<WorkspaceSettings>(() => prototypeStore.getSettings());

  const refreshAll = useCallback(() => {
    setLeads(prototypeStore.getLeads());
    setSequences(prototypeStore.getSequences());
    setTasks(prototypeStore.getTasks());
    setActivities(prototypeStore.getActivityEvents());
    setTeam(prototypeStore.getTeamMembers());
    setSettings(prototypeStore.getSettings());
  }, []);

  // Subscribe to prototype store changes
  useEffect(() => {
    refreshAll();
    const unsubscribe = prototypeStore.subscribe(() => {
      refreshAll();
    });
    return unsubscribe;
  }, [refreshAll]);

  // Synchronize incoming leads & sequences from Firestore and Clipper API
  useEffect(() => {
    let isMounted = true;

    // Initial backfill: sync any existing local leads & sequences to Firestore
    const initialCloudSync = async () => {
      try {
        const curLeads = prototypeStore.getLeads();
        const curSeqs = prototypeStore.getSequences();
        if (curLeads.length > 0 || curSeqs.length > 0) {
          await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: curLeads, sequences: curSeqs }),
          });
        }
      } catch (e) {
        // Silently continue if offline
      }
    };

    initialCloudSync();

    const syncRemoteData = async () => {
      try {
        // 1. Sync leads from Firestore / API
        const leadsRes = await fetch('/api/leads');
        if (leadsRes.ok) {
          const data = await leadsRes.json();
          if (data.leads && Array.isArray(data.leads) && isMounted) {
            const added = prototypeStore.syncIncomingLeads(data.leads);
            if (added > 0) {
              refreshAll();
              toast.success(`⚡ Synced ${added} new lead(s) with Cloud!`);
            }
          }
        }

        // 2. Sync sequences from Firestore / API
        const seqRes = await fetch('/api/sequences');
        if (seqRes.ok) {
          const data = await seqRes.json();
          if (data.sequences && Array.isArray(data.sequences) && isMounted) {
            const addedSeqs = prototypeStore.syncIncomingSequences(data.sequences);
            if (addedSeqs > 0) {
              refreshAll();
            }
          }
        }
      } catch {
        // Silently ignore network errors when offline
      }
    };

    syncRemoteData();
    const interval = setInterval(syncRemoteData, 4000);
    window.addEventListener('focus', syncRemoteData);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', syncRemoteData);
    };
  }, [refreshAll]);

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
        refreshAll();
        // Persist to Firestore via API
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        }).catch((e) => console.warn('Firestore sync warning for lead', e));
        toast.success(`Lead captured: ${lead.firstName} ${lead.lastName}`);
        return lead;
      } catch (err) {
        toast.error('Failed to capture lead');
        return undefined;
      }
    },
    [refreshAll]
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>) => {
      const updated = prototypeStore.updateLead(id, updates);
      if (updated) {
        refreshAll();
        // Persist to Firestore via API
        fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        }).catch((e) => console.warn('Firestore sync warning for lead update', e));
        toast.success('Lead updated successfully');
      }
      return updated;
    },
    [refreshAll]
  );

  const deleteLead = useCallback(
    (id: string) => {
      const success = prototypeStore.deleteLead(id);
      if (success) {
        refreshAll();
        // Persist to Firestore via API
        fetch(`/api/leads?id=${id}`, { method: 'DELETE' }).catch((e) =>
          console.warn('Firestore sync warning for lead delete', e)
        );
        toast.success('Lead and associated tasks removed');
      }
      return success;
    },
    [refreshAll]
  );

  const archiveLead = useCallback((id: string, isArchived: boolean = true) => {
    const updated = prototypeStore.archiveLead(id, isArchived);
    if (updated) {
      refreshAll();
      toast.success(isArchived ? 'Lead moved to archive' : 'Lead restored to active');
    }
    return updated;
  }, [refreshAll]);

  const enrichLead = useCallback((id: string, data: EnrichedData) => {
    const updated = prototypeStore.enrichLead(id, data);
    if (updated) {
      refreshAll();
      toast.success('Lead profile enriched with verified intelligence');
    }
    return updated;
  }, [refreshAll]);

  const markReply = useCallback((id: string, replyMessage?: string, outcome: string = 'Interested') => {
    const updated = prototypeStore.markReply(id, replyMessage, outcome);
    if (updated) {
      refreshAll();
      toast.success('Reply recorded. Automated sequence halted.');
    }
    return updated;
  }, [refreshAll]);

  const advanceLeadStep = useCallback((id: string) => {
    const updated = prototypeStore.advanceLeadStep(id);
    if (updated) {
      refreshAll();
      toast.success(`Advanced ${updated.firstName} to step ${updated.currentStepNumber}`);
    }
    return updated;
  }, [refreshAll]);

  const assignSequenceToLead = useCallback(
    (leadId: string, sequenceId: string | null) => {
      const updated = prototypeStore.assignSequenceToLead(leadId, sequenceId);
      if (updated) {
        refreshAll();
        if (sequenceId) {
          toast.success(`Enrolled ${updated.firstName} in ${updated.sequenceName}!`);
        } else {
          toast.info(`Unenrolled ${updated.firstName} from sequence.`);
        }
      }
      return updated;
    },
    [refreshAll]
  );

  const bulkAssignSequence = useCallback(
    (leadIds: string[], sequenceId: string | null) => {
      prototypeStore.bulkAssignSequence(leadIds, sequenceId);
      refreshAll();
      toast.success(`${leadIds.length} lead(s) sequence updated!`);
    },
    [refreshAll]
  );

  const bulkAssign = useCallback((ids: string[], memberId: string) => {
    prototypeStore.bulkAssign(ids, memberId);
    refreshAll();
    toast.success(`${ids.length} leads reassigned`);
  }, [refreshAll]);

  const bulkArchive = useCallback((ids: string[]) => {
    prototypeStore.bulkArchive(ids);
    refreshAll();
    toast.success(`${ids.length} leads archived`);
  }, [refreshAll]);

  const bulkDelete = useCallback((ids: string[]) => {
    prototypeStore.bulkDelete(ids);
    refreshAll();
    toast.success(`${ids.length} leads deleted`);
  }, [refreshAll]);

  // Sequence actions
  const saveSequence = useCallback(
    (seq: Sequence) => {
      const saved = prototypeStore.saveSequence(seq);
      refreshAll();
      // Persist to Firestore via API
      fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      }).catch((e) => console.warn('Firestore sync warning for sequence', e));
      toast.success(`Sequence "${saved.name}" saved`);
      return saved;
    },
    [refreshAll]
  );

  const approveSequence = useCallback(
    (id: string, approverName?: string) => {
      const approved = prototypeStore.approveSequence(id, approverName);
      if (approved) {
        refreshAll();
        // Persist to Firestore via API
        fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approved),
        }).catch((e) => console.warn('Firestore sync warning for sequence approval', e));
        toast.success(`Sequence "${approved.name}" approved and activated!`);
      }
      return approved;
    },
    [refreshAll]
  );

  const duplicateSequence = useCallback(
    (id: string) => {
      const copy = prototypeStore.duplicateSequence(id);
      if (copy) {
        refreshAll();
        fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(copy),
        }).catch((e) => console.warn('Firestore sync warning for sequence copy', e));
        toast.success(`Created duplicate "${copy.name}"`);
      }
      return copy;
    },
    [refreshAll]
  );

  const deleteSequence = useCallback(
    (id: string) => {
      const ok = prototypeStore.deleteSequence(id);
      if (ok) {
        refreshAll();
        fetch(`/api/sequences?id=${id}`, { method: 'DELETE' }).catch((e) =>
          console.warn('Firestore sync warning for sequence delete', e)
        );
        toast.success('Sequence deleted');
      }
      return ok;
    },
    [refreshAll]
  );

  const toggleSequenceStatus = useCallback(
    (id: string) => {
      const updated = prototypeStore.toggleSequenceStatus(id);
      if (updated) {
        refreshAll();
        fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch((e) => console.warn('Firestore sync warning for sequence status', e));
        toast.success(`Sequence ${updated.status === 'active' ? 'activated' : 'paused'}`);
      }
      return updated;
    },
    [refreshAll]
  );

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

  const syncToFirestore = useCallback(async () => {
    try {
      const curLeads = prototypeStore.getLeads();
      const curSeqs = prototypeStore.getSequences();
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: curLeads, sequences: curSeqs }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Synced ${data.syncedLeads ?? curLeads.length} leads & ${data.syncedSequences ?? curSeqs.length} sequences to Firestore!`);
        return true;
      } else {
        toast.error('Failed to sync to Firestore');
        return false;
      }
    } catch (e: any) {
      toast.error('Sync failed: ' + (e?.message || 'Network error'));
      return false;
    }
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
    syncToFirestore,
    // Actions
    createLead,
    updateLead,
    deleteLead,
    archiveLead,
    enrichLead,
    markReply,
    advanceLeadStep,
    bulkAssign,
    bulkAssignSequence,
    assignSequenceToLead,
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
