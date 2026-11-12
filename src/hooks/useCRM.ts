'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type {
  Lead,
  Sequence,
  Task,
  ActivityEvent,
  WorkspaceSettings,
  EnrichedData,
} from '@/types/crm';
import { useAuthContext } from '@/context/AuthProvider';
import { api, errorMessage } from '@/lib/apiClient';
import { crmStore, type CrmDelta, type CrmState } from '@/store/crmStore';
import { parseTimezone, todayInZone } from '@/utils/workspaceDate';

/**
 * Data access for the CRM UI. All state lives on the server: every action sends an intent to the
 * API, waits for the server's verdict, then merges the server's response into a read-only cache.
 * Failures are surfaced to the user (and nothing changes locally), so the screen can never show a
 * success that did not happen.
 */

const EMPTY: CrmState = {
  ownerUid: null,
  leads: [],
  sequences: [],
  tasks: [],
  activities: [],
  team: [],
  settings: crmStore.getServerState().settings,
  status: 'idle',
  error: null,
  loadedAt: 0,
  truncated: false,
};

interface ActionResponse extends CrmDelta {
  errors?: { id: string; message: string }[];
}

/** Runs a server call, merges its delta, and converts failures into a toast + `undefined`. */
async function run<T extends CrmDelta>(
  call: () => Promise<T>,
  onSuccess?: (res: T) => void,
  failure = 'Action failed'
): Promise<T | undefined> {
  try {
    const res = await call();
    crmStore.applyDelta(res);
    onSuccess?.(res);
    return res;
  } catch (err) {
    toast.error(errorMessage(err, failure));
    return undefined;
  }
}

const post = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body });

/** Removes fields the client must never send when updating a lead. */
function leadPatch(updates: Partial<Lead>): Record<string, unknown> {
  const {
    id: _id,
    createdAt: _c,
    workspaceId: _w,
    capturedBy: _cb,
    capturedByUid: _cu,
    activityHistory: _a,
    ...rest
  } = updates as Record<string, unknown>;
  return rest;
}

export function useCRM() {
  const { user, isAdmin } = useAuthContext();
  const uid = user?.uid ?? null;

  const raw = useSyncExternalStore(crmStore.subscribe, crmStore.getState, crmStore.getServerState);
  // Never expose another user's cached data while the signed-in user is changing.
  const state = raw.ownerUid === uid ? raw : EMPTY;

  useEffect(() => {
    crmStore.setOwner(uid);
    if (uid) void crmStore.load();
  }, [uid]);

  // Refresh when the tab becomes visible again (the store skips the fetch if data is fresh).
  useEffect(() => {
    if (!uid) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void crmStore.load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [uid]);

  const { leads, sequences, tasks, activities, team, settings } = state;

  /** Today's date in the workspace time zone, matching what the server uses for due dates. */
  const today = useMemo(() => todayInZone(parseTimezone(settings.timezone)), [settings.timezone, state.loadedAt]);

  const refresh = useCallback(async () => {
    await crmStore.load(true);
    return crmStore.getState().status !== 'error';
  }, []);

  const stats = useMemo(() => {
    const activeLeads = leads.filter((l) => l.disposition !== 'archived');
    return {
      totalLeads: activeLeads.length,
      inActiveSequences: activeLeads.filter(
        (l) => l.sequenceId && l.outreachStatus !== 'completed' && l.outreachStatus !== 'stopped'
      ).length,
      followupsDueToday: tasks.filter((t) => t.status === 'pending' && t.dueDate <= today).length,
      repliesReceived: activeLeads.filter((l) => l.outreachStatus === 'replied' || l.disposition === 'meeting_booked').length,
      meetingsBooked: activeLeads.filter((l) => l.disposition === 'meeting_booked' || l.outcome === 'Meeting Booked').length,
      completeDetailsCount: activeLeads.filter((l) => l.disposition === 'complete_details').length,
      enrichedCount: activeLeads.filter((l) => l.disposition === 'enriched').length,
      archivedCount: leads.filter((l) => l.disposition === 'archived').length,
    };
  }, [leads, tasks, today]);

  // ---- leads ------------------------------------------------------------------------------------

  const createLead = useCallback(async (input: Partial<Lead>): Promise<Lead | undefined> => {
    const res = await run(
      () => post<ActionResponse & { lead: Lead }>('/api/leads', leadPatch(input)),
      (r) => toast.success(`Lead captured: ${r.lead.firstName} ${r.lead.lastName}`),
      'Failed to capture lead'
    );
    return res?.lead as Lead | undefined;
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>): Promise<Lead | undefined> => {
    const res = await run(
      () => api<ActionResponse & { lead: Lead }>('/api/leads', { method: 'PATCH', body: { id, ...leadPatch(updates) } }),
      () => toast.success('Lead updated successfully'),
      'Failed to update lead'
    );
    return res ? crmStore.getState().leads.find((l) => l.id === id) : undefined;
  }, []);

  const deleteLeads = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      await api('/api/leads', { method: 'DELETE', body: { ids } });
      crmStore.applyDelta({ deletedLeadIds: ids });
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete'));
      return false;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    const ok = await deleteLeads([id]);
    if (ok) toast.success('Lead permanently deleted');
    return ok;
  }, [deleteLeads]);

  const bulkDelete = useCallback(async (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const ok = await deleteLeads(ids);
    if (ok) toast.success(`${ids.length} leads permanently deleted`);
  }, [deleteLeads]);

  const leadAction = useCallback(
    async (id: string, body: Record<string, unknown>, success: (lead?: Lead) => string | null, failure: string) => {
      const res = await run(
        () => post<ActionResponse>(`/api/leads/${encodeURIComponent(id)}/actions`, body),
        (r) => {
          const msg = success(r.lead as Lead | undefined);
          if (msg) toast.success(msg);
        },
        failure
      );
      return res?.lead as Lead | undefined;
    },
    []
  );

  const archiveLead = useCallback(
    (id: string, isArchived: boolean = true) =>
      leadAction(id, { action: 'archive', archived: isArchived }, () => (isArchived ? 'Lead moved to archive' : 'Lead restored to active'), 'Failed to archive lead'),
    [leadAction]
  );

  const enrichLead = useCallback(
    (id: string, data: EnrichedData) =>
      leadAction(id, { action: 'enrich', data }, () => 'Lead profile enriched with verified intelligence', 'Failed to enrich lead'),
    [leadAction]
  );

  const markReply = useCallback(
    (id: string, replyMessage?: string, outcome: string = 'Interested') =>
      leadAction(id, { action: 'reply', message: replyMessage, outcome }, () => 'Reply recorded. Automated sequence halted.', 'Failed to record reply'),
    [leadAction]
  );

  /** Advances the lead one step. Passing the step the user saw makes double clicks / stale tabs safe. */
  const advanceLeadStep = useCallback(
    (id: string) => {
      const current = crmStore.getState().leads.find((l) => l.id === id)?.currentStepNumber;
      return leadAction(
        id,
        { action: 'advance', ...(Number.isInteger(current) ? { expectedStep: current } : {}) },
        (l) => (l ? `Advanced ${l.firstName} to step ${l.currentStepNumber}` : null),
        'Failed to advance lead'
      );
    },
    [leadAction]
  );

  const assignSequenceToLead = useCallback(
    (leadId: string, sequenceId: string | null) =>
      leadAction(
        leadId,
        { action: 'enroll', sequenceId },
        (l) => (l ? (sequenceId ? `Enrolled ${l.firstName} in ${l.sequenceName}!` : `Unenrolled ${l.firstName} from sequence.`) : null),
        'Failed to update sequence'
      ),
    [leadAction]
  );

  const submitCustomSequence = useCallback(
    (leadId: string, input: { name?: string; steps: unknown[]; connectionNote?: string | null }) =>
      leadAction(leadId, { action: 'custom_sequence', ...input }, () => 'Custom cadence submitted for Admin approval', 'Failed to submit cadence'),
    [leadAction]
  );

  const addActivityEvent = useCallback(
    async (event: Pick<ActivityEvent, 'leadId' | 'type' | 'title' | 'description'> & Partial<ActivityEvent>): Promise<ActivityEvent | undefined> => {
      const res = await run(
        () =>
          post<ActionResponse>(`/api/leads/${encodeURIComponent(event.leadId)}/actions`, {
            action: 'activity',
            type: event.type,
            title: event.title,
            description: event.description,
          }),
        undefined,
        'Failed to record activity'
      );
      return res?.activities?.[0];
    },
    []
  );

  const loadActivities = useCallback(async (leadId: string) => {
    try {
      const res = await api<{ activities: ActivityEvent[] }>(`/api/activities?leadId=${encodeURIComponent(leadId)}`);
      crmStore.applyDelta({ activities: res.activities });
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load activity'));
    }
  }, []);

  const BULK_CHUNK = 100; // matches the server's per-request limit
  const bulkAction = useCallback(
    async (body: Record<string, unknown> & { ids: string[] }, success: (n: number) => string, failure: string) => {
      let done = 0;
      const errors: { id: string; message: string }[] = [];
      let lastOk: ActionResponse | undefined;
      for (let i = 0; i < body.ids.length; i += BULK_CHUNK) {
        const res = await run(
          () => post<ActionResponse>('/api/leads/bulk-actions', { ...body, ids: body.ids.slice(i, i + BULK_CHUNK) }),
          undefined,
          failure
        );
        if (!res) break; // run() already showed the error and changed nothing for this chunk
        lastOk = res;
        done += res.leads?.length ?? 0;
        errors.push(...(res.errors ?? []));
      }
      if (done > 0) toast.success(success(done));
      if (errors.length) {
        // Summarise distinct reasons ("Connection request was already sent." x 12) instead of one toast per lead.
        const reasons = new Map<string, number>();
        errors.forEach((e) => reasons.set(e.message, (reasons.get(e.message) ?? 0) + 1));
        const summary = Array.from(reasons, ([m, n]) => (n > 1 ? `${m} (${n})` : m)).join(' · ');
        toast.error(`${errors.length} lead(s) skipped: ${summary}`);
      }
      return lastOk;
    },
    []
  );

  const bulkMarkConnectionSent = useCallback(
    (ids: string[]) =>
      bulkAction({ action: 'connection_sent', ids }, (n) => `${n} lead(s) marked as connection request sent`, 'Failed to mark connection sent'),
    [bulkAction]
  );

  const bulkAssignSequence = useCallback(
    (ids: string[], sequenceId: string | null) =>
      bulkAction({ action: 'enroll', ids, sequenceId }, (n) => `${n} lead(s) updated`, 'Failed to assign sequence'),
    [bulkAction]
  );

  const bulkAssign = useCallback(
    (ids: string[], memberId: string) =>
      bulkAction({ action: 'assign', ids, memberId }, (n) => `${n} leads reassigned`, 'Failed to reassign leads'),
    [bulkAction]
  );

  const bulkArchive = useCallback(
    (ids: string[]) => bulkAction({ action: 'archive', ids }, (n) => `${n} leads archived`, 'Failed to archive leads'),
    [bulkAction]
  );

  const bulkCreateLeads = useCallback(
    async (
      leadsToCreate: Array<Partial<Lead>>,
      defaults?: { defaultSequenceId?: string; defaultAssignedToId?: string; defaultAssignedToName?: string }
    ): Promise<Lead[]> => {
      try {
        const res = await post<ActionResponse & { count: number; skipped?: number; leads: Lead[] }>('/api/leads/bulk', {
          leads: leadsToCreate,
          ...defaults,
        });
        crmStore.applyDelta(res);
        toast.success(
          `Imported ${res.count} lead(s)${res.skipped ? `; skipped ${res.skipped} (duplicates or invalid rows)` : ''}.`
        );
        return res.leads || [];
      } catch (err) {
        toast.error(`Import failed: ${errorMessage(err)}`);
        throw err;
      }
    },
    []
  );

  // ---- sequences --------------------------------------------------------------------------------

  const saveSequence = useCallback(async (seq: Sequence): Promise<Sequence | undefined> => {
    const res = await run(
      () => post<ActionResponse & { sequence: Sequence }>('/api/sequences', seq),
      (r) => toast.success(`Sequence "${r.sequence.name}" saved`),
      'Failed to save sequence'
    );
    return res?.sequence;
  }, []);

  const sequenceAction = useCallback(
    async (id: string, action: string, success: (s: Sequence) => string, failure: string) => {
      const res = await run(
        () => post<ActionResponse & { sequence: Sequence }>(`/api/sequences/${encodeURIComponent(id)}/actions`, { action }),
        (r) => toast.success(success(r.sequence)),
        failure
      );
      return res?.sequence;
    },
    []
  );

  const approveSequence = useCallback(
    (id: string) => sequenceAction(id, 'approve', (s) => `Sequence "${s.name}" approved and activated!`, 'Failed to approve sequence'),
    [sequenceAction]
  );

  const duplicateSequence = useCallback(
    (id: string) => sequenceAction(id, 'duplicate', (s) => `Created duplicate "${s.name}" (needs approval before use)`, 'Failed to duplicate sequence'),
    [sequenceAction]
  );

  const toggleSequenceStatus = useCallback(
    (id: string) => sequenceAction(id, 'toggle', (s) => `Sequence ${s.status === 'active' ? 'activated' : 'paused'}`, 'Failed to change sequence status'),
    [sequenceAction]
  );

  const deleteSequence = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api(`/api/sequences?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      crmStore.applyDelta({ deletedSequenceIds: [id] });
      toast.success('Sequence deleted');
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete sequence'));
      return false;
    }
  }, []);

  // ---- tasks ------------------------------------------------------------------------------------

  const createTask = useCallback(async (task: Partial<Task> & { title: string; leadId: string }): Promise<Task | undefined> => {
    const res = await run(
      () =>
        post<ActionResponse>('/api/tasks', {
          title: task.title,
          leadId: task.leadId,
          type: task.type,
          dueDate: task.dueDate,
          priority: task.priority,
          notes: task.notes,
          assignedToId: task.assignedToId,
        }),
      () => toast.success('Task created'),
      'Failed to create task'
    );
    return res?.tasks?.[0];
  }, []);

  /** Completing the live step task also advances the lead's sequence on the server. */
  const updateTaskStatus = useCallback(async (id: string, status: Task['status']): Promise<Task | undefined> => {
    const res = await run(
      () => api<ActionResponse>('/api/tasks', { method: 'PATCH', body: { id, status } }),
      (r) => {
        if (status === 'completed') {
          toast.success(r.lead ? `Done. ${r.lead.firstName} moved to step ${r.lead.currentStepNumber}` : 'Task marked as completed');
        } else if (status === 'skipped') toast.info('Task skipped and recorded in activity log');
        else toast.info(`Task status: ${status}`);
      },
      'Failed to update task'
    );
    return res?.tasks?.find((t) => t.id === id);
  }, []);

  const rescheduleTask = useCallback(async (id: string, newDueDate: string): Promise<Task | undefined> => {
    const res = await run(
      () => api<ActionResponse>('/api/tasks', { method: 'PATCH', body: { id, dueDate: newDueDate } }),
      () => toast.success(`Task rescheduled to ${newDueDate}`),
      'Failed to reschedule task'
    );
    return res?.tasks?.find((t) => t.id === id);
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    const res = await run(
      () => api<ActionResponse>(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
      () => toast.success('Task deleted'),
      'Failed to delete task'
    );
    return Boolean(res);
  }, []);

  // ---- settings ---------------------------------------------------------------------------------

  const updateSettings = useCallback(async (changes: Partial<WorkspaceSettings>): Promise<WorkspaceSettings | undefined> => {
    try {
      const res = await api<{ settings: WorkspaceSettings }>('/api/settings', { method: 'PUT', body: changes });
      crmStore.setSettings(res.settings);
      toast.success('Workspace settings saved');
      return res.settings;
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save settings'));
      return undefined;
    }
  }, []);

  return {
    leads,
    sequences,
    tasks,
    activities,
    team,
    settings,
    stats,
    today,
    loading: state.status === 'loading' || (Boolean(uid) && state.status === 'idle'),
    error: state.error,
    truncated: state.truncated,
    isAdmin,
    refresh,
    loadActivities,
    bulkCreateLeads,
    addActivityEvent,
    // Leads
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
    submitCustomSequence,
    bulkArchive,
    bulkMarkConnectionSent,
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
    // Settings
    updateSettings,
  };
}
