import {
  Lead,
  Sequence,
  Task,
  ActivityEvent,
  TeamMember,
  WorkspaceSettings,
  EnrichedData,
} from '@/types/crm';
import { AuthUser } from '@/types/user';
import { getTodayString, getFutureDateString } from '@/utils/date';

const STORAGE_KEY = 'leadflow_hubspot_crm_db_v3';

export const ADMIN_USER: AuthUser = {
  uid: '',
  email: '',
  displayName: 'Admin User',
  photoURL: null,
  role: 'admin',
  title: 'Workspace Owner & Admin',
};

export const SDR_USER: AuthUser = {
  uid: '',
  email: '',
  displayName: 'SDR User',
  photoURL: null,
  role: 'sdr',
  title: 'Outbound SDR',
};

export const AE_USER: AuthUser = {
  uid: '',
  email: '',
  displayName: 'AE User',
  photoURL: null,
  role: 'ae',
  title: 'Account Executive (AE)',
};

export const SEEDED_TEAM_MEMBERS: TeamMember[] = [];

export const SEEDED_SEQUENCES: Sequence[] = [];

export const SEEDED_LEADS: Lead[] = [];

export const SEEDED_TASKS: Task[] = [];

export const SEEDED_ACTIVITIES: ActivityEvent[] = [];

export const SEEDED_SETTINGS: WorkspaceSettings = {
  name: 'LeadFlow B2B Outbound',
  domain: 'leadflow.io',
  timezone: 'America/New_York (UTC-5)',
  currency: 'USD ($)',
  defaultAssignmentRule: 'round_robin',
  defaultFollowupDays: 3,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  skipWeekends: true,
  stopSequenceOnReply: true,
  dailyLinkedInConnectLimit: 25,
  dailyLinkedInMessageLimit: 50,
};

interface PrototypeDB {
  leads: Lead[];
  sequences: Sequence[];
  tasks: Task[];
  activities: ActivityEvent[];
  team: TeamMember[];
  settings: WorkspaceSettings;
}

class PrototypeStore {
  private db: PrototypeDB;
  private listeners: Set<() => void> = new Set();
  private deletedLeadIds: Set<string> = new Set();

  constructor() {
    this.db = this.loadFromStorage();
  }

  private loadFromStorage(): PrototypeDB {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('leadflow_prototype_db_v3');
        localStorage.removeItem('leadflow_deleted_leads_v1');
      } catch {}
    }

    return {
      leads: [],
      sequences: [],
      tasks: [],
      activities: [],
      team: [],
      settings: SEEDED_SETTINGS,
    };
  }

  private saveToStorage(_data: PrototypeDB) {
    // Explicit rule: Do not store lead/sequence data in browser localStorage.
    // All persistent storage is managed directly by Firebase Firestore via server APIs.
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  private persistAndNotify() {
    this.saveToStorage(this.db);
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in listener', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Leads Operations ---
  public getLeads(workspaceId?: string): Lead[] {
    if (!workspaceId) return [...this.db.leads];
    return this.db.leads.filter((l) => !l.workspaceId || l.workspaceId === workspaceId);
  }

  public getLeadById(id: string): Lead | undefined {
    return this.db.leads.find((l) => l.id === id);
  }

  public createLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...input,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.db.leads.unshift(newLead);

    // Record activity
    this.addActivityEvent({
      leadId: newLead.id,
      type: 'lead_created',
      title: 'Lead Captured',
      description: `${newLead.firstName} ${newLead.lastName} from ${newLead.company} captured and verified.`,
      actorName: newLead.assignedToName || 'Workspace Member',
      timestamp: now,
    });

    // If sequence assigned, record and create first task
    if (newLead.sequenceId) {
      const seq = this.getSequenceById(newLead.sequenceId);
      if (seq && seq.steps.length > 0) {
        const firstStep = seq.steps[0];
        this.createTask({
          title: `Step 1: ${firstStep.title} for ${newLead.firstName} ${newLead.lastName}`,
          leadId: newLead.id,
          leadName: `${newLead.firstName} ${newLead.lastName}`,
          leadCompany: newLead.company,
          leadLinkedin: newLead.linkedinUrl,
          sequenceId: seq.id,
          stepNumber: 1,
          type: 'linkedin_connect',
          dueDate: new Date().toISOString().split('T')[0],
          assignedToId: newLead.assignedToId ?? '',
          assignedToName: newLead.assignedToName ?? '',
          priority: 'high',
          status: 'pending',
          messageTemplate: firstStep.messageTemplate,
        });
      }
    }

    this.persistAndNotify();
    return newLead;
  }

  public bulkAddLeads(leads: Lead[]): number {
    if (!Array.isArray(leads) || leads.length === 0) return 0;
    let added = 0;
    for (const lead of leads) {
      const idx = this.db.leads.findIndex((l) => l.id === lead.id);
      if (idx >= 0) {
        this.db.leads[idx] = { ...this.db.leads[idx], ...lead };
      } else {
        this.db.leads.unshift(lead);
        added++;
      }
    }
    if (added > 0 || leads.length > 0) {
      this.persistAndNotify();
    }
    return added;
  }

  public syncIncomingLeads(incoming: any[], workspaceId?: string): number {
    if (!Array.isArray(incoming) || incoming.length === 0) return 0;
    let modifiedCount = 0;

    const normUrl = (u: string) => (u || '').trim().toLowerCase().replace(/\/+$/, '');

    for (const rawItem of incoming) {
      if (!rawItem.id || this.deletedLeadIds.has(rawItem.id)) continue;
      const item = {
        ...rawItem,
        workspaceId: rawItem.workspaceId || workspaceId || null,
      };
      const itemUrl = normUrl(item.linkedinUrl);

      const existingIndex = this.db.leads.findIndex(
        (l) => l.id === item.id || (itemUrl && normUrl(l.linkedinUrl) === itemUrl)
      );

      // Preserve or initialize activity history
      let activityHistory: ActivityEvent[] = Array.isArray(item.activityHistory) && item.activityHistory.length > 0
        ? [...item.activityHistory]
        : [];

      if (activityHistory.length === 0) {
        // Build initial chronological history so that existing leads never show Activity History (0)
        activityHistory.push({
          id: `act_${item.id}_create`,
          leadId: item.id,
          leadName: `${item.firstName} ${item.lastName}`,
          type: 'lead_created',
          title: 'Lead Captured',
          description: `${item.firstName} ${item.lastName} from ${item.company} captured and verified.`,
          actorName: item.assignedToName || (item.capturedBy ? item.capturedBy.split('@')[0] : 'Workspace Member'),
          timestamp: item.createdAt || new Date().toISOString(),
        });

        if (item.assignedToName) {
          activityHistory.push({
            id: `act_${item.id}_assign`,
            leadId: item.id,
            leadName: `${item.firstName} ${item.lastName}`,
            type: 'lead_assigned',
            title: 'Lead Assigned to Representative',
            description: `Lead assigned to ${item.assignedToName} (${item.assignedToEmail || 'Outbound SDR'}).`,
            actorName: item.assignedToName || 'System',
            timestamp: item.createdAt || new Date().toISOString(),
          });
        }

        if (item.sequenceName || item.sequenceId) {
          activityHistory.push({
            id: `act_${item.id}_seq`,
            leadId: item.id,
            leadName: `${item.firstName} ${item.lastName}`,
            type: 'sequence_assigned',
            title: 'Outreach Sequence Enrolled',
            description: `Enrolled in ${item.sequenceName || 'LinkedIn Outreach Cadence'}. Initial step scheduled.`,
            actorName: item.assignedToName || 'System',
            timestamp: item.createdAt || new Date().toISOString(),
          });
        }
      }

      // Merge into global activities collection
      for (const act of activityHistory) {
        if (!this.db.activities.some((a) => a.id === act.id)) {
          this.db.activities.unshift(act);
        }
      }

      const leadRecord: Lead = {
        id: item.id,
        firstName: item.firstName || '',
        lastName: item.lastName || '',
        company: item.company || '',
        jobTitle: item.jobTitle || 'Prospect',
        email: item.email || null,
        phone: item.phone || null,
        linkedinUrl: item.linkedinUrl || '',
        channel: 'linkedin',
        sequenceId: item.sequenceId || null,
        sequenceName: item.sequenceName || (item.sequenceId ? 'LinkedIn 4-Step Outbound' : null),
        currentStepNumber: item.currentStepNumber || 0,
        totalSteps: item.totalSteps || 4,
        connectionStatus: item.connectionStatus || 'not_started',
        outreachStatus: item.outreachStatus || (item.sequenceId ? 'in_sequence' : 'unassigned'),
        disposition: item.disposition || 'active',
        outcome: item.outcome || null,
        workspaceId: item.workspaceId || null,
        assignedToId: item.assignedToId || null,
        assignedToName: item.assignedToName || null,
        assignedToEmail: item.assignedToEmail || null,
        capturedBy: item.capturedBy || null,
        capturedByUid: item.capturedByUid || null,
        nextFollowUpDate: item.nextFollowUpDate || null,
        sequenceStartDate: item.sequenceStartDate || item.nextFollowUpDate || null,
        nextActionTitle: item.nextActionTitle || null,
        notes: item.notes || null,
        activityHistory,
        enrichedData: item.enrichedData || undefined,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
      };

      if (existingIndex === -1) {
        this.db.leads.push(leadRecord);
        modifiedCount++;
      } else {
        this.db.leads[existingIndex] = {
          ...this.db.leads[existingIndex],
          ...leadRecord,
        };
        modifiedCount++;
      }
    }

    if (modifiedCount > 0) {
      this.persistAndNotify();
    }
    return modifiedCount;
  }

  public syncIncomingTeam(incoming: TeamMember[]): void {
    if (!Array.isArray(incoming)) return;
    this.db.team = incoming;
    this.persistAndNotify();
  }

  public syncIncomingSequences(incoming: Sequence[], workspaceId?: string): number {
    if (!Array.isArray(incoming) || incoming.length === 0) return 0;
    let addedCount = 0;
    for (const rawItem of incoming) {
      const item = {
        ...rawItem,
        workspaceId: rawItem.workspaceId || workspaceId || null,
      };
      const idx = this.db.sequences.findIndex((s) => s.id === item.id);
      if (idx === -1) {
        this.db.sequences.push(item);
        addedCount++;
      } else {
        this.db.sequences[idx] = { ...this.db.sequences[idx], ...item };
      }
    }
    if (addedCount > 0) this.persistAndNotify();
    return addedCount;
  }

  public updateLead(id: string, updates: Partial<Lead>): Lead | undefined {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) return undefined;

    const existing = this.db.leads[index];
    const updated: Lead = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.db.leads[index] = updated;
    this.persistAndNotify();
    return updated;
  }

  public deleteLead(id: string): boolean {
    this.deletedLeadIds.add(id);
    const lead = this.getLeadById(id);
    if (!lead) return false;

    this.db.leads = this.db.leads.filter((l) => l.id !== id);
    this.db.tasks = this.db.tasks.filter((t) => t.leadId !== id);
    this.db.activities = this.db.activities.filter((a) => a.leadId !== id);

    this.persistAndNotify();
    return true;
  }

  public archiveLead(id: string, isArchived: boolean = true): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const disposition = isArchived ? 'archived' : 'active';
    const updated = this.updateLead(id, { disposition, outcome: isArchived ? 'Archived' : 'Active' });

    this.addActivityEvent({
      leadId: id,
      type: isArchived ? 'lead_archived' : 'lead_assigned',
      title: isArchived ? 'Lead Archived' : 'Lead Restored',
      description: isArchived
        ? 'Lead moved to archive. Historical activities preserved.'
        : 'Lead restored from archive to active CRM pipeline.',
      actorName: 'Workspace Member',
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  public enrichLead(id: string, enrichedData: EnrichedData): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const updated = this.updateLead(id, {
      disposition: 'enriched',
      outcome: 'Enriched',
      enrichedData: {
        ...lead.enrichedData,
        ...enrichedData,
        enrichedAt: new Date().toISOString(),
      },
    });

    this.addActivityEvent({
      leadId: id,
      type: 'lead_enriched',
      title: 'Lead Enriched with Intelligence',
      description: `Verified profile: ${enrichedData.companySize || 'Updated'}, Tech stack: ${enrichedData.techStack?.join(', ') || 'Updated'}.`,
      actorName: 'Workspace Member',
      timestamp: new Date().toISOString(),
    });

    // Mark any enrich tasks complete
    this.db.tasks
      .filter((t) => t.leadId === id && t.type === 'enrich')
      .forEach((t) => {
        t.status = 'completed';
        t.completedAt = new Date().toISOString();
      });

    this.persistAndNotify();
    return updated;
  }

  public markReply(id: string, replyMessage?: string, outcome: string = 'Interested'): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead) return undefined;

    const now = new Date().toISOString();
    const isMeeting = outcome.toLowerCase().includes('meeting');

    const updated = this.updateLead(id, {
      outreachStatus: 'replied',
      disposition: isMeeting ? 'meeting_booked' : 'interested',
      outcome: isMeeting ? 'Meeting Booked' : outcome,
      nextFollowUpDate: undefined,
      nextActionTitle: isMeeting ? 'Prepare for Meeting' : 'Respond to prospect reply',
    });

    // Cancel pending follow-up tasks for this sequence
    this.db.tasks
      .filter((t) => t.leadId === id && t.status === 'pending' && (t.type === 'followup' || t.type === 'linkedin_message'))
      .forEach((t) => {
        t.status = 'cancelled';
        t.notes = 'Cancelled due to incoming prospect reply.';
      });

    // Create meeting / reply review task
    this.createTask({
      title: isMeeting
        ? `Meeting Booked with ${lead.firstName} ${lead.lastName} (Prep slides)`
        : `Respond to Reply from ${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadCompany: lead.company,
      leadLinkedin: lead.linkedinUrl,
      type: 'manual_review',
      dueDate: now.split('T')[0],
      assignedToId: lead.assignedToId ?? '',
      assignedToName: lead.assignedToName ?? '',
      priority: 'high',
      status: 'pending',
    });

    // Record activity
    this.addActivityEvent({
      leadId: id,
      type: isMeeting ? 'meeting_booked' : 'reply_received',
      title: isMeeting ? 'Meeting Booked on Calendar' : 'Prospect Reply Received',
      description: replyMessage || `Reply recorded for ${lead.firstName} ${lead.lastName}. Future sequence follow-ups halted.`,
      actorName: `${lead.firstName} ${lead.lastName}`,
      timestamp: now,
    });

    this.persistAndNotify();
    return updated;
  }

  public advanceLeadStep(id: string): Lead | undefined {
    const lead = this.getLeadById(id);
    if (!lead || !lead.sequenceId) return undefined;

    const seq = this.getSequenceById(lead.sequenceId);
    if (!seq) return undefined;

    const nextStepNum = lead.currentStepNumber + 1;
    const now = new Date().toISOString();

    if (nextStepNum > seq.steps.length) {
      // Completed sequence -> moves to complete_details stage
      const updated = this.updateLead(id, {
        currentStepNumber: seq.steps.length,
        outreachStatus: 'completed',
        disposition: 'complete_details',
        nextFollowUpDate: undefined,
        nextActionTitle: 'Review Lead & Complete Details',
      });

      this.addActivityEvent({
        leadId: id,
        type: 'sequence_completed',
        title: 'Sequence Reached Complete Details',
        description: 'All configured LinkedIn outreach steps completed. Ready for Enrich or Archive decision.',
        actorName: 'Workspace Member',
        timestamp: now,
      });

      this.persistAndNotify();
      return updated;
    }

    const step = seq.steps.find((s) => s.stepNumber === nextStepNum);
    const dueDate = getFutureDateString(step?.delayDays ?? 1);

    let newConnStatus = lead.connectionStatus;
    let newOutreachStatus = lead.outreachStatus;

    if (nextStepNum === 2) {
      newConnStatus = 'request_sent';
      newOutreachStatus = 'in_sequence';
    } else if (nextStepNum === 3) {
      newOutreachStatus = 'in_sequence';
    } else if (nextStepNum >= 4) {
      newOutreachStatus = 'followup_due';
    }

    const updated = this.updateLead(id, {
      currentStepNumber: nextStepNum,
      connectionStatus: newConnStatus,
      outreachStatus: newOutreachStatus,
      nextFollowUpDate: dueDate,
      nextActionTitle: step?.title,
    });

    // Mark previous pending tasks for this lead as completed
    this.db.tasks
      .filter((t) => t.leadId === id && t.status === 'pending')
      .forEach((t) => {
        t.status = 'completed';
        t.completedAt = now;
      });

    // Create next step task carrying the sequence step's message template
    if (step) {
      let taskType: Task['type'] = 'linkedin_connect';
      if (step.actionType === 'send_message') taskType = 'linkedin_message';
      else if (step.actionType === 'followup') taskType = 'followup';

      this.createTask({
        title: `Step ${nextStepNum}: ${step.title} for ${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadCompany: lead.company,
        leadLinkedin: lead.linkedinUrl,
        sequenceId: seq.id,
        stepNumber: nextStepNum,
        type: taskType,
        dueDate: dueDate,
        assignedToId: lead.assignedToId || 'sdr_current',
        assignedToName: lead.assignedToName || 'Outbound SDR',
        priority: 'high',
        status: 'pending',
        messageTemplate: step.messageTemplate,
      });
    }

    const isStep1Dispatched = nextStepNum === 2;
    this.addActivityEvent({
      leadId: id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      type: isStep1Dispatched ? 'connection_request_sent' : 'followup_scheduled',
      title: isStep1Dispatched ? 'LinkedIn Connection Request Sent' : `Advanced to Step ${nextStepNum}: ${step?.title}`,
      description: isStep1Dispatched
        ? `Step 1 connection invite sent to ${lead.firstName} ${lead.lastName}. Status updated to Request Sent. Awaiting prospect acceptance (Decision 2 Gate).`
        : `Action completed. Next follow-up scheduled for ${dueDate}.`,
      actorName: 'Workspace Member',
      timestamp: now,
    });

    this.persistAndNotify();
    return updated;
  }

  public assignSequenceToLead(leadId: string, sequenceId: string | null): Lead | undefined {
    const lead = this.getLeadById(leadId);
    if (!lead) return undefined;

    if (!sequenceId) {
      const updated = this.updateLead(leadId, {
        sequenceId: null,
        sequenceName: null,
        currentStepNumber: 0,
        outreachStatus: 'unassigned',
        nextFollowUpDate: null,
        nextActionTitle: null,
      });
      // Remove any pending sequence tasks for this lead
      this.db.tasks = this.db.tasks.filter((t) => t.leadId !== leadId || t.status === 'completed');
      this.persistAndNotify();
      return updated;
    }

    const seq = this.getSequenceById(sequenceId);
    if (!seq) return undefined;

    const firstStep = seq.steps && seq.steps.length > 0 ? seq.steps[0] : null;
    const todayStr = new Date().toISOString().split('T')[0];

    const updated = this.updateLead(leadId, {
      sequenceId: seq.id,
      sequenceName: seq.name,
      currentStepNumber: 1,
      totalSteps: seq.steps ? seq.steps.length : 4,
      outreachStatus: 'in_sequence',
      nextFollowUpDate: todayStr,
      nextActionTitle: firstStep ? firstStep.title : 'Step 1 Action',
    });

    // Remove any previous pending tasks for this lead so they don't collide
    this.db.tasks = this.db.tasks.filter((t) => t.leadId !== leadId || t.status === 'completed');

    // Create the first task for this sequence
    if (firstStep) {
      let taskType: Task['type'] = 'linkedin_connect';
      if (firstStep.actionType === 'send_message') taskType = 'linkedin_message';
      else if (firstStep.actionType === 'followup') taskType = 'followup';

      this.createTask({
        title: `Step 1: ${firstStep.title} for ${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadCompany: lead.company,
        leadLinkedin: lead.linkedinUrl,
        sequenceId: seq.id,
        stepNumber: 1,
        type: taskType,
        dueDate: todayStr,
        assignedToId: lead.assignedToId || 'sdr_current',
        assignedToName: lead.assignedToName || 'Outbound SDR',
        priority: 'high',
        status: 'pending',
        messageTemplate: firstStep.messageTemplate,
      });
    }

    this.addActivityEvent({
      leadId: lead.id,
      type: 'sequence_enrolled',
      title: 'Enrolled in Sequence',
      description: `Prospect was enrolled into sequence "${seq.name}". Step 1 task scheduled for today.`,
      actorName: 'Workspace Member',
      timestamp: new Date().toISOString(),
    });

    this.persistAndNotify();
    return updated;
  }

  public bulkAssignSequence(leadIds: string[], sequenceId: string | null): void {
    leadIds.forEach((id) => {
      this.assignSequenceToLead(id, sequenceId);
    });
  }

  public bulkAssign(ids: string[], memberId: string): void {
    const member = this.db.team.find((m) => m.id === memberId);
    if (!member) return;

    ids.forEach((id) => {
      this.updateLead(id, {
        assignedToId: member.id,
        assignedToName: member.name,
        assignedToEmail: member.email,
      });
      this.addActivityEvent({
        leadId: id,
        type: 'lead_assigned',
        title: 'Lead Reassigned',
        description: `Lead assigned to ${member.name}.`,
        actorName: 'Workspace Member',
        timestamp: new Date().toISOString(),
      });
    });
  }

  public bulkArchive(ids: string[]): void {
    ids.forEach((id) => this.archiveLead(id, true));
  }

  public bulkDelete(ids: string[]): void {
    ids.forEach((id) => this.deletedLeadIds.add(id));
    const set = new Set(ids);
    this.db.leads = this.db.leads.filter((l) => !set.has(l.id));
    this.db.tasks = this.db.tasks.filter((t) => !t.leadId || !set.has(t.leadId));
    this.db.activities = this.db.activities.filter((a) => !a.leadId || !set.has(a.leadId));
    this.persistAndNotify();
  }

  // --- Sequences Operations ---
  public getSequences(workspaceId?: string): Sequence[] {
    const list = this.db.sequences.map((s) => ({
      ...s,
      approvalStatus:
        s.approvalStatus || (s.status === 'active' && s.approvedBy ? 'approved' : 'pending'),
    }));
    if (!workspaceId) return list;
    return list.filter((s) => !s.workspaceId || s.workspaceId === workspaceId);
  }

  public getSequenceById(id: string): Sequence | undefined {
    const s = this.db.sequences.find((seq) => seq.id === id);
    if (!s) return undefined;
    return {
      ...s,
      approvalStatus:
        s.approvalStatus || (s.status === 'active' && s.approvedBy ? 'approved' : 'pending'),
    };
  }

  public saveSequence(sequence: Sequence): Sequence {
    const index = this.db.sequences.findIndex((s) => s.id === sequence.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      const updated: Sequence = {
        ...sequence,
        updatedAt: now,
      };
      this.db.sequences[index] = updated;
      this.persistAndNotify();
      return updated;
    } else {
      const created: Sequence = {
        ...sequence,
        id: sequence.id || `seq_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      this.db.sequences.unshift(created);
      this.persistAndNotify();
      return created;
    }
  }

  public approveSequence(id: string, approverName: string = 'Workspace Admin'): Sequence | undefined {
    const seq = this.db.sequences.find((s) => s.id === id);
    if (!seq) return undefined;

    const now = new Date().toISOString();
    seq.status = 'active';
    seq.approvalStatus = 'approved';
    seq.approvedBy = approverName;
    seq.approvedAt = now;
    seq.updatedAt = now;

    this.persistAndNotify();
    return seq;
  }

  public duplicateSequence(id: string): Sequence | undefined {
    const original = this.getSequenceById(id);
    if (!original) return undefined;

    const copy: Sequence = {
      ...original,
      id: `seq_${Date.now()}_copy`,
      name: `${original.name} (Copy)`,
      enrolledLeadsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: original.steps.map((st, i) => ({
        ...st,
        id: `step_${Date.now()}_${i + 1}`,
      })),
    };

    this.db.sequences.unshift(copy);
    this.persistAndNotify();
    return copy;
  }

  public toggleSequenceStatus(id: string): Sequence | undefined {
    const seq = this.getSequenceById(id);
    if (!seq) return undefined;

    const newStatus = seq.status === 'active' ? 'paused' : 'active';
    seq.status = newStatus;
    seq.updatedAt = new Date().toISOString();

    this.persistAndNotify();
    return seq;
  }

  public deleteSequence(id: string): boolean {
    const exists = this.db.sequences.some((s) => s.id === id);
    if (!exists) return false;

    this.db.sequences = this.db.sequences.filter((s) => s.id !== id);
    this.persistAndNotify();
    return true;
  }

  // --- Tasks Operations ---
  public getTasks(): Task[] {
    return [...this.db.tasks];
  }

  public createTask(task: Omit<Task, 'id'>): Task {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.db.tasks.unshift(newTask);
    this.persistAndNotify();
    return newTask;
  }

  public updateTaskStatus(id: string, status: Task['status']): Task | undefined {
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return undefined;

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date().toISOString();
      this.addActivityEvent({
        leadId: task.leadId,
        type: 'task_completed',
        title: 'Task Completed',
        description: `Task "${task.title}" was marked complete.`,
        actorName: task.assignedToName || 'Workspace Member',
        timestamp: new Date().toISOString(),
      });
    }

    this.persistAndNotify();
    return task;
  }

  public rescheduleTask(id: string, newDueDate: string): Task | undefined {
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return undefined;

    task.dueDate = newDueDate;
    if (task.status === 'overdue' && newDueDate >= new Date().toISOString().split('T')[0]) {
      task.status = 'pending';
    }

    this.persistAndNotify();
    return task;
  }

  public deleteTask(id: string): boolean {
    const initialLen = this.db.tasks.length;
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
    const deleted = this.db.tasks.length < initialLen;
    if (deleted) this.persistAndNotify();
    return deleted;
  }

  // --- Team Operations ---
  public getTeamMembers(): TeamMember[] {
    return [...this.db.team];
  }

  public addTeamMember(member: Omit<TeamMember, 'id'>): TeamMember {
    const newMember: TeamMember = {
      ...member,
      id: `user_${Date.now()}`,
    };
    this.db.team.push(newMember);
    this.persistAndNotify();
    return newMember;
  }

  // --- Activities Operations ---
  public getActivityEvents(leadId?: string): ActivityEvent[] {
    if (leadId) {
      return this.db.activities.filter((a) => a.leadId === leadId);
    }
    return [...this.db.activities];
  }

  public addActivityEvent(event: Omit<ActivityEvent, 'id'>): ActivityEvent {
    const newEvent: ActivityEvent = {
      ...event,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    this.db.activities.unshift(newEvent);

    // Also attach to the lead's activityHistory
    if (event.leadId) {
      const lead = this.db.leads.find((l) => l.id === event.leadId);
      if (lead) {
        if (!lead.activityHistory) {
          lead.activityHistory = [];
        }
        lead.activityHistory.unshift(newEvent);
      }
    }

    this.persistAndNotify();
    return newEvent;
  }

  // --- Settings Operations ---
  public getSettings(): WorkspaceSettings {
    return { ...this.db.settings };
  }

  public updateSettings(settings: Partial<WorkspaceSettings>): WorkspaceSettings {
    this.db.settings = {
      ...this.db.settings,
      ...settings,
    };
    this.persistAndNotify();
    return this.db.settings;
  }

  // --- Reset & Export ---
  public resetToDefaults(): void {
    this.db = {
      leads: [],
      sequences: [],
      tasks: [],
      activities: [],
      team: [],
      settings: SEEDED_SETTINGS,
    };
    this.persistAndNotify();
  }

  public exportAllData(): string {
    return JSON.stringify(this.db, null, 2);
  }
}

export const prototypeStore = new PrototypeStore();
