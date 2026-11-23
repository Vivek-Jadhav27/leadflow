import type { Lead, Sequence, Task, ActivityEvent, TeamMember, WorkspaceSettings } from '@/types/crm';
import { DEFAULT_SETTINGS } from '@/constants/defaultSettings';
import { api, errorMessage } from '@/lib/apiClient';

/**
 * Client-side cache of server data. It holds NO business logic: every change arrives as the
 * server's response (a "delta") and is merged in by id. The server is the single source of truth;
 * this store only exists so React can render without re-fetching on every interaction.
 */

export interface CrmState {
  ownerUid: string | null;
  leads: Lead[];
  sequences: Sequence[];
  tasks: Task[];
  activities: ActivityEvent[];
  team: TeamMember[];
  settings: WorkspaceSettings;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadedAt: number;
  /** True when a list hit the page cap and some records were not loaded. */
  truncated: boolean;
}

export interface CrmDelta {
  lead?: Partial<Lead> & { id: string };
  leads?: (Partial<Lead> & { id: string })[];
  sequence?: Sequence;
  tasks?: Task[];
  activities?: ActivityEvent[];
  deletedTaskIds?: string[];
  deletedLeadIds?: string[];
  deletedSequenceIds?: string[];
}

const STALE_AFTER_MS = 60 * 1000;
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

const initialState = (): CrmState => ({
  ownerUid: null,
  leads: [],
  sequences: [],
  tasks: [],
  activities: [],
  team: [],
  settings: DEFAULT_SETTINGS,
  status: 'idle',
  error: null,
  loadedAt: 0,
  truncated: false,
});

function upsert<T extends { id: string }>(list: T[], incoming: T[], prepend = true): T[] {
  if (incoming.length === 0) return list;
  const byId = new Map(list.map((i) => [i.id, i]));
  const fresh: T[] = [];
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing) byId.set(item.id, { ...existing, ...item });
    else fresh.push(item);
  }
  const updated = list.map((i) => byId.get(i.id)!);
  return prepend ? [...fresh, ...updated] : [...updated, ...fresh];
}

class CrmStore {
  private state: CrmState = initialState();
  private listeners = new Set<() => void>();
  private inflight: Promise<void> | null = null;

  getState = (): CrmState => this.state;
  getServerState = (): CrmState => INITIAL;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<CrmState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Called whenever the signed-in user changes so one user's data can never be shown to another. */
  setOwner(uid: string | null) {
    if (this.state.ownerUid === uid) return;
    this.inflight = null;
    this.state = { ...initialState(), ownerUid: uid };
    this.listeners.forEach((l) => l());
  }

  applyDelta(d: CrmDelta) {
    let { leads, sequences, tasks, activities } = this.state;

    const leadUpdates = [...(d.leads || []), ...(d.lead ? [d.lead] : [])];
    if (leadUpdates.length) leads = upsert(leads, leadUpdates as Lead[]);
    if (d.sequence) sequences = upsert(sequences, [d.sequence]);
    if (d.tasks?.length) tasks = upsert(tasks, d.tasks);
    if (d.activities?.length) {
      activities = upsert(activities, d.activities).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    }

    if (d.deletedTaskIds?.length) {
      const gone = new Set(d.deletedTaskIds);
      tasks = tasks.filter((t) => !gone.has(t.id));
    }
    if (d.deletedLeadIds?.length) {
      const gone = new Set(d.deletedLeadIds);
      leads = leads.filter((l) => !gone.has(l.id));
      tasks = tasks.filter((t) => !gone.has(t.leadId));
      activities = activities.filter((a) => !gone.has(a.leadId));
    }
    if (d.deletedSequenceIds?.length) {
      const gone = new Set(d.deletedSequenceIds);
      sequences = sequences.filter((s) => !gone.has(s.id));
    }
    this.set({ leads, sequences, tasks, activities });
  }

  setSettings(settings: WorkspaceSettings) {
    this.set({ settings });
  }

  private async fetchAll<T>(path: string, key: string): Promise<{ items: T[]; truncated: boolean }> {
    const items: T[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const res: { nextCursor?: string | null } & Record<string, any> = await api(
        `${path}${sep}limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      );
      items.push(...((res[key] as T[]) || []));
      cursor = res.nextCursor || null;
      if (!cursor) return { items, truncated: false };
    }
    return { items, truncated: true };
  }

  /** Loads everything for the current user. Concurrent callers share one request; fresh data is not re-fetched. */
  load(force = false): Promise<void> {
    const fresh = Date.now() - this.state.loadedAt < STALE_AFTER_MS && this.state.status === 'ready';
    if (!force && fresh) return Promise.resolve();
    if (this.inflight) return this.inflight;

    const owner = this.state.ownerUid;
    this.set({ status: this.state.loadedAt ? this.state.status : 'loading' });

    const run = (async () => {
      const [leads, sequences, team, settings, activities] = await Promise.allSettled([
        this.fetchAll<Lead>('/api/leads', 'leads'),
        api<{ sequences: Sequence[] }>('/api/sequences'),
        // Tasks tab temporarily disabled
        // this.fetchAll<Task>('/api/tasks', 'tasks'),
        api<{ team: TeamMember[] }>('/api/team'),
        api<{ settings: WorkspaceSettings }>('/api/settings'),
        api<{ activities: ActivityEvent[] }>('/api/activities?limit=300'),
      ]);
      // The user changed while we were loading: drop this result.
      if (this.state.ownerUid !== owner) return;

      const patch: Partial<CrmState> = { loadedAt: Date.now() };
      let truncated = false;
      const failures: unknown[] = [];
      const take = <T,>(r: PromiseSettledResult<T>, apply: (v: T) => void) =>
        r.status === 'fulfilled' ? apply(r.value) : failures.push(r.reason);

      take(leads, (v) => { patch.leads = v.items; truncated = truncated || v.truncated; });
      take(sequences, (v) => { patch.sequences = v.sequences || []; });
      // take(tasks, (v) => { patch.tasks = v.items; truncated = truncated || v.truncated; });
      take(team, (v) => { patch.team = v.team || []; });
      take(settings, (v) => { patch.settings = { ...DEFAULT_SETTINGS, ...v.settings }; });
      take(activities, (v) => { patch.activities = v.activities || []; });

      patch.truncated = truncated;
      patch.status = failures.length === 5 ? 'error' : 'ready';
      patch.error = failures.length ? errorMessage(failures[0], 'Failed to load some data') : null;
      this.set(patch);
    })().finally(() => {
      if (this.inflight === run) this.inflight = null;
    });

    this.inflight = run;
    return run;
  }
}

const INITIAL = initialState();
export const crmStore = new CrmStore();
