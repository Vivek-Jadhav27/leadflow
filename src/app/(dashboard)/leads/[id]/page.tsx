'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Edit2,
  Trash2,
  Archive,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Play,
  Pause,
  Send,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Briefcase,
  AlertCircle,
  Copy,
  Check,
  CalendarCheck,
  XCircle,
  Plus,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDate, formatDateTime } from '@/utils/date';
import { EnrichedData, ConnectionStatus, LeadOutcome, ActivityEvent, Sequence, SequenceStep } from '@/types/crm';
import { toast } from 'sonner';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const { user, isAdmin } = useAuthContext();

  const {
    leads,
    sequences,
    settings,
    team,
    tasks,
    activities,
    updateLead,
    deleteLead,
    archiveLead,
    enrichLead,
    markReply,
    advanceLeadStep,
    assignSequenceToLead,
    saveSequence,
    approveSequence,
    addActivityEvent,
  } = useCRM();

  const lead = React.useMemo(() => {
    const direct = leads.find((l) => l.id === id);
    if (direct) return direct;
    return leads.find((l) => l.activityHistory?.some((a) => a.id?.includes(id)));
  }, [leads, id]);

  // Combine stored lead activity history with global activity log
  const leadActivities = React.useMemo(() => {
    const map = new Map<string, ActivityEvent>();
    if (lead?.activityHistory && Array.isArray(lead.activityHistory)) {
      lead.activityHistory.forEach((a) => map.set(a.id, a));
    }
    activities.filter((a) => a.leadId === id || (lead && a.leadId === lead.id)).forEach((a) => map.set(a.id, a));

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [lead?.activityHistory, lead?.id, activities, id]);

  // Resolve connection note from direct field, matching sibling leads, activity history, tasks, or notes
  const connectionNoteSent = React.useMemo(() => {
    // 1. Direct field on current lead
    if (lead?.connectionNote && lead.connectionNote.trim()) {
      return lead.connectionNote.trim();
    }

    // 2. Check sibling leads in store matching same LinkedIn URL or same Name
    if (lead) {
      const norm = (u: string) => (u || '').toLowerCase().replace(/\/+$/, '').trim();
      const currentUrl = norm(lead.linkedinUrl);
      const sibling = leads.find((l) => {
        if (l.id === lead.id) return false;
        if (currentUrl && norm(l.linkedinUrl) === currentUrl) return true;
        if (
          lead.firstName &&
          lead.lastName &&
          l.firstName?.toLowerCase().trim() === lead.firstName.toLowerCase().trim() &&
          l.lastName?.toLowerCase().trim() === lead.lastName.toLowerCase().trim()
        ) {
          return true;
        }
        return false;
      });
      if (sibling?.connectionNote && sibling.connectionNote.trim()) {
        return sibling.connectionNote.trim();
      }
    }

    // 3. Check activities for this lead
    const connectAct = (activities || []).find((a) => {
      const isMatch =
        a.leadId === id ||
        (lead && a.leadId === lead.id) ||
        (lead && a.leadName?.toLowerCase() === `${lead.firstName} ${lead.lastName}`.toLowerCase());
      return (
        isMatch &&
        (a.type === 'linkedin_connect' || a.title?.toLowerCase().includes('connection')) &&
        a.description &&
        a.description.trim()
      );
    });
    if (connectAct && connectAct.description?.trim()) {
      return connectAct.description.trim();
    }

    // 4. Check tasks for connection note snippet
    const taskWithNote = (tasks || []).find((t) => {
      const isMatch =
        t.leadId === id ||
        (lead && t.leadId === lead.id) ||
        (lead && t.leadName?.toLowerCase() === `${lead.firstName} ${lead.lastName}`.toLowerCase());
      return isMatch && t.notes && (t.notes.includes('Connection sent with note:') || t.notes.includes('Connection note:'));
    });
    if (taskWithNote && taskWithNote.notes) {
      const m1 = taskWithNote.notes.match(/Connection sent with note:\s*"?([^"]+)"?/i);
      if (m1 && m1[1]) return m1[1].trim();
      const m2 = taskWithNote.notes.match(/Connection note:\s*"?([^"]+)"?/i);
      if (m2 && m2[1]) return m2[1].trim();
    }

    // 5. Check lead notes
    if (lead?.notes) {
      const n = lead.notes;
      const m1 = n.match(/connection sent with note:\s*"?([^"]+)"?/i);
      if (m1 && m1[1]) return m1[1].trim();
      const m2 = n.match(/connection note:\s*"?([^"]+)"?/i);
      if (m2 && m2[1]) return m2[1].trim();
      if (
        !n.startsWith('Added to') &&
        !n.startsWith('Imported via') &&
        !n.startsWith('Captured from') &&
        n.length > 10
      ) {
        return n.trim();
      }
    }

    return null;
  }, [lead, leads, activities, tasks, id]);

  const sequence = React.useMemo(() => {
    if (lead?.sequenceId) {
      const found = sequences.find((s) => s.id === lead.sequenceId);
      if (found) {
        // Ensure Step 1 has actual connection note if available
        if (connectionNoteSent && found.steps?.[0]) {
          const first = found.steps[0];
          if (!first.messageTemplate || first.messageTemplate.includes('Connection request sent')) {
            found.steps[0] = { ...first, messageTemplate: connectionNoteSent };
          }
        }
        return found;
      }
    }
    const customFound = sequences.find(
      (s) => s.id === `seq_custom_${lead?.id}` || (lead && s.name?.includes(`${lead.firstName} ${lead.lastName}`))
    );
    if (customFound) {
      if (connectionNoteSent && customFound.steps?.[0]) {
        const first = customFound.steps[0];
        if (!first.messageTemplate || first.messageTemplate.includes('Connection request sent')) {
          customFound.steps[0] = { ...first, messageTemplate: connectionNoteSent };
        }
      }
      return customFound;
    }

    // If lead is awaiting sequence approval or has a custom sequence assigned, construct from customSteps or fallback
    if (lead && (lead.outreachStatus === 'pending_sequence_approval' || (lead.sequenceId && lead.sequenceMode === 'custom'))) {
      const seqId = lead.sequenceId || `seq_custom_${lead.id}`;

      let stepsToUse: SequenceStep[] = [];
      if (lead.customSteps && Array.isArray(lead.customSteps) && lead.customSteps.length > 0) {
        stepsToUse = lead.customSteps.map((s: any) => {
          if (s.stepNumber === 1 || s.actionType === 'connection_request') {
            return {
              id: `step_${seqId}_1`,
              stepNumber: 1,
              actionType: 'connection_request' as const,
              title: s.title || 'Connection Request',
              delayDays: 0,
              messageTemplate: connectionNoteSent || s.messageTemplate || 'Connection request sent on LinkedIn',
              enabled: true,
            };
          }
          return {
            id: `step_${seqId}_${s.stepNumber}`,
            stepNumber: s.stepNumber,
            actionType: 'send_message' as const,
            title: s.title || `Follow-up ${s.stepNumber - 1}`,
            delayDays: s.delayDays || (s.stepNumber === 2 ? 3 : 7),
            messageTemplate: s.messageTemplate || '',
            enabled: true,
          };
        });
      } else {
        stepsToUse = [
          {
            id: `step_${seqId}_1`,
            stepNumber: 1,
            actionType: 'connection_request' as const,
            title: 'Connection Request',
            delayDays: 0,
            messageTemplate: connectionNoteSent || 'Connection request sent on LinkedIn',
            enabled: true,
          },
          {
            id: `step_${seqId}_2`,
            stepNumber: 2,
            actionType: 'send_message' as const,
            title: 'First Follow-up',
            delayDays: 3,
            messageTemplate: `Hi ${lead.firstName}, thanks for connecting! Following up to see if you had a moment to review how we help teams at ${lead.company} optimize outbound sales outreach.`,
            enabled: true,
          },
          {
            id: `step_${seqId}_3`,
            stepNumber: 3,
            actionType: 'send_message' as const,
            title: 'Second Follow-up',
            delayDays: 7,
            messageTemplate: `Hi ${lead.firstName}, following up on my previous message. Wanted to see if you had 5 minutes this week for a brief conversation?`,
            enabled: true,
          },
        ];
      }

      return {
        id: seqId,
        name: lead.sequenceName || `Custom Cadence: ${lead.firstName} ${lead.lastName}`,
        channel: 'linkedin' as const,
        description: `Custom outreach cadence for ${lead.firstName} ${lead.lastName} at ${lead.company}`,
        approvalStatus: 'pending' as const,
        status: 'pending_approval' as const,
        workspaceId: lead.workspaceId || null,
        createdBy: lead.assignedToName || 'Outbound SDR',
        steps: stepsToUse,
      };
    }
    return null;
  }, [lead, sequences, connectionNoteSent]);

  // Sequence approval and active status resolution
  const isSeqApproved = Boolean(sequence && (sequence.approvalStatus === 'approved' || sequence.status === 'active'));
  const effectiveOutreachStatus = (isSeqApproved && lead?.outreachStatus === 'pending_sequence_approval')
    ? 'in_sequence'
    : (lead?.outreachStatus || 'unassigned');

  // Auto-heal: If cadence is already approved by Admin, transition lead to in_sequence immediately
  React.useEffect(() => {
    if (
      lead &&
      sequence &&
      (sequence.approvalStatus === 'approved' || sequence.status === 'active') &&
      lead.outreachStatus === 'pending_sequence_approval'
    ) {
      const step2 = sequence.steps?.[1] || sequence.steps?.find((s) => s.stepNumber === 2);
      updateLead(lead.id, {
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        outreachStatus: 'in_sequence',
        currentStepNumber: lead.currentStepNumber > 1 ? lead.currentStepNumber : 2,
        nextActionTitle: step2?.title || 'Step 2: Follow-up 1',
        nextFollowUpDate: lead.nextFollowUpDate || new Date().toISOString().split('T')[0],
      });
    }
  }, [lead?.id, lead?.outreachStatus, sequence?.id, sequence?.approvalStatus, sequence?.status, updateLead]);

  // Handle Admin changing sequence start date
  const handleRescheduleStartDate = (newDate: string) => {
    if (!lead || !newDate || newDate === lead.nextFollowUpDate) return;
    const oldDate = lead.nextFollowUpDate || 'Immediate';

    const updatedActivity: ActivityEvent = {
      id: `act_${Date.now()}_resched`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      type: 'sequence_rescheduled',
      title: 'Cadence Start Date Changed',
      description: `Admin updated cadence start date from ${oldDate} to ${newDate}. All subsequent cadence steps shifted accordingly.`,
      actorName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'Admin'),
      timestamp: new Date().toISOString(),
    };

    const newActivityHistory = [updatedActivity, ...(lead.activityHistory || [])];

    // Update lead in store and Firestore
    updateLead(lead.id, {
      nextFollowUpDate: newDate,
      sequenceStartDate: newDate,
      activityHistory: newActivityHistory,
    });

    // Also register in global activity log
    addActivityEvent(updatedActivity);

    toast.success(`Cadence schedule updated to start on ${newDate}`);
  };

  // SDR team members list strictly excluding admin/owner accounts
  const availableTeamMembers = React.useMemo(() => {
    const list: typeof team = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    const isMemberAdmin = (roleStr?: string, nameStr?: string) => {
      const r = (roleStr || '').toLowerCase();
      const n = (nameStr || '').toLowerCase();
      return r.includes('admin') || r.includes('owner') || n.includes('admin') || n.includes('owner');
    };

    team.forEach((m) => {
      if (!isMemberAdmin(m.role, m.name) && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        if (m.email) seenEmails.add(m.email.toLowerCase().trim());
        list.push(m);
      }
    });

    if (user && user.role !== 'admin') {
      const uEmail = (user.email || '').toLowerCase().trim();
      const existingMember = list.find((m) => m.id === user.uid || (uEmail && m.email?.toLowerCase().trim() === uEmail));
      if (existingMember) {
        if (user.displayName && (!existingMember.name || existingMember.name.includes('@') || existingMember.name === uEmail.split('@')[0])) {
          existingMember.name = user.displayName;
        }
      } else if (!seenIds.has(user.uid)) {
        seenIds.add(user.uid);
        if (uEmail) seenEmails.add(uEmail);
        list.push({
          id: user.uid,
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Current SDR'),
          email: user.email || '',
          role: user.role === 'ae' ? 'Account Executive' : 'Outbound SDR',
          initials: (user.displayName || user.email || 'U').slice(0, 2).toUpperCase(),
          status: 'active',
          assignedLeadsCount: 0,
          activeSequencesCount: 0,
          completedTasksWeek: 0,
        });
      }
    }

    leads.forEach((l) => {
      const sdrId = l.assignedToId || l.capturedByUid;
      const sdrEmail = (l.assignedToEmail || l.capturedBy || '').toLowerCase().trim();
      if (sdrEmail && seenEmails.has(sdrEmail)) return;
      if (sdrId && seenIds.has(sdrId)) return;

      if (user && (user.uid === sdrId || user.email?.toLowerCase().trim() === sdrEmail) && user.role === 'admin') {
        return;
      }

      if (sdrId || sdrEmail) {
        const idToUse = sdrId || `rep_${sdrEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        seenIds.add(idToUse);
        if (sdrEmail) seenEmails.add(sdrEmail);

        const realName = (user && sdrEmail === user.email?.toLowerCase().trim())
          ? (user.displayName || user.email?.split('@')[0])
          : (l.assignedToName || (sdrEmail ? sdrEmail.split('@')[0] : 'Outbound SDR'));

        list.push({
          id: idToUse,
          name: realName,
          email: sdrEmail,
          role: 'Outbound SDR',
          initials: (realName || 'S').slice(0, 2).toUpperCase(),
          status: 'active',
          assignedLeadsCount: 0,
          activeSequencesCount: 0,
          completedTasksWeek: 0,
        });
      }
    });

    return list;
  }, [team, leads, user]);

  const resolvedMember =
    (lead?.assignedToId ? availableTeamMembers.find((m) => m.id === lead.assignedToId) : null) ||
    (lead?.assignedToEmail ? availableTeamMembers.find((m) => m.email?.toLowerCase().trim() === lead.assignedToEmail?.toLowerCase().trim()) : null) ||
    (lead?.capturedBy ? availableTeamMembers.find((m) => m.email?.toLowerCase().trim() === lead.capturedBy?.toLowerCase().trim()) : null) ||
    (lead?.capturedByUid ? availableTeamMembers.find((m) => m.id === lead.capturedByUid) : null);

  const effectiveAssignedId = lead?.assignedToId || resolvedMember?.id || '';
  const effectiveAssignedName = resolvedMember?.name || lead?.assignedToName || (resolvedMember?.email ? resolvedMember.email.split('@')[0] : (lead?.assignedToEmail ? lead.assignedToEmail.split('@')[0] : 'Unassigned'));

  // Compute scheduled calendar dates for each step in the sequence
  const stepScheduleMap = React.useMemo(() => {
    if (!sequence || !sequence.steps || !lead) {
      return new Map<number, { dateStr: string; formatted: string; isPast: boolean; isToday: boolean }>();
    }

    const map = new Map<number, { dateStr: string; formatted: string; isPast: boolean; isToday: boolean }>();
    const todayStr = new Date().toISOString().split('T')[0];

    const currentStep = lead.currentStepNumber || 1;
    const currentStepDueDate = lead.nextFollowUpDate || todayStr;

    // Helper to add days (respecting settings.skipWeekends if enabled)
    const addDays = (baseDateStr: string, days: number): string => {
      if (!days || days <= 0) return baseDateStr;
      const d = new Date(baseDateStr + 'T00:00:00');
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        if (settings?.skipWeekends) {
          const day = d.getDay();
          if (day === 0 || day === 6) continue;
        }
        added++;
      }
      return d.toISOString().split('T')[0];
    };

    // Calculate dates backwards for steps before currentStep
    let rollingDate = currentStepDueDate;
    for (let s = currentStep; s >= 1; s--) {
      const stepObj = sequence.steps.find((st) => st.stepNumber === s);
      const isPast = s < currentStep;
      const isToday = rollingDate === todayStr;

      const d = new Date(rollingDate + 'T00:00:00');
      const formatted = isNaN(d.getTime())
        ? rollingDate
        : d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

      map.set(s, {
        dateStr: rollingDate,
        formatted,
        isPast,
        isToday,
      });

      if (s > 1) {
        const delay = stepObj?.delayDays || 1;
        const prevD = new Date(rollingDate + 'T00:00:00');
        prevD.setDate(prevD.getDate() - delay);
        rollingDate = prevD.toISOString().split('T')[0];
      }
    }

    // Calculate dates forwards for steps after currentStep
    rollingDate = currentStepDueDate;
    const sortedSteps = [...sequence.steps].sort((a, b) => a.stepNumber - b.stepNumber);
    for (const stepObj of sortedSteps) {
      if (stepObj.stepNumber <= currentStep) continue;
      const delay = stepObj.delayDays || 1;
      rollingDate = addDays(rollingDate, delay);

      const d = new Date(rollingDate + 'T00:00:00');
      const formatted = isNaN(d.getTime())
        ? rollingDate
        : d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

      map.set(stepObj.stepNumber, {
        dateStr: rollingDate,
        formatted,
        isPast: false,
        isToday: rollingDate === todayStr,
      });
    }

    return map;
  }, [sequence, lead, settings]);

  // Drawer / Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEnrichOpen, setIsEnrichOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedSeqToAssign, setSelectedSeqToAssign] = useState<string>('');

  // Custom Sequence Builder state
  const [isCreateSeqOpen, setIsCreateSeqOpen] = useState(false);
  const [customSeqName, setCustomSeqName] = useState('');
  const [step2Delay, setStep2Delay] = useState(3);
  const [step2Message, setStep2Message] = useState('');
  const [step3Delay, setStep3Delay] = useState(7);
  const [step3Message, setStep3Message] = useState('');
  const [isSubmittingCustomSeq, setIsSubmittingCustomSeq] = useState(false);

  const openCustomSeqModal = () => {
    if (lead) {
      setCustomSeqName(`Custom Cadence: ${lead.firstName} ${lead.lastName}`);
      setStep2Delay(3);
      setStep2Message(
        `Hi ${lead.firstName}, thanks for connecting! Following up to see if you had a moment to review how we help teams at ${lead.company} optimize outbound sales outreach.`
      );
      setStep3Delay(7);
      setStep3Message(
        `Hi ${lead.firstName}, following up on my previous message. Wanted to see if you had 5 minutes this week for a brief conversation?`
      );
    }
    setIsCreateSeqOpen(true);
  };

  const handleCreateCustomSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setIsSubmittingCustomSeq(true);

    try {
      const seqId = `seq_custom_${lead.id}_${Date.now()}`;
      const seqSteps: SequenceStep[] = [
        {
          id: `step_${seqId}_1`,
          stepNumber: 1,
          actionType: 'connection_request',
          title: 'Connection Request',
          delayDays: 0,
          messageTemplate: connectionNoteSent || 'Connection request sent manually on LinkedIn',
          enabled: true,
        },
        {
          id: `step_${seqId}_2`,
          stepNumber: 2,
          actionType: 'send_message',
          title: 'First Follow-up',
          delayDays: Number(step2Delay) || 3,
          messageTemplate: step2Message.trim(),
          enabled: true,
        },
      ];

      if (step3Message.trim()) {
        seqSteps.push({
          id: `step_${seqId}_3`,
          stepNumber: 3,
          actionType: 'send_message',
          title: 'Second Follow-up',
          delayDays: Number(step3Delay) || 7,
          messageTemplate: step3Message.trim(),
          enabled: true,
        });
      }

      const newSeq: Sequence = {
        id: seqId,
        name: customSeqName.trim() || `Custom Cadence: ${lead.firstName} ${lead.lastName}`,
        channel: 'linkedin',
        description: `Custom outreach cadence created by ${user?.email || 'SDR'} for ${lead.firstName} ${lead.lastName} at ${lead.company}.`,
        steps: seqSteps,
        status: 'pending_approval',
        approvalStatus: 'pending',
        workspaceId: lead.workspaceId || null,
        createdBy: user?.email || 'Outbound SDR',
        createdByUid: user?.uid || null,
        createdByRole: isAdmin ? 'admin' : 'sdr',
        targetRole: 'sdr',
        isCustom: true,
        targetLeadId: lead.id,
        targetLeadName: `${lead.firstName} ${lead.lastName}`,
        targetLeadCompany: lead.company,
        targetLeadLinkedin: lead.linkedinUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveSequence(newSeq);

      updateLead(lead.id, {
        sequenceId: newSeq.id,
        sequenceName: newSeq.name,
        currentStepNumber: 2,
        totalSteps: seqSteps.length,
        outreachStatus: 'pending_sequence_approval',
        nextActionTitle: 'Awaiting Admin Approval',
        sequenceMode: 'custom',
        customSteps: seqSteps,
        connectionNote: connectionNoteSent || lead.connectionNote || null,
      });

      addActivityEvent({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        type: 'sequence_assigned',
        title: 'Custom Cadence Submitted for Admin Approval',
        description: `Bespoke ${seqSteps.length}-step sequence "${newSeq.name}" submitted for Admin approval by ${user?.email || 'SDR'}.`,
        actorName: user?.displayName || user?.email || 'Outbound SDR',
        timestamp: new Date().toISOString(),
      });

      setIsCreateSeqOpen(false);
      toast.success(`✓ Sequence "${newSeq.name}" submitted for Admin approval!`);
    } catch (err: any) {
      toast.error('Failed to submit sequence: ' + err?.message);
    } finally {
      setIsSubmittingCustomSeq(false);
    }
  };

  // Enrichment fields
  const [enrichPhone, setEnrichPhone] = useState(lead?.enrichedData?.phone || lead?.phone || '');
  const [enrichSize, setEnrichSize] = useState(lead?.enrichedData?.companySize || '100-250 employees');
  const [enrichRev, setEnrichRev] = useState(lead?.enrichedData?.annualRevenue || '$25M - $50M');
  const [enrichTech, setEnrichTech] = useState(lead?.enrichedData?.techStack?.join(', ') || 'HubSpot, React, AWS, Postgres');
  const [enrichNotes, setEnrichNotes] = useState(lead?.enrichedData?.enrichmentNotes || 'Verified corporate contact. High fit for Q4 expansion.');

  // Access Control: Individual rep (SDR or AE) can view ONLY leads added by them or assigned to them
  const userEmailNorm = (user?.email || '').toLowerCase().trim();
  const leadAssignedEmail = (lead?.assignedToEmail || '').toLowerCase().trim();
  const leadCapturedEmail = (lead?.capturedBy || '').toLowerCase().trim();

  const isAssignedOrCreator =
    (user?.uid && (lead?.assignedToId === user.uid || lead?.capturedByUid === user.uid)) ||
    (userEmailNorm && (leadAssignedEmail === userEmailNorm || leadCapturedEmail === userEmailNorm));

  const isUnauthorized = !isAdmin && user && lead && !isAssignedOrCreator;

  if (!lead || isUnauthorized) {
    return (
      <div className="py-16 text-center space-y-3">
        <h3 className="text-base font-semibold text-[#33475b]">
          {isUnauthorized ? 'Access Restricted' : 'Lead Not Found'}
        </h3>
        <p className="text-xs text-slate-500">
          {isUnauthorized
            ? 'This lead is not assigned to you or created by you. Individual representatives can only access leads they added or were assigned by an administrator.'
            : 'The lead may have been deleted or is inaccessible.'}
        </p>
        <Link href={ROUTES.LEADS}>
          <Button variant="outline" size="sm" className="border-[#cbd6e2] text-[#33475b]">
            Back to Assigned Leads
          </Button>
        </Link>
      </div>
    );
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSaveEnrichment = (e: React.FormEvent) => {
    e.preventDefault();
    const data: EnrichedData = {
      phoneVerified: true,
      phone: enrichPhone.trim(),
      companySize: enrichSize.trim(),
      annualRevenue: enrichRev.trim(),
      techStack: enrichTech.split(',').map((s) => s.trim()).filter(Boolean),
      enrichmentNotes: enrichNotes.trim(),
    };
    enrichLead(lead.id, data);
    setIsEnrichOpen(false);
  };

  const handleRecordReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    markReply(lead.id, replyText.trim(), 'Interested');
    setReplyText('');
    setIsReplyOpen(false);
  };

  const handleSetConnectionStatus = (status: ConnectionStatus) => {
    if (!lead) return;

    let title = `LinkedIn Connection: ${status}`;
    let desc = `Connection status updated to ${status}.`;

    if (status === 'connected') {
      title = 'LinkedIn Connection Accepted';
      desc = `SDR manually confirmed connection acceptance for ${lead.firstName} ${lead.lastName}. Decision 2 Gate cleared.`;
    } else if (status === 'pending' || status === 'request_sent') {
      title = 'LinkedIn Connection Request Sent';
      desc = `Connection request sent. Awaiting acceptance from prospect.`;
    } else if (status === 'declined') {
      title = 'LinkedIn Connection Declined';
      desc = `Prospect declined connection request.`;
    } else if (status === 'not_connected') {
      title = 'LinkedIn Connection Unknown';
      desc = `Connection status set to not connected.`;
    }

    const newAct: ActivityEvent = {
      id: `act_${Date.now()}_conn`,
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      type: status === 'connected' ? 'connection_accepted' : 'status_changed',
      title,
      description: desc,
      actorName: user?.displayName || (user?.email ? user.email.split('@')[0] : 'SDR'),
      timestamp: new Date().toISOString(),
    };

    const newActivityHistory = [newAct, ...(lead.activityHistory || [])];

    updateLead(lead.id, {
      connectionStatus: status,
      activityHistory: newActivityHistory,
    });

    addActivityEvent(newAct);

    toast.success(
      status === 'connected'
        ? `Marked as Accepted! Lead is now Connected.`
        : `LinkedIn connection updated to: ${status}`
    );
  };

  const handleAdvanceStep = () => {
    if (!lead) return;
    // Decision 2 gate check: If on Step 2 (Wait for Connection Acceptance) and connection not accepted yet
    if (lead.currentStepNumber === 2 && lead.connectionStatus !== 'connected') {
      toast.warning('Connection has not been accepted yet. Please confirm connection acceptance before sending value proposition messages.');
      return;
    }
    advanceLeadStep(lead.id);
  };

  const handleSetOutcome = (outcome: LeadOutcome) => {
    let outreachStatus = lead.outreachStatus;
    let disposition = lead.disposition;

    if (outcome === 'Meeting Booked') {
      outreachStatus = 'completed';
      disposition = 'meeting_booked';
    } else if (outcome === 'Converted') {
      outreachStatus = 'completed';
    } else if (outcome === 'Not Interested' || outcome === 'Lost / Unresponsive') {
      outreachStatus = 'stopped';
    }

    updateLead(lead.id, {
      outcome,
      outreachStatus,
      disposition,
    });
    toast.success(`Lead outcome set to: ${outcome}`);
  };

  const isArchived = lead.disposition === 'archived';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={ROUTES.LEADS}
            className="flex items-center gap-1.5 text-slate-500 hover:text-[#ff7a59] font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Contacts &amp; Leads</span>
          </Link>
          <span className="text-[#cbd6e2]">/</span>
          <span className="font-bold text-[#33475b]">
            {lead.firstName} {lead.lastName}
          </span>
          <span className="text-[#cbd6e2]">·</span>
          <span className="text-slate-500">{lead.company}</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Action: Record Reply */}
          {lead.outreachStatus !== 'replied' && lead.outcome !== 'Meeting Booked' && (
            <Button
              size="sm"
              onClick={() => setIsReplyOpen(true)}
              className="h-8 text-xs gap-1.5 bg-[#0091ae] hover:bg-[#007a93] text-white font-semibold shadow-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Record Reply</span>
            </Button>
          )}

          {/* Quick Action: Book Meeting */}
          {lead.outcome !== 'Meeting Booked' && (
            <Button
              size="sm"
              onClick={() => handleSetOutcome('Meeting Booked')}
              className="h-8 text-xs gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold shadow-xs"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Book Meeting</span>
            </Button>
          )}

          {/* Quick Action: Advance Step */}
          {lead.sequenceId && lead.outreachStatus !== 'completed' && lead.outreachStatus !== 'replied' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdvanceStep}
              className="h-8 text-xs gap-1.5 border-[#0091ae] text-[#0091ae] hover:bg-[#f0f9fb] font-medium"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Advance Cadence (Step {lead.currentStepNumber + 1})</span>
            </Button>
          )}

          {/* Enrich Lead */}
          {/* <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEnrichOpen(true)}
            className="h-8 text-xs gap-1.5 border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{lead.disposition === 'enriched' ? 'Edit Intelligence' : 'Enrich Lead'}</span>
          </Button> */}

          {/* Edit Details */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="h-8 text-xs gap-1.5 border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
          >
            <Edit2 className="h-3.5 w-3.5 text-slate-400" />
            <span>Edit</span>
          </Button>

          {/* Archive / Restore */}
          {/* <Button
            size="sm"
            variant="outline"
            onClick={() => archiveLead(lead.id, !isArchived)}
            className="h-8 text-xs gap-1.5 border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
          >
            <Archive className="h-3.5 w-3.5 text-slate-400" />
            <span>{isArchived ? 'Restore' : 'Archive'}</span>
          </Button> */}

          {/* Delete */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            className="h-8 text-xs text-rose-600 hover:bg-rose-50 border-rose-200 p-2"
            title="Delete Lead"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main HubSpot Contact Hero Banner */}
      <div className="rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#2d3e50] text-white font-bold text-lg shadow-xs">
              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#33475b]">
                  {lead.firstName} {lead.lastName}
                </h1>

                {/* LinkedIn Badge */}
                <span className="inline-flex items-center gap-1 rounded bg-[#e8f3f8] px-2.5 py-0.5 text-xs font-semibold text-[#0077b5] border border-[#b2d5e5]">
                  <Linkedin className="h-3 w-3" />
                  <span>LinkedIn Outreach</span>
                </span>

                {/* Connection Gate Status */}
                <span
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-semibold border ${
                    lead.connectionStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : lead.connectionStatus === 'pending' || lead.connectionStatus === 'request_sent'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : lead.connectionStatus === 'declined'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {lead.connectionStatus === 'connected' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : lead.connectionStatus === 'pending' || lead.connectionStatus === 'request_sent' ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span>
                    Connection: {lead.connectionStatus === 'connected' ? 'Connected' : lead.connectionStatus === 'request_sent' ? 'Request Sent' : lead.connectionStatus === 'pending' ? 'Pending' : lead.connectionStatus}
                  </span>
                </span>

                {/* Outcome Badge */}
                {lead.outcome && lead.outcome !== '—' && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#fdf2e9] px-2.5 py-0.5 text-xs font-bold text-[#b34000] border border-[#fcd5b5]">
                    {lead.outcome}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 flex items-center gap-2">
                <span className="font-semibold text-[#33475b]">{lead.jobTitle}</span>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-700">{lead.company}</span>
              </p>
            </div>
          </div>

          {/* Contact Details Quick Strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs bg-[#f5f8fa] p-3 rounded-lg border border-[#dfe3eb]">
            {lead.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-[#33475b]">{lead.phone}</span>
                <button
                  onClick={() => handleCopy(lead.phone || '', 'Phone')}
                  className="text-slate-400 hover:text-slate-600"
                  title="Copy Phone"
                >
                  {copiedText === 'Phone' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}

            {lead.linkedinUrl && (
              <div className="flex items-center gap-1.5 border-l border-[#cbd6e2] pl-3">
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#0077b5] hover:underline flex items-center gap-1"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  <span>Open LinkedIn Profile</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-1.5 border-l border-[#cbd6e2] pl-3">
              <span className="text-slate-500 text-[11px]">SDR Owner:</span>
              <span className="font-bold text-[#33475b]">{effectiveAssignedName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Tree Interactive Journey Status Bar */}
      {/* <div className="rounded-lg border border-[#b2d5e5] bg-[#f0f9fb] p-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#d0e5ef] mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0091ae] text-white font-bold text-[10px]">
              <Check className="h-3 w-3" />
            </span>
            <span className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
              Interactive Decision Tree Progress
            </span>
          </div>
          <Link
            href={ROUTES.WALKTHROUGH}
            className="text-[#0091ae] hover:underline font-semibold flex items-center gap-1 text-[11px]"
          >
            <span>View Canvas</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="p-2.5 rounded bg-white border border-[#dfe3eb]">
            <p className="text-[10px] font-bold uppercase text-slate-400">Decision 1</p>
            <p className="font-bold text-[#33475b] text-[11px] mt-0.5">Duplicate Check</p>
            <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
              No Match Found
            </span>
          </div>

          <div className="p-2.5 rounded bg-white border border-[#dfe3eb]">
            <p className="text-[10px] font-bold uppercase text-slate-400">Decision 2</p>
            <p className="font-bold text-[#33475b] text-[11px] mt-0.5">Connection Gate</p>
            <span
              className={`inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                lead.connectionStatus === 'connected'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : lead.connectionStatus === 'pending'
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {lead.connectionStatus === 'connected' ? 'Accepted' : lead.connectionStatus === 'pending' ? 'Pending' : 'Blocked'}
            </span>
          </div>

          <div className="p-2.5 rounded bg-white border border-[#dfe3eb]">
            <p className="text-[10px] font-bold uppercase text-slate-400">Decision 3</p>
            <p className="font-bold text-[#33475b] text-[11px] mt-0.5">Approved Cadence</p>
            <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
              Active ({sequence?.name || 'Standard'})
            </span>
          </div>

          <div className="p-2.5 rounded bg-white border border-[#dfe3eb]">
            <p className="text-[10px] font-bold uppercase text-slate-400">Outreach Execution</p>
            <p className="font-bold text-[#33475b] text-[11px] mt-0.5">Daily LinkedIn Task</p>
            <span
              className={`inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                lead.outreachStatus === 'replied' || lead.outreachStatus === 'completed'
                  ? 'text-slate-600 bg-slate-50 border-slate-200'
                  : 'text-[#0091ae] bg-[#e6f4f8] border-[#b2d5e5]'
              }`}
            >
              {lead.outreachStatus === 'replied' ? 'Reply Recorded' : lead.outreachStatus === 'completed' ? 'Cadence Complete' : `Step ${lead.currentStepNumber} Active`}
            </span>
          </div>

          <div className="p-2.5 rounded bg-white border border-[#dfe3eb]">
            <p className="text-[10px] font-bold uppercase text-slate-400">Outcome &amp; Reporting</p>
            <p className="font-bold text-[#33475b] text-[11px] mt-0.5">Sales Outcome</p>
            <span
              className={`inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                lead.outcome === 'Meeting Booked'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : lead.outcome === 'Interested'
                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                  : lead.outcome === 'Not Interested' || lead.outcome === 'Lost / Unresponsive'
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-slate-500 bg-slate-50 border-slate-200'
              }`}
            >
              {lead.outcome || 'Pending'}
            </span>
          </div>
        </div>
      </div> */}

      {/* Main 3-Column HubSpot Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Left Column (1 span): Gate Controls & Details */}
        <div className="space-y-4">
          {/* Decision 2: LinkedIn Connection Status Switcher */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
                LinkedIn Connection Gate
              </h3>
              <span className="text-[10px] text-slate-400">Decision 2</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Outreach cadences require verified connection acceptance. Update status as prospect responds:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={lead.connectionStatus === 'connected' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('connected')}
                className={`h-8 text-xs font-semibold cursor-pointer ${
                  lead.connectionStatus === 'connected'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs ring-1 ring-emerald-500'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                <span>Accepted</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'pending' || lead.connectionStatus === 'request_sent' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('request_sent')}
                className={`h-8 text-xs font-semibold cursor-pointer ${
                  lead.connectionStatus === 'pending' || lead.connectionStatus === 'request_sent'
                    ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs ring-1 ring-amber-500'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span>Pending (Sent)</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'declined' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('declined')}
                className={`h-8 text-xs font-semibold cursor-pointer ${
                  lead.connectionStatus === 'declined'
                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs ring-1 ring-rose-500'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                <span>Declined</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'not_connected' || lead.connectionStatus === 'not_started' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('not_connected')}
                className={`h-8 text-xs font-semibold cursor-pointer ${
                  lead.connectionStatus === 'not_connected' || lead.connectionStatus === 'not_started'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                <span>Unknown</span>
              </Button>
            </div>
          </div>

          {/* Outcome Quick Switcher */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
                Lead Outcome &amp; Disposition
              </h3>
              <span className="text-[10px] text-slate-400">Terminal State</span>
            </div>

            <p className="text-[11px] text-slate-500">
              Update the sales outcome per the interactive walkthrough branches:
            </p>

            <div className="space-y-1.5">
              {[
                { key: 'Meeting Booked' as LeadOutcome, label: 'Meeting Booked (Success)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' },
                { key: 'Interested' as LeadOutcome, label: 'Interested (Qualifying)', color: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100' },
                { key: 'Converted' as LeadOutcome, label: 'Converted to Customer', color: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100' },
                { key: 'Not Interested' as LeadOutcome, label: 'Not Interested (Halt)', color: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100' },
                { key: 'Lost / Unresponsive' as LeadOutcome, label: 'Lost / Unresponsive', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleSetOutcome(item.key)}
                  className={`w-full text-left p-2 rounded border transition-colors flex items-center justify-between text-xs font-semibold ${
                    lead.outcome === item.key ? 'ring-2 ring-[#ff7a59] ' + item.color : item.color
                  }`}
                >
                  <span>{item.label}</span>
                  {lead.outcome === item.key && <Check className="h-3.5 w-3.5 text-[#ff7a59]" />}
                </button>
              ))}
            </div>
          </div>

          {/* SDR & Account Info (Visible ONLY to Admin) */}
          {isAdmin && (
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
                <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
                  Account &amp; Assignment
                </h3>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                  Admin Manageable
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Assigned Representative (SDR)
                  </span>
                  <select
                    value={effectiveAssignedId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (!newId) {
                        updateLead(lead.id, {
                          assignedToId: null,
                          assignedToName: null,
                          assignedToEmail: null,
                        });
                        toast.success(`Unassigned ${lead.firstName} ${lead.lastName}`);
                      } else {
                        const member = availableTeamMembers.find((m) => m.id === newId);
                        if (member) {
                          updateLead(lead.id, {
                            assignedToId: member.id,
                            assignedToName: member.name,
                            assignedToEmail: member.email,
                          });
                          toast.success(`Shifted ${lead.firstName} to ${member.name}`);
                        }
                      }
                    }}
                    className="w-full rounded-md border border-[#cbd8eb] px-2.5 py-1.5 text-xs bg-white text-[#33475b] font-medium focus:border-[#ff7a59] focus:outline-none"
                  >
                    <option value="">Unassigned (Click to Assign)</option>
                    {effectiveAssignedId && !availableTeamMembers.some((m) => m.id === effectiveAssignedId) && (
                      <option key={effectiveAssignedId} value={effectiveAssignedId}>
                        {effectiveAssignedName} (SDR)
                      </option>
                    )}
                    {availableTeamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role || 'SDR'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[#dfe3eb]">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Captured Date</span>
                  <p className="font-medium text-[#33475b] mt-0.5">{formatDate(lead.createdAt)}</p>
                </div>

                {lead.notes && (
                  <div className="pt-2 border-t border-[#dfe3eb]">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Internal SDR Notes</span>
                    <p className="text-[11px] text-slate-700 bg-[#f5f8fa] p-2.5 rounded border border-[#dfe3eb] mt-1 whitespace-pre-wrap">
                      {lead.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center Column (2 spans): Sequence Cadence & Manual Message Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active LinkedIn Cadence Progression */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#dfe3eb] bg-[#f5f8fa]">
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-[#0077b5]" />
                <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
                  LinkedIn Outreach Sequence Progression
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {sequence ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={ROUTES.SEQUENCE_DETAIL(sequence.id)}
                      className="text-[#0091ae] hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <span>{sequence.name}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Unenroll ${lead.firstName} from ${sequence.name}?`)) {
                          assignSequenceToLead(lead.id, null);
                        }
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer ml-1"
                    >
                      Unenroll
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#7c98b6] italic">Unassigned</span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Outreach Status</p>
                  <p className="font-bold text-[#33475b] capitalize mt-0.5">
                    {effectiveOutreachStatus.replace('_', ' ')}
                  </p>
                </div>

                <div className="p-2.5 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Connection State</p>
                  <p className="font-bold text-[#33475b] capitalize mt-0.5">
                    {lead.connectionStatus}
                  </p>
                </div>

                <div className="p-2.5 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Next Scheduled Task</p>
                  <p className="font-bold text-[#33475b] truncate mt-0.5">
                    {lead.nextActionTitle || (lead.outreachStatus === 'replied' ? 'Review Inbound Reply' : 'None')}
                  </p>
                </div>

                <div className="p-2.5 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Due / Start Date</p>
                    {isAdmin && (
                      <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                        Admin Manageable
                      </span>
                    )}
                  </div>
                  {isAdmin ? (
                    <input
                      type="date"
                      value={lead.nextFollowUpDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleRescheduleStartDate(e.target.value)}
                      className="mt-1 w-full text-xs font-bold text-[#33475b] bg-white border border-[#cbd8eb] rounded px-2 py-1 focus:outline-none focus:border-[#ff7a59] cursor-pointer shadow-2xs"
                      title="Admin: Click to change cadence schedule start date"
                    />
                  ) : (
                    <p className="font-bold text-[#33475b] mt-0.5">
                      {lead.nextFollowUpDate || 'None'}
                    </p>
                  )}
                </div>
              </div>

              {/* Connection Note Display */}
              {connectionNoteSent && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                      <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
                      Connection Note Sent on LinkedIn
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      ✓ Sent Manually
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 italic bg-white/80 p-2.5 rounded border border-orange-100">
                    &ldquo;{connectionNoteSent}&rdquo;
                  </p>
                </div>
              )}



              {/* Pending Sequence Approval Banner */}
              {(!isSeqApproved && (lead.outreachStatus === 'pending_sequence_approval' || (sequence && sequence.approvalStatus === 'pending'))) && (
                <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-700" />
                      <h4 className="font-bold text-xs text-blue-900">Custom Cadence Awaiting Admin Approval</h4>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                      Approval Pending
                    </span>
                  </div>
                  <p className="text-xs text-blue-800">
                    This lead was assigned a customized follow-up cadence. Steps are paused until an administrator reviews and approves the sequence.
                  </p>
                  {isAdmin && sequence && (
                    <Button
                      size="sm"
                      onClick={() => {
                        approveSequence(sequence.id);
                        updateLead(lead.id, {
                          outreachStatus: 'in_sequence',
                          nextActionTitle: sequence.steps?.[1]?.title || 'Step 2: Follow-up 1',
                        });
                        toast.success(`✓ Sequence "${sequence.name}" approved! Follow-up tasks are now active.`);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 cursor-pointer gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approve & Activate Cadence</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Step Sequence Timeline or Empty Enrollment Card */}
              {(!sequence || lead.outreachStatus === 'needs_sequence') ? (
                <div className="p-6 rounded-lg border border-dashed border-[#cbd6e2] bg-[#f8fafc] text-center space-y-4">
                  <div className="h-10 w-10 rounded-full bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center mx-auto">
                    <Linkedin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2d3e50] text-sm">No Outreach Sequence Assigned</h4>
                    <p className="text-xs text-[#516f90] max-w-md mx-auto mt-0.5">
                      Assign an approved team cadence or create a custom follow-up sequence for {lead.firstName} and submit for Admin approval.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 max-w-xl mx-auto">
                    {/* Option 1: Pre-Approved dropdown */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <select
                        value={selectedSeqToAssign}
                        onChange={(e) => setSelectedSeqToAssign(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded border border-[#cbd6e2] bg-white text-[#2d3e50] focus:border-[#ff7a59] focus:outline-hidden flex-1 sm:w-52"
                      >
                        <option value="">Choose Approved Cadence...</option>
                        {sequences
                          .filter((s) => s.approvalStatus === 'approved' || s.status === 'active')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.steps.length} steps)
                            </option>
                          ))}
                      </select>

                      <Button
                        size="sm"
                        disabled={!selectedSeqToAssign}
                        onClick={() => {
                          assignSequenceToLead(lead.id, selectedSeqToAssign);
                          setSelectedSeqToAssign('');
                        }}
                        className="h-8 text-xs bg-[#0091ae] hover:bg-[#007a93] text-white font-semibold shadow-xs cursor-pointer"
                      >
                        <span>Enroll</span>
                      </Button>
                    </div>

                    <span className="text-xs text-slate-400 font-bold px-1 hidden sm:inline">OR</span>

                    {/* Option 2: Create Custom Sequence for this Lead */}
                    <Button
                      size="sm"
                      onClick={openCustomSeqModal}
                      className="h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold shadow-xs cursor-pointer gap-1.5 w-full sm:w-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Sequence &amp; Request Approval</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-1 border-b border-[#dfe3eb]/60">
                    <p className="font-bold text-[#33475b]">
                      Cadence Steps ({lead.currentStepNumber} of {sequence.steps.length} completed)
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 bg-white border border-[#cbd8eb] rounded px-2 py-1 shadow-2xs text-xs">
                          <Calendar className="h-3.5 w-3.5 text-[#ff7a59]" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Change Start:</span>
                          <input
                            type="date"
                            value={lead.nextFollowUpDate || new Date().toISOString().split('T')[0]}
                            onChange={(e) => handleRescheduleStartDate(e.target.value)}
                            className="text-xs font-bold text-[#33475b] bg-transparent border-0 p-0 focus:outline-none cursor-pointer"
                            title="Admin: Change start date for this lead's cadence"
                          />
                        </div>
                      )}
                      {lead.outreachStatus !== 'completed' && lead.outreachStatus !== 'replied' && effectiveOutreachStatus !== 'pending_sequence_approval' && (
                        <Button
                          size="sm"
                          onClick={handleAdvanceStep}
                          className="h-7 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold cursor-pointer shadow-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          <span>Send Next LinkedIn Step</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {sequence.steps
                      .slice()
                      .sort((a, b) => a.stepNumber - b.stepNumber)
                      .map((st) => {
                        const isCompleted = st.stepNumber < lead.currentStepNumber || lead.outreachStatus === 'completed';
                        const isCurrent = st.stepNumber === lead.currentStepNumber && lead.outreachStatus !== 'completed';
                        const sched = stepScheduleMap.get(st.stepNumber);

                        const getActionExplanation = () => {
                          switch (st.actionType) {
                            case 'connection_request':
                              return 'Send LinkedIn connection invite with personalized note';
                            case 'wait_for_acceptance':
                              return 'Monitor connection state until accepted (Decision 2 Gate)';
                            case 'send_message':
                              return 'Send value proposition outreach message on LinkedIn';
                            case 'followup':
                              return 'Send follow-up nudge or case study proof';
                            case 'complete_details':
                              return 'Review prospect reply & complete lead outcome evaluation';
                            case 'wait_delay':
                              return `Wait ${st.delayDays} day(s) before sending next outreach`;
                            default:
                              return st.title;
                          }
                        };

                        return (
                          <div
                            key={st.id || st.stepNumber}
                            className={`p-3.5 rounded-lg border transition-all ${
                              isCurrent
                                ? 'border-[#ff7a59]/60 bg-[#fffdfd] shadow-xs ring-1 ring-[#ff7a59]/20'
                                : isCompleted
                                ? 'border-[#dfe3eb] bg-[#f8fafc] text-slate-500'
                                : 'border-[#dfe3eb] bg-white text-slate-400'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Step Number / Completed Badge */}
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrent
                                    ? 'bg-[#ff7a59] text-white shadow-xs'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isCompleted ? <Check className="h-3.5 w-3.5" /> : st.stepNumber}
                              </div>

                              <div className="min-w-0 flex-1 space-y-1.5">
                                {/* Title & Date Pill */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold text-xs ${isCurrent ? 'text-[#33475b]' : isCompleted ? 'text-slate-700' : 'text-slate-500'}`}>
                                      {st.title}
                                    </span>
                                  </div>

                                  {/* Scheduled Date Badge */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {effectiveOutreachStatus === 'pending_sequence_approval' ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                        <Clock className="h-3 w-3 text-amber-600" />
                                        <span>Pending Admin Approval</span>
                                      </span>
                                    ) : isCompleted ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        <span>Completed: {sched?.formatted || 'Done'}</span>
                                      </span>
                                    ) : isCurrent ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-[#fff0eb] px-2 py-0.5 text-[11px] font-bold text-[#e06545] border border-[#ff7a59]/40 shadow-2xs">
                                        <Clock className="h-3 w-3 text-[#ff7a59] animate-pulse" />
                                        <span>{sched?.isToday ? 'Today · ' : 'Due '}{sched?.formatted}</span>
                                        <span className="text-[10px] text-[#ff7a59]/80 font-normal">
                                          ({st.delayDays === 0 ? 'Immediate' : `+${st.delayDays}d`})
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-[#f5f8fa] px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        <span>Scheduled: {sched?.formatted}</span>
                                        <span className="text-[10px] text-slate-400 font-normal">
                                          ({st.delayDays === 0 ? 'Immediate' : `+${st.delayDays}d delay`})
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Scheduled Action Description */}
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-600">Action:</span>
                                  <span className={isCurrent ? 'text-slate-700 font-medium' : ''}>
                                    {getActionExplanation()}
                                  </span>
                                </div>

                                {/* Decision 2 Connection Gate Manual Confirmation on Step 2 */}
                                {isCurrent && st.stepNumber === 2 && (
                                  <div className="mt-2 p-2 rounded-md border border-[#dfe3eb] text-xs">
                                    {lead.connectionStatus === 'connected' ? (
                                      <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50/80 p-1.5 rounded">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                        <div>
                                          <span className="font-bold">Connection Accepted!</span>
                                          <span className="text-slate-600 ml-1">Decision 2 Gate cleared. You can now advance to Step 3.</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/80 p-1.5 rounded border border-amber-200/60">
                                        <div className="flex items-center gap-2 text-amber-900">
                                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                          <span>
                                            Connection request is <strong>Sent / Pending</strong>. When prospect accepts on LinkedIn, confirm below:
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          onClick={() => handleSetConnectionStatus('connected')}
                                          className="h-6 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs shrink-0 cursor-pointer"
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          <span>Mark Accepted</span>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Template (if applicable) */}
                                {st.stepNumber === 1 ? (
                                  connectionNoteSent ? (
                                    <div className="mt-1.5 p-2 rounded bg-white border border-[#dfe3eb] text-[11px] text-slate-700">
                                      <p className="font-mono text-[10px] text-slate-500 mb-0.5">Connection Note Sent:</p>
                                      <p className="italic text-slate-800 leading-relaxed">&ldquo;{connectionNoteSent}&rdquo;</p>
                                    </div>
                                  ) : (
                                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500 italic">
                                      (Connection request sent without note)
                                    </div>
                                  )
                                ) : st.messageTemplate && (
                                  <div className="mt-1.5 p-2 rounded bg-white border border-[#dfe3eb] text-[11px] text-slate-700">
                                    <p className="font-mono text-[10px] text-slate-500 mb-0.5">Template:</p>
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                      {st.messageTemplate
                                        .replace(/\{\{firstName\}\}/gi, lead.firstName)
                                        .replace(/\{\{company\}\}/gi, lead.company)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enriched Intelligence Card */}
          {/* <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
                  Enriched Company Intelligence
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEnrichOpen(true)}
                className="h-6 text-xs text-[#0091ae] hover:underline p-0"
              >
                Edit Details
              </Button>
            </div>

            {lead.enrichedData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#f5f8fa] p-3 rounded border border-[#dfe3eb]">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Company Size</span>
                  <p className="font-bold text-[#33475b]">{lead.enrichedData.companySize || '250-500 employees'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Annual Revenue</span>
                  <p className="font-bold text-[#33475b]">{lead.enrichedData.annualRevenue || '$30M - $50M'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Direct Phone</span>
                  <p className="font-bold text-emerald-700">{lead.enrichedData.phone || lead.phone || 'Verified'}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Tech Stack</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lead.enrichedData.techStack?.map((t) => (
                      <span key={t} className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold border border-[#dfe3eb] text-slate-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                {lead.enrichedData.enrichmentNotes && (
                  <div className="col-span-2 sm:col-span-3 pt-2 border-t border-[#dfe3eb]">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Research Notes</span>
                    <p className="text-[11px] text-slate-700 mt-0.5">{lead.enrichedData.enrichmentNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center rounded bg-[#f5f8fa] border border-[#dfe3eb] space-y-2">
                <p className="text-slate-500 text-xs">No enriched corporate profile added yet.</p>
                <Button
                  size="sm"
                  onClick={() => setIsEnrichOpen(true)}
                  className="bg-[#0091ae] hover:bg-[#007a93] text-white text-xs h-7"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  <span>Enrich Account Now</span>
                </Button>
              </div>
            )}
          </div> */}

          {/* Activity Timeline (HubSpot-styled) */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px] pb-2 border-b border-[#dfe3eb] flex items-center justify-between">
              <span>Activity History ({leadActivities.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Chronological Timeline</span>
            </h3>

            {leadActivities.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No activity recorded yet for this lead.
              </div>
            ) : (
              <div className="relative pl-5 space-y-4 pt-2 border-l-2 border-[#dfe3eb] ml-2">
                {leadActivities.map((act) => (
                  <div key={act.id} className="relative">
                    {/* Bullet marker */}
                    <div className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#0091ae]" />

                    <div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-[#33475b]">{act.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(act.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {act.description}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        By <span className="font-semibold text-slate-600">{act.actorName}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Drawer */}
      <AddLeadDrawer
        isOpen={isEditOpen}
        leadToEdit={lead}
        onClose={() => setIsEditOpen(false)}
      />

      {/* Record Reply Dialog */}
      {isReplyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-3">
            <h4 className="font-bold text-sm text-[#33475b]">
              Record Inbound Prospect Reply
            </h4>
            <p className="text-slate-500 text-[11px]">
              Recording a reply marks this lead as an active conversation and stops further automated sequence steps.
            </p>
            <form onSubmit={handleRecordReply} className="space-y-3">
              <textarea
                required
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Paste the prospect's LinkedIn response message here..."
                className="w-full rounded border border-[#cbd6e2] p-2.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsReplyOpen(false)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Record Reply &amp; Halt Cadence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrich Modal */}
      {isEnrichOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Enrich Account Intelligence</span>
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Update verified direct contact and tech profile for {lead.company}.
              </p>
            </div>

            <form onSubmit={handleSaveEnrichment} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Verified Direct Phone</label>
                <input
                  type="text"
                  value={enrichPhone}
                  onChange={(e) => setEnrichPhone(e.target.value)}
                  placeholder="+1 (415) 880-9912"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Company Size</label>
                  <input
                    type="text"
                    value={enrichSize}
                    onChange={(e) => setEnrichSize(e.target.value)}
                    placeholder="250-500 employees"
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Annual Revenue</label>
                  <input
                    type="text"
                    value={enrichRev}
                    onChange={(e) => setEnrichRev(e.target.value)}
                    placeholder="$30M - $50M"
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Tech Stack (comma-separated)</label>
                <input
                  type="text"
                  value={enrichTech}
                  onChange={(e) => setEnrichTech(e.target.value)}
                  placeholder="HubSpot, React, AWS, Postgres"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Enrichment Notes</label>
                <textarea
                  rows={2}
                  value={enrichNotes}
                  onChange={(e) => setEnrichNotes(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsEnrichOpen(false)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Save Intelligence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Sequence & Send for Approval Modal */}
      {isCreateSeqOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe3eb]">
              <div>
                <h3 className="font-bold text-[#2d3e50] text-sm flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-[#ff7a59]" />
                  <span>Create Custom Sequence for {lead.firstName} {lead.lastName}</span>
                </h3>
                <p className="text-xs text-[#516f90] mt-0.5">
                  Design bespoke follow-up steps. Will be submitted to Admin for review and approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSeqOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Lead Context Banner */}
            <div className="rounded-md border border-[#dfe3eb] bg-[#f8fafc] p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2d3e50]">{lead.firstName} {lead.lastName}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Connection: Request Sent
                </span>
              </div>
              <p className="text-[11px] text-[#516f90]">{lead.jobTitle} at {lead.company}</p>
            </div>

            <form onSubmit={handleCreateCustomSequence} className="space-y-4 text-xs">
              {/* Sequence Name */}
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Sequence Name</label>
                <input
                  type="text"
                  required
                  value={customSeqName}
                  onChange={(e) => setCustomSeqName(e.target.value)}
                  placeholder="e.g. Bespoke Cadence: Allan Brisbane"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:border-[#ff7a59] focus:outline-none"
                />
              </div>

              {/* Step 1: Connection Request (Completed) */}
              <div className="rounded-md border border-[#e2e8f0] bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-[#33475b] flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Step 1: Connection Request (Sent on LinkedIn)
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Done
                  </span>
                </div>
                {connectionNoteSent ? (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Connection Note Sent:
                    </span>
                    <p className="text-xs text-slate-700 bg-white p-2.5 rounded border border-slate-200 italic leading-relaxed">
                      &ldquo;{connectionNoteSent}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    (Connection request sent without note)
                  </p>
                )}
              </div>

              {/* Step 2: First Follow-up */}
              <div className="space-y-2 border border-[#dfe3eb] rounded-md p-3 bg-white">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#2d3e50] text-[11px]">
                    Step 2: First Follow-up Message
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Delay (days after connect):</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={step2Delay}
                      onChange={(e) => setStep2Delay(Number(e.target.value))}
                      className="w-14 rounded border border-[#cbd6e2] px-2 py-0.5 text-xs text-center font-bold text-[#33475b]"
                    />
                  </div>
                </div>
                <textarea
                  required
                  rows={3}
                  value={step2Message}
                  onChange={(e) => setStep2Message(e.target.value)}
                  placeholder="Follow-up message sent after connection acceptance..."
                  className="w-full rounded border border-[#cbd6e2] p-2 text-xs text-[#33475b] focus:border-[#ff7a59] focus:outline-none"
                />
              </div>

              {/* Step 3: Second Follow-up (Optional) */}
              <div className="space-y-2 border border-[#dfe3eb] rounded-md p-3 bg-white">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#2d3e50] text-[11px]">
                    Step 3: Second Follow-up Message (Optional)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Delay (days after Step 2):</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={step3Delay}
                      onChange={(e) => setStep3Delay(Number(e.target.value))}
                      className="w-14 rounded border border-[#cbd6e2] px-2 py-0.5 text-xs text-center font-bold text-[#33475b]"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={step3Message}
                  onChange={(e) => setStep3Message(e.target.value)}
                  placeholder="Second follow-up message if prospect has not replied..."
                  className="w-full rounded border border-[#cbd6e2] p-2 text-xs text-[#33475b] focus:border-[#ff7a59] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#dfe3eb]">
                <p className="text-[11px] text-slate-400">
                  ℹ Admin will review and activate this sequence
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateSeqOpen(false)}
                    className="border-[#cbd6e2] text-[#33475b]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingCustomSeq || !step2Message.trim()}
                    className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold cursor-pointer gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSubmittingCustomSeq ? 'Submitting…' : 'Submit for Admin Approval'}</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Lead"
        description={`Are you sure you want to delete ${lead.firstName} ${lead.lastName}? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        onConfirm={() => {
          deleteLead(lead.id);
          router.push(ROUTES.LEADS);
        }}
        onClose={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
