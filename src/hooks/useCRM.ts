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
import { useAuthContext } from '@/context/AuthProvider';

// Global request deduping and synchronization throttler across all hook instances
let lastCloudSyncTimestamp = 0;
let inflightCloudSyncPromise: Promise<void> | null = null;
const CLOUD_SYNC_INTERVAL_MS = 60 * 1000; // Throttle cloud fetches to at most once per 60s per workspace

export function useCRM() {
  const { currentWorkspace, user, isAdmin } = useAuthContext();
  const currentWorkspaceId = currentWorkspace?.workspaceId || user?.workspaceId || null;

  const [leads, setLeads] = useState<Lead[]>(() => prototypeStore.getLeads(currentWorkspaceId || undefined));
  const [sequences, setSequences] = useState<Sequence[]>(() => prototypeStore.getSequences(currentWorkspaceId || undefined));
  const [tasks, setTasks] = useState<Task[]>(() => prototypeStore.getTasks());
  const [activities, setActivities] = useState<ActivityEvent[]>(() => prototypeStore.getActivityEvents());
  const [team, setTeam] = useState<TeamMember[]>(() => prototypeStore.getTeamMembers());
  const [settings, setSettings] = useState<WorkspaceSettings>(() => prototypeStore.getSettings());

  const refreshAll = useCallback(() => {
    setLeads(prototypeStore.getLeads(currentWorkspaceId || undefined));
    setSequences(prototypeStore.getSequences(currentWorkspaceId || undefined));
    setTasks(prototypeStore.getTasks());
    setActivities(prototypeStore.getActivityEvents());
    setTeam(prototypeStore.getTeamMembers());
    setSettings(prototypeStore.getSettings());
  }, [currentWorkspaceId]);

  // Subscribe to prototype store changes
  useEffect(() => {
    refreshAll();
    const unsubscribe = prototypeStore.subscribe(() => {
      refreshAll();
    });
    return unsubscribe;
  }, [refreshAll]);

  // Synchronize incoming leads & sequences from Firestore on initial mount or when workspace changes
  useEffect(() => {
    let isMounted = true;

    const syncCloudData = async () => {
      const now = Date.now();
      // Skip if already synchronized within the throttle window
      if (now - lastCloudSyncTimestamp < CLOUD_SYNC_INTERVAL_MS && lastCloudSyncTimestamp > 0) {
        return;
      }

      // If another component instance is currently fetching, wait for that same in-flight fetch
      if (inflightCloudSyncPromise) {
        await inflightCloudSyncPromise;
        if (isMounted) refreshAll();
        return;
      }

      inflightCloudSyncPromise = (async () => {
        try {
          const headers: Record<string, string> = {};
          if (currentWorkspaceId) {
            headers['x-workspace-id'] = currentWorkspaceId;
          }

          // Optimized Dashboard Mode: Fetch a single consolidated API call
          // containing only today's outreach cadence leads instead of 3 separate calls
          const isDashboard =
            typeof window !== 'undefined' &&
            (window.location.pathname === '/dashboard' || window.location.pathname === '/');

          if (isDashboard) {
            const dashUrl = currentWorkspaceId
              ? `/api/dashboard?workspaceId=${encodeURIComponent(currentWorkspaceId)}`
              : '/api/dashboard';
            const dashRes = await fetch(dashUrl, { headers });
            if (dashRes.ok) {
              const data = await dashRes.json().catch(() => ({}));
              if (data.todayLeads && Array.isArray(data.todayLeads)) {
                prototypeStore.syncIncomingLeads(data.todayLeads, currentWorkspaceId || undefined);
              }
              if (data.sequences && Array.isArray(data.sequences)) {
                prototypeStore.syncIncomingSequences(data.sequences, currentWorkspaceId || undefined);
              }
              if (data.team && Array.isArray(data.team)) {
                prototypeStore.syncIncomingTeam(data.team);
              }
              lastCloudSyncTimestamp = Date.now();
              return;
            }
          }

          let leadsUrl = '/api/leads';
          let seqUrl = '/api/sequences';
          let teamUrl = '/api/team';

          if (currentWorkspaceId) {
            leadsUrl += `?workspaceId=${encodeURIComponent(currentWorkspaceId)}&limit=50`;
            seqUrl += `?workspaceId=${encodeURIComponent(currentWorkspaceId)}`;
            teamUrl += `?workspaceId=${encodeURIComponent(currentWorkspaceId)}`;
          }

          // Fetch leads, sequences, and team in parallel
          const [leadsRes, seqRes, teamRes] = await Promise.allSettled([
            fetch(leadsUrl, { headers }),
            fetch(seqUrl, { headers }),
            fetch(teamUrl, { headers }),
          ]);

          if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
            const data = await leadsRes.value.json().catch(() => ({}));
            if (data.leads && Array.isArray(data.leads)) {
              prototypeStore.syncIncomingLeads(data.leads, currentWorkspaceId || undefined);
            }
          }

          if (seqRes.status === 'fulfilled' && seqRes.value.ok) {
            const data = await seqRes.value.json().catch(() => ({}));
            if (data.sequences && Array.isArray(data.sequences)) {
              prototypeStore.syncIncomingSequences(data.sequences, currentWorkspaceId || undefined);
            }
          }

          if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
            const data = await teamRes.value.json().catch(() => ({}));
            if (data.team && Array.isArray(data.team)) {
              prototypeStore.syncIncomingTeam(data.team);
            }
          }

          lastCloudSyncTimestamp = Date.now();
        } catch {
          // Silently ignore network errors when offline
        } finally {
          inflightCloudSyncPromise = null;
        }
      })();

      await inflightCloudSyncPromise;
      if (isMounted) {
        refreshAll();
      }
    };

    syncCloudData();

    return () => {
      isMounted = false;
    };
  }, [currentWorkspaceId, refreshAll]);

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
        const targetWorkspaceId = input.workspaceId || currentWorkspaceId;
        const resolvedAssignedId = input.assignedToId || (isAdmin ? null : (user?.uid || null));
        const resolvedAssignedEmail = input.assignedToEmail || (isAdmin ? null : (user?.email || null));
        const resolvedAssignedName = input.assignedToName || (isAdmin ? null : (user?.displayName || (user?.email ? user.email.split('@')[0] : null)));

        const leadPayload = {
          ...input,
          workspaceId: targetWorkspaceId,
          assignedToId: resolvedAssignedId,
          assignedToName: resolvedAssignedName,
          assignedToEmail: resolvedAssignedEmail,
          capturedBy: input.capturedBy || user?.email || (isAdmin ? 'Workspace Admin' : 'Outbound SDR'),
          capturedByUid: input.capturedByUid || user?.uid || null,
        };
        const lead = prototypeStore.createLead(leadPayload);
        refreshAll();
        // Persist to Firestore via API
        fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(targetWorkspaceId ? { 'x-workspace-id': targetWorkspaceId } : {}),
          },
          body: JSON.stringify(lead),
        }).catch((e) => console.warn('Firestore sync warning for lead', e));
        toast.success(`Lead captured: ${lead.firstName} ${lead.lastName}`);
        return lead;
      } catch (err) {
        toast.error('Failed to capture lead');
        return undefined;
      }
    },
    [currentWorkspaceId, user, isAdmin, refreshAll]
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
        // Persist to Firestore & backend via API
        fetch(`/api/leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) =>
          console.warn('Firestore sync warning for lead delete', e)
        );
        toast.success('Lead permanently deleted');
      }
      return success;
    },
    [refreshAll]
  );

  const archiveLead = useCallback((id: string, isArchived: boolean = true) => {
    const updated = prototypeStore.archiveLead(id, isArchived);
    if (updated) {
      refreshAll();
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          disposition: updated.disposition,
          outcome: updated.outcome,
        }),
      }).catch((e) => console.warn('Firestore sync warning for archive lead', e));
      toast.success(isArchived ? 'Lead moved to archive' : 'Lead restored to active');
    }
    return updated;
  }, [refreshAll]);

  const enrichLead = useCallback((id: string, data: EnrichedData) => {
    const updated = prototypeStore.enrichLead(id, data);
    if (updated) {
      refreshAll();
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          enrichedData: updated.enrichedData,
          disposition: updated.disposition,
          phone: updated.phone,
        }),
      }).catch((e) => console.warn('Firestore sync warning for enrich lead', e));
      toast.success('Lead profile enriched with verified intelligence');
    }
    return updated;
  }, [refreshAll]);

  const markReply = useCallback((id: string, replyMessage?: string, outcome: string = 'Interested') => {
    const updated = prototypeStore.markReply(id, replyMessage, outcome);
    if (updated) {
      refreshAll();
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          outreachStatus: updated.outreachStatus,
          disposition: updated.disposition,
          outcome: updated.outcome,
          nextFollowUpDate: null,
          nextActionTitle: updated.nextActionTitle,
        }),
      }).catch((e) => console.warn('Firestore sync warning for mark reply', e));
      toast.success('Reply recorded. Automated sequence halted.');
    }
    return updated;
  }, [refreshAll]);

  const advanceLeadStep = useCallback((id: string) => {
    const updated = prototypeStore.advanceLeadStep(id);
    if (updated) {
      refreshAll();
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: updated.id,
          currentStepNumber: updated.currentStepNumber,
          connectionStatus: updated.connectionStatus,
          outreachStatus: updated.outreachStatus,
          disposition: updated.disposition,
          nextFollowUpDate: updated.nextFollowUpDate || null,
          nextActionTitle: updated.nextActionTitle || null,
          activityHistory: updated.activityHistory || [],
        }),
      }).catch((e) => console.warn('Firestore sync warning for advance lead step', e));
      toast.success(`Advanced ${updated.firstName} to step ${updated.currentStepNumber}`);
    }
    return updated;
  }, [refreshAll]);

  const assignSequenceToLead = useCallback(
    (leadId: string, sequenceId: string | null) => {
      const updated = prototypeStore.assignSequenceToLead(leadId, sequenceId);
      if (updated) {
        refreshAll();
        // Persist sequence assignment directly to Firebase Firestore
        fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: leadId,
            sequenceId: updated.sequenceId,
            sequenceName: updated.sequenceName,
            currentStepNumber: updated.currentStepNumber,
            totalSteps: updated.totalSteps,
            outreachStatus: updated.outreachStatus,
            nextFollowUpDate: updated.nextFollowUpDate,
            nextActionTitle: updated.nextActionTitle,
            activityHistory: updated.activityHistory || [],
          }),
        }).catch((e) => console.warn('Firestore sequence assign error', e));

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

      const updatedLeads = prototypeStore
        .getLeads()
        .filter((l) => leadIds.includes(l.id))
        .map((l) => ({
          id: l.id,
          sequenceId: l.sequenceId,
          sequenceName: l.sequenceName,
          currentStepNumber: l.currentStepNumber,
          totalSteps: l.totalSteps,
          outreachStatus: l.outreachStatus,
          nextFollowUpDate: l.nextFollowUpDate,
          nextActionTitle: l.nextActionTitle,
        }));

      if (updatedLeads.length > 0) {
        fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: updatedLeads }),
        }).catch((e) => console.warn('Firestore bulk sequence assign error', e));
      }

      toast.success(`${leadIds.length} lead(s) sequence saved to Cloud!`);
    },
    [refreshAll]
  );

  const bulkAssign = useCallback((ids: string[], memberId: string) => {
    prototypeStore.bulkAssign(ids, memberId);
    refreshAll();

    const updatedLeads = prototypeStore
      .getLeads()
      .filter((l) => ids.includes(l.id))
      .map((l) => ({
        id: l.id,
        assignedToId: l.assignedToId,
        assignedToName: l.assignedToName,
        assignedToEmail: l.assignedToEmail,
      }));

    if (updatedLeads.length > 0) {
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: updatedLeads }),
      }).catch((e) => console.warn('Firestore bulk assign error', e));
    }

    toast.success(`${ids.length} leads reassigned in Cloud`);
  }, [refreshAll]);

  const bulkArchive = useCallback((ids: string[]) => {
    prototypeStore.bulkArchive(ids);
    refreshAll();
    toast.success(`${ids.length} leads archived`);
  }, [refreshAll]);

  const bulkDelete = useCallback(
    (ids: string[]) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      prototypeStore.bulkDelete(ids);
      refreshAll();
      // Persist bulk deletion to Firestore & backend via API
      fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch((e) => console.warn('Firestore sync warning for bulk lead delete', e));
      toast.success(`${ids.length} leads permanently deleted`);
    },
    [refreshAll]
  );

  // Sequence actions
  const saveSequence = useCallback(
    (seq: Sequence) => {
      const targetWorkspaceId = seq.workspaceId || currentWorkspaceId;
      const sequencePayload: Sequence = {
        ...seq,
        workspaceId: targetWorkspaceId,
        createdBy: seq.createdBy || user?.email || (isAdmin ? 'Workspace Admin' : 'Outbound SDR'),
        createdByUid: seq.createdByUid || user?.uid || null,
      };
      const saved = prototypeStore.saveSequence(sequencePayload);
      refreshAll();
      // Persist to Firestore via API
      fetch('/api/sequences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(targetWorkspaceId ? { 'x-workspace-id': targetWorkspaceId } : {}),
        },
        body: JSON.stringify(saved),
      }).catch((e) => console.warn('Firestore sync warning for sequence', e));
      toast.success(`Sequence "${saved.name}" saved`);
      return saved;
    },
    [currentWorkspaceId, user, isAdmin, refreshAll]
  );

  const approveSequence = useCallback(
    (id: string, approverName?: string) => {
      const resolvedApprover = approverName || user?.displayName || user?.email || 'Admin';
      const approved = prototypeStore.approveSequence(id, resolvedApprover);
      if (approved) {
        refreshAll();
        // Persist to Firestore via API
        fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approved),
        }).catch((e) => console.warn('Firestore sync warning for sequence approval', e));

        // Also persist any leads that were activated by this sequence approval
        const activatedLeads = prototypeStore.getLeads().filter(
          (l) => l.sequenceId === approved.id || (approved.targetLeadId && l.id === approved.targetLeadId)
        );
        activatedLeads.forEach((l) => {
          fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(l),
          }).catch((e) => console.warn('Firestore sync warning for approved lead', e));
        });

        toast.success(`Sequence "${approved.name}" approved and activated!`);
      }
      return approved;
    },
    [refreshAll, user]
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
      const curLeads = prototypeStore.getLeads(currentWorkspaceId || undefined);
      const curSeqs = prototypeStore.getSequences(currentWorkspaceId || undefined);
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentWorkspaceId ? { 'x-workspace-id': currentWorkspaceId } : {}),
        },
        body: JSON.stringify({
          leads: curLeads,
          sequences: curSeqs,
          workspaceId: currentWorkspaceId,
        }),
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
  }, [currentWorkspaceId]);

  const resetToDefaults = useCallback(() => {
    prototypeStore.resetToDefaults();
    toast.success('Reset all CRM data to initial sample seed');
  }, []);

  const bulkCreateLeads = useCallback(
    async (
      leadsToCreate: Array<Partial<Lead>>,
      defaults?: { defaultSequenceId?: string; defaultAssignedToId?: string; defaultAssignedToName?: string; workspaceId?: string }
    ) => {
      try {
        const targetWorkspaceId = defaults?.workspaceId || currentWorkspaceId;
        const leadsWithWorkspace = leadsToCreate.map((l) => ({
          ...l,
          workspaceId: l.workspaceId || targetWorkspaceId,
          capturedBy: l.capturedBy || user?.email || (isAdmin ? 'Workspace Admin' : 'Outbound SDR'),
          capturedByUid: l.capturedByUid || user?.uid || null,
        }));

        const res = await fetch('/api/leads/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(targetWorkspaceId ? { 'x-workspace-id': targetWorkspaceId } : {}),
          },
          body: JSON.stringify({
            leads: leadsWithWorkspace,
            workspaceId: targetWorkspaceId,
            ...defaults,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to import leads');
        }

        if (Array.isArray(data.leads)) {
          prototypeStore.bulkAddLeads(data.leads);
          refreshAll();
        }

        toast.success(`Successfully imported ${data.count || leadsToCreate.length} leads to Cloud Database!`);
        return data.leads || [];
      } catch (err: any) {
        toast.error(`Import failed: ${err.message || 'Server error'}`);
        throw err;
      }
    },
    [currentWorkspaceId, user, isAdmin, refreshAll]
  );

  const addActivityEvent = useCallback(
    (event: Omit<ActivityEvent, 'id'>) => {
      const created = prototypeStore.addActivityEvent(event);
      refreshAll();
      if (event.leadId) {
        const lead = prototypeStore.getLeadById(event.leadId);
        if (lead) {
          fetch('/api/leads', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: event.leadId,
              activityHistory: lead.activityHistory || [created],
            }),
          }).catch((e) => console.warn('Activity history persist warning', e));
        }
      }
      return created;
    },
    [refreshAll]
  );

  return {
    leads,
    sequences,
    tasks,
    activities,
    team,
    settings,
    stats,
    syncToFirestore,
    bulkCreateLeads,
    addActivityEvent,
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
