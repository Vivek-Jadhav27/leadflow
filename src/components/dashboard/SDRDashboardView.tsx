'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  MessageSquare,
  RotateCcw,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Send,
  Search,
  Plus,
  UserCheck,
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
  X,
  Phone,
  Mail,
  Filter,
  UserPlus,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { useAuthContext } from '@/context/AuthProvider';
import { useCRM } from '@/hooks/useCRM';
import { Task, Lead } from '@/types/crm';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getTodayString } from '@/utils/date';

export function SDRDashboardView() {
  const { user, currentWorkspace, isAdmin } = useAuthContext();
  const {
    tasks,
    leads,
    sequences,
    updateTaskStatus,
    rescheduleTask,
    advanceLeadStep,
    markReply,
    createTask,
    createLead,
  } = useCRM();

  // Search & Filter state
  const [activeTab, setActiveTab] = useState<'all' | 'message' | 'followup' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Modals state
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [replyLead, setReplyLead] = useState<{ lead: Lead; task?: Task } | null>(null);
  const [replyOutcome, setReplyOutcome] = useState('Interested');
  const [replyMessage, setReplyMessage] = useState('');
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // New task form fields
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskLeadId, setNewTaskLeadId] = useState(leads[0]?.id || '');
  const [newTaskType, setNewTaskType] = useState<Task['type']>('linkedin_message');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('medium');

  // Use local date (e.g. 2026-11-03) instead of UTC date string to avoid timezone date shifts
  const todayStr = useMemo(() => getTodayString(), []);
  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const userEmailNorm = useMemo(() => (user?.email || '').toLowerCase().trim(), [user?.email]);

  // SDR can see their assigned/captured leads; Admin can see all leads in workspace
  const assignedLeads = useMemo(() => {
    return leads.filter((l) => {
      if (isAdmin || user?.role === 'admin') return true;
      const leadEmail = (l.assignedToEmail || '').toLowerCase().trim();
      return (
        (user?.uid && l.assignedToId === user.uid) ||
        (user?.uid && l.capturedByUid === user.uid) ||
        (userEmailNorm && leadEmail === userEmailNorm)
      );
    });
  }, [leads, user?.uid, user?.role, isAdmin, userEmailNorm]);

  // Map tasks to leads and enrich items for Today's Queue
  const todayItems = useMemo(() => {
    // 1. Gather all tasks assigned to this SDR that are due today or overdue pending
    const relevantTasks = tasks.filter((t) => {
      const isAssigned =
        (user?.uid && t.assignedToId === user.uid) ||
        assignedLeads.some((l) => l.id === t.leadId);
      if (!isAssigned) return false;

      const isDueTodayOrOverdue = t.dueDate <= todayStr && t.status !== 'completed' && t.status !== 'skipped';
      const isCompletedToday = t.status === 'completed' && (t.completedAt?.startsWith(todayStr) || t.dueDate === todayStr);
      return isDueTodayOrOverdue || isCompletedToday;
    });

    const items: Array<{
      id: string;
      task?: Task;
      lead: Lead;
      type: 'message' | 'followup' | 'connect';
      dueDate: string;
      isOverdue: boolean;
      isCompleted: boolean;
      sequenceTitle?: string;
      stepNumber?: number;
      stepTitle?: string;
      messageTemplate?: string;
    }> = [];

    const processedLeadIds = new Set<string>();

    for (const task of relevantTasks) {
      let lead = assignedLeads.find((l) => l.id === task.leadId);
      if (!lead) {
        // Fallback placeholder lead from task info
        lead = {
          id: task.leadId || `temp_${task.id}`,
          firstName: task.leadName.split(' ')[0] || 'Prospect',
          lastName: task.leadName.split(' ').slice(1).join(' ') || '',
          company: task.leadCompany || 'Company',
          jobTitle: 'Prospect',
          email: null,
          linkedinUrl: task.leadLinkedin || 'https://www.linkedin.com',
          channel: 'linkedin',
          currentStepNumber: task.stepNumber || 1,
          connectionStatus: 'pending',
          outreachStatus: 'in_sequence',
          disposition: 'active',
          createdAt: task.dueDate,
          updatedAt: task.dueDate,
        };
      }

      processedLeadIds.add(lead.id);

      const isCompleted = task.status === 'completed';
      const isOverdue = !isCompleted && task.dueDate < todayStr;

      let actionType: 'message' | 'followup' | 'connect' = 'message';
      if (task.type === 'followup' || task.title.toLowerCase().includes('follow')) {
        actionType = 'followup';
      } else if (task.type === 'linkedin_connect' || task.title.toLowerCase().includes('connect')) {
        actionType = 'connect';
      }

      // Resolve exact sequence and step template
      const seq = sequences.find((s) => s.id === lead?.sequenceId || s.id === task.sequenceId);
      const stepNum = task.stepNumber || lead?.currentStepNumber || 1;
      const step = seq?.steps?.find((st) => st.stepNumber === stepNum);
      const stepTemplate = step?.messageTemplate || task.messageTemplate;

      items.push({
        id: task.id,
        task,
        lead,
        type: actionType,
        dueDate: task.dueDate,
        isOverdue,
        isCompleted,
        sequenceTitle: seq?.name || lead.sequenceName || 'LinkedIn Outreach Cadence',
        stepNumber: stepNum,
        stepTitle: step?.title || '',
        messageTemplate: stepTemplate,
      });
    }

    // 2. Also surface any assigned leads that have nextFollowUpDate <= todayStr or pending sequence action, or needs_sequence!
    assignedLeads.forEach((l) => {
      if (l.disposition === 'archived') return;
      if (processedLeadIds.has(l.id)) return;

      const isNeedsSequence = l.outreachStatus === 'needs_sequence';
      const isDueOrOverdue = Boolean(l.nextFollowUpDate && l.nextFollowUpDate <= todayStr);
      const isFollowupDue = l.outreachStatus === 'followup_due';
      const isSequenceActionDue = Boolean(
        l.sequenceId &&
        l.outreachStatus !== 'completed' &&
        l.outreachStatus !== 'stopped' &&
        (isDueOrOverdue || isFollowupDue || l.nextFollowUpDate === todayStr)
      );

      if (isNeedsSequence || isDueOrOverdue || isFollowupDue || isSequenceActionDue) {
        const seq = sequences.find((s) => s.id === l.sequenceId);
        const stepNum = l.currentStepNumber || 1;
        const step = seq?.steps?.find((st) => st.stepNumber === stepNum);
        const stepTemplate = step?.messageTemplate;

        let actionType: 'message' | 'followup' | 'connect' = 'followup';
        if (isNeedsSequence) {
          actionType = 'followup';
        } else if (step?.actionType === 'connection_request' || l.currentStepNumber === 1) {
          actionType = 'connect';
        } else if (step?.actionType === 'send_message' || l.currentStepNumber === 3) {
          actionType = 'message';
        }

        const noteSnippet = l.connectionNote
          ? `Connection sent on LinkedIn with note: "${l.connectionNote}". Click Assign Cadence to select or build follow-up sequence.`
          : 'Connection request sent on LinkedIn. Follow-up sequence needed.';

        items.push({
          id: `lead_due_${l.id}`,
          lead: l,
          type: actionType,
          dueDate: l.nextFollowUpDate || todayStr,
          isOverdue: Boolean(l.nextFollowUpDate && l.nextFollowUpDate < todayStr),
          isCompleted: false,
          sequenceTitle: seq?.name || l.sequenceName || (isNeedsSequence ? 'Cadence Needed' : 'Outreach Cadence'),
          stepNumber: stepNum,
          stepTitle: isNeedsSequence ? 'Draft Follow-up Cadence' : (step?.title || l.nextActionTitle || `Step ${stepNum}`),
          messageTemplate: isNeedsSequence ? noteSnippet : stepTemplate,
        });
      }
    });

    return items;
  }, [tasks, leads, sequences, assignedLeads, todayStr]);

  // Tab filtering & search
  const filteredItems = useMemo(() => {
    return todayItems.filter((item) => {
      // Tab filter
      if (activeTab === 'completed') {
        if (!item.isCompleted) return false;
      } else if (activeTab === 'message') {
        if (item.isCompleted) return false;
        if (item.type !== 'message' && item.type !== 'connect') return false;
      } else if (activeTab === 'followup') {
        if (item.isCompleted) return false;
        if (item.type !== 'followup') return false;
      } else {
        // 'all' tab shows pending/overdue
        if (item.isCompleted) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${item.lead.firstName} ${item.lead.lastName}`.toLowerCase();
        const comp = (item.lead.company || '').toLowerCase();
        const title = (item.lead.jobTitle || '').toLowerCase();
        return fullName.includes(q) || comp.includes(q) || title.includes(q);
      }

      return true;
    });
  }, [todayItems, activeTab, searchQuery]);

  // Counts for tabs & summary
  const counts = useMemo(() => {
    const totalPending = todayItems.filter((i) => !i.isCompleted).length;
    const messagesDue = todayItems.filter((i) => !i.isCompleted && (i.type === 'message' || i.type === 'connect')).length;
    const followupsDue = todayItems.filter((i) => !i.isCompleted && i.type === 'followup').length;
    const completedToday = todayItems.filter((i) => i.isCompleted).length;
    const overdueCount = todayItems.filter((i) => !i.isCompleted && i.isOverdue).length;

    return { totalPending, messagesDue, followupsDue, completedToday, overdueCount };
  }, [todayItems]);

  // Generate personalized template matching exact sequence step
  const getPersonalizedMessage = (item: typeof todayItems[0]) => {
    if (item.lead.outreachStatus === 'needs_sequence') {
      return '';
    }

    // 1. Resolve exact sequence and step template
    const seq = sequences.find(
      (s) => s.id === item.lead.sequenceId || (item.task && s.id === item.task.sequenceId)
    );
    const stepNum = item.stepNumber || item.lead.currentStepNumber || 1;
    const step = seq?.steps?.find((st) => st.stepNumber === stepNum);

    // Look for real template text, filtering out internal status strings
    const isInternalStatus = (txt?: string | null) =>
      !txt ||
      !txt.trim() ||
      txt.toLowerCase().includes('awaiting connection') ||
      txt.toLowerCase().includes('action scheduled per cadence') ||
      txt.toLowerCase().includes('click "assign cadence"');

    let template: string | null = null;
    if (item.task?.messageTemplate && !isInternalStatus(item.task.messageTemplate)) {
      template = item.task.messageTemplate;
    } else if (step?.messageTemplate && !isInternalStatus(step.messageTemplate)) {
      template = step.messageTemplate;
    } else if (item.messageTemplate && !isInternalStatus(item.messageTemplate)) {
      template = item.messageTemplate;
    }

    // If template is still empty or a wait step, find the actual message in the sequence
    if (!template || !template.trim()) {
      const realMsgStep = seq?.steps?.find(
        (st) => st.messageTemplate && st.messageTemplate.trim() && !isInternalStatus(st.messageTemplate)
      );
      if (realMsgStep?.messageTemplate) {
        template = realMsgStep.messageTemplate;
      }
    }

    // If sequence has no template, provide a real, contextual follow-up message
    if (!template || !template.trim()) {
      if (item.type === 'connect') {
        template = 'Hi {{firstName}}, noticed your leadership at {{company}} and would love to connect and share some insights!';
      } else {
        template = 'Hi {{firstName}}, thanks for connecting! Following up to see if you had a moment to check how we help teams at {{company}} optimize outbound outreach. Would love to share a quick overview.';
      }
    }

    const fName = item.lead.firstName || 'there';
    const lName = item.lead.lastName || '';
    const comp  = item.lead.company || 'your company';
    const role  = item.lead.jobTitle || 'your team';

    return template
      .replace(/\{\{\s*firstName\s*\}\}/gi, fName)
      .replace(/\{\{\s*first_name\s*\}\}/gi, fName)
      .replace(/\{\{\s*lastName\s*\}\}/gi, lName)
      .replace(/\{\{\s*last_name\s*\}\}/gi, lName)
      .replace(/\{\{\s*company\s*\}\}/gi, comp)
      .replace(/\{\{\s*companyName\s*\}\}/gi, comp)
      .replace(/\{\{\s*jobTitle\s*\}\}/gi, role)
      .replace(/\{\{\s*title\s*\}\}/gi, role);
  };

  // Actions
  const handleCopyMessage = (item: typeof todayItems[0]) => {
    const text = getPersonalizedMessage(item);
    navigator.clipboard.writeText(text);
    setCopiedTaskId(item.id);
    toast.success(`Message copied for ${item.lead.firstName}! Ready to paste into LinkedIn.`);
    setTimeout(() => {
      setCopiedTaskId(null);
    }, 2000);
  };

  const handleMarkSent = (item: typeof todayItems[0]) => {
    if (item.task) {
      updateTaskStatus(item.task.id, 'completed');
    }
    if (item.lead?.id) {
      advanceLeadStep(item.lead.id);
    }
    toast.success(`✓ Marked sent for ${item.lead.firstName}! Cadence advanced.`);
  };

  const handleOpenLinkedIn = (linkedinUrl: string) => {
    if (!linkedinUrl) {
      toast.error('No LinkedIn profile URL provided for this lead.');
      return;
    }
    const cleanUrl = linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`;
    window.open(cleanUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingTask || !rescheduleDate) return;
    rescheduleTask(reschedulingTask.id, rescheduleDate);
    toast.success(`Task rescheduled to ${rescheduleDate}`);
    setReschedulingTask(null);
    setRescheduleDate('');
  };

  const handleLogReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyLead) return;
    markReply(replyLead.lead.id, replyMessage, replyOutcome);
    if (replyLead.task) {
      updateTaskStatus(replyLead.task.id, 'completed');
    }
    toast.success(`Reply recorded (${replyOutcome}) for ${replyLead.lead.firstName}. Automated follow-ups halted.`);
    setReplyLead(null);
    setReplyMessage('');
    setReplyOutcome('Interested');
  };

  const handleCreateQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const lead = leads.find((l) => l.id === newTaskLeadId) || leads[0];
    if (!lead) {
      toast.error('Please create or select a lead first.');
      return;
    }

    createTask({
      title: newTaskTitle.trim(),
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadCompany: lead.company,
      leadLinkedin: lead.linkedinUrl,
      type: newTaskType,
      dueDate: todayStr,
      assignedToId: user?.uid || (user?.role === 'ae' ? 'ae_current' : 'sdr_current'),
      assignedToName: user?.displayName || user?.email || (user?.role === 'ae' ? 'Account Executive' : 'Outbound SDR'),
      priority: newTaskPriority,
      status: 'pending',
    });

    setIsNewTaskOpen(false);
    setNewTaskTitle('');
    toast.success(`Task scheduled for ${lead.firstName} today!`);
  };

  // Seed sample leads for demo / testing if workspace is empty
  const handleSeedSampleLeads = () => {
    const samples = [
      {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        company: 'HyperScale AI',
        jobTitle: 'VP of Sales & Revenue Operations',
        email: 'sarah.jenkins@hyperscale.ai',
        linkedinUrl: 'https://www.linkedin.com/in/sarah-jenkins-sales',
        sequenceName: 'Enterprise SaaS 4-Step Cadence',
        currentStepNumber: 1,
        outreachStatus: 'in_sequence' as const,
        connectionStatus: 'pending' as const,
        disposition: 'active' as const,
        channel: 'linkedin' as const,
      },
      {
        firstName: 'David',
        lastName: 'Kim',
        company: 'NextGen Cloud',
        jobTitle: 'Head of Business Development',
        email: 'dkim@nextgencloud.io',
        linkedinUrl: 'https://www.linkedin.com/in/davidkim-b2b',
        sequenceName: 'Outbound Cold Prospecting',
        currentStepNumber: 2,
        outreachStatus: 'followup_due' as const,
        connectionStatus: 'connected' as const,
        disposition: 'active' as const,
        channel: 'linkedin' as const,
      },
      {
        firstName: 'Elena',
        lastName: 'Rostova',
        company: 'DataSphere Tech',
        jobTitle: 'Director of Growth & Demand Gen',
        email: 'elena@datasphere.com',
        linkedinUrl: 'https://www.linkedin.com/in/elena-rostova-growth',
        sequenceName: 'Enterprise SaaS 4-Step Cadence',
        currentStepNumber: 3,
        outreachStatus: 'followup_due' as const,
        connectionStatus: 'connected' as const,
        disposition: 'active' as const,
        channel: 'linkedin' as const,
      },
    ];

    samples.forEach((s) => {
      const created = createLead(s);
      if (created) {
        const isFollowup = s.currentStepNumber > 1;
        createTask({
          title: isFollowup
            ? `Follow-up Step ${s.currentStepNumber} with ${s.firstName} ${s.lastName}`
            : `Send Step 1 LinkedIn Message to ${s.firstName} ${s.lastName}`,
          leadId: created.id,
          leadName: `${s.firstName} ${s.lastName}`,
          leadCompany: s.company,
          leadLinkedin: s.linkedinUrl,
          type: isFollowup ? 'followup' : 'linkedin_message',
          dueDate: todayStr,
          assignedToId: user?.uid || (user?.role === 'ae' ? 'ae_current' : 'sdr_current'),
          assignedToName: user?.displayName || user?.email || (user?.role === 'ae' ? 'Account Executive' : 'Outbound SDR'),
          priority: 'high',
          status: 'pending',
          stepNumber: s.currentStepNumber,
        });
      }
    });

    toast.success('Added 3 sample leads with scheduled tasks for today!');
  };

  return (
    <div className="space-y-6">
      {/* SDR Header & Today's Operational Context */}
      {/* <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                user?.role === 'ae' ? 'bg-[#f5f3ff] text-[#7c3aed]' : 'bg-[#e5f5f8] text-[#0091ae]'
              }`}>
                {user?.role === 'ae' ? 'AE Dashboard' : 'SDR Dashboard'}
              </span>
              <span className="text-xs text-[#7c98b6] flex items-center gap-1 font-medium">
                <Calendar className="h-3.5 w-3.5 text-[#0091ae]" />
                {todayFormatted}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2d3e50] tracking-tight">
              Today&apos;s Outreach Queue
            </h1>
            <p className="text-xs sm:text-sm text-[#516f90]">
              Scheduled LinkedIn messages and follow-ups ready for your execution today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsNewTaskOpen(true)}
              className="h-8.5 px-3 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Today&apos;s Task</span>
            </Button>

            {todayItems.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSeedSampleLeads}
                className="h-8.5 px-3 border-[#cbd6e2] text-[#2d3e50] hover:bg-[#f8fafc] text-xs font-semibold gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#ff7a59]" />
                <span>Seed Sample Leads</span>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#f0f4f8] flex flex-wrap items-center justify-between text-xs text-[#7c98b6]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#2d3e50]">Assigned Workspace:</span>
            <span className="text-[#516f90] font-medium">
              {currentWorkspace?.companyName || user?.companyName || 'LeadFlow Workspace'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Outreach Active
            </span>
            <span className="text-[#cbd6e2]">|</span>
            <span>Role: {user?.role === 'ae' ? 'Account Executive (AE)' : 'Outbound SDR'}</span>
          </div>
        </div>
      </div> */}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Pending Tasks Today */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#516f90]">Tasks Due Today</span>
            <div className="h-6 w-6 rounded-md bg-[#fff5f2] text-[#ff7a59] flex items-center justify-center">
              <CheckSquare className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#2d3e50]">{counts.totalPending}</div>
          <p className="text-[11px] text-[#7c98b6] mt-0.5">
            {counts.overdueCount > 0 ? (
              <span className="text-rose-600 font-semibold">{counts.overdueCount} overdue</span>
            ) : (
              'All scheduled for today'
            )}
          </p>
        </div>

        {/* Metric 2: Messages to Send */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#516f90]">Messages to Send</span>
            <div className="h-6 w-6 rounded-md bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#2d3e50]">{counts.messagesDue}</div>
          <p className="text-[11px] text-[#7c98b6] mt-0.5">Initial outreach &amp; cadence msgs</p>
        </div>

        {/* Metric 3: Follow-ups Due */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#516f90]">Follow-ups Due</span>
            <div className="h-6 w-6 rounded-md bg-[#eff2f6] text-[#2d3e50] flex items-center justify-center">
              <RotateCcw className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#2d3e50]">{counts.followupsDue}</div>
          <p className="text-[11px] text-[#7c98b6] mt-0.5">Awaiting follow-up response</p>
        </div>

        {/* Metric 4: Completed Today */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#516f90]">Completed Today</span>
            <div className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{counts.completedToday}</div>
          <p className="text-[11px] text-[#7c98b6] mt-0.5">Sent &amp; cadence steps advanced</p>
        </div>
      </div>

      {/* Main Section: Today's Tasks & Leads to Message / Follow Up */}
      <div className="bg-white rounded-lg border border-[#dfe3eb] shadow-xs overflow-hidden">
        {/* Section Header & Subtitle */}
        <div className="p-4 sm:p-5 border-b border-[#dfe3eb]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2d3e50] flex items-center gap-2">
                <CheckSquare className="h-4.5 w-4.5 text-[#ff7a59]" />
                <span>Today&apos;s Tasks &amp; Scheduled Leads</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f0f4f8] text-[#516f90]">
                  {counts.totalPending} pending
                </span>
              </h2>
              <p className="text-xs text-[#516f90] mt-0.5">
                List of leads you have to send a message or follow up with today.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#7c98b6]" />
              <input
                type="text"
                placeholder="Search leads by name or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#7c98b6] hover:text-[#2d3e50]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#f0f4f8] overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'all'
                  ? 'bg-[#2d3e50] text-white shadow-xs'
                  : 'text-[#516f90] hover:bg-[#f8fafc] hover:text-[#2d3e50]'
              }`}
            >
              <span>All Today</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-[#1f2a37] text-white' : 'bg-[#eef2f6] text-[#516f90]'
              }`}>
                {counts.totalPending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('message')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'message'
                  ? 'bg-[#0091ae] text-white shadow-xs'
                  : 'text-[#516f90] hover:bg-[#f8fafc] hover:text-[#2d3e50]'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Send Message</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'message' ? 'bg-[#007a93] text-white' : 'bg-[#eef2f6] text-[#516f90]'
              }`}>
                {counts.messagesDue}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('followup')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'followup'
                  ? 'bg-[#ff7a59] text-white shadow-xs'
                  : 'text-[#516f90] hover:bg-[#f8fafc] hover:text-[#2d3e50]'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Follow-up Due</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'followup' ? 'bg-[#e06545] text-white' : 'bg-[#eef2f6] text-[#516f90]'
              }`}>
                {counts.followupsDue}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#516f90] hover:bg-[#f8fafc] hover:text-[#2d3e50]'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Completed Today</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'completed' ? 'bg-emerald-800 text-white' : 'bg-[#eef2f6] text-[#516f90]'
              }`}>
                {counts.completedToday}
              </span>
            </button>
          </div>
        </div>

        {/* Task & Leads List */}
        <div className="divide-y divide-[#dfe3eb]">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[#2d3e50]">
                {activeTab === 'completed'
                  ? 'No tasks completed yet today'
                  : 'All caught up for today!'}
              </h3>
              <p className="text-xs text-[#516f90] max-w-md mx-auto leading-relaxed">
                {activeTab === 'completed'
                  ? 'Mark outreach messages or follow-ups as sent to log them in today\'s completed records.'
                  : 'You have completed all scheduled tasks and follow-ups for today. Great job keeping your pipeline active!'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Link
                  href={ROUTES.LEADS}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-[#2d3e50] bg-white border border-[#cbd6e2] hover:bg-[#f8fafc] transition-colors"
                >
                  Explore All Leads
                </Link>
                <Link
                  href={ROUTES.SEQUENCES}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-[#ff7a59] hover:bg-[#e06545] transition-colors"
                >
                  Review Sequences
                </Link>
              </div>
            </div>
          ) : (
            filteredItems.map((item) => {
              const leadName = `${item.lead.firstName} ${item.lead.lastName}`.trim() || 'Prospect';
              const initialLetters = (
                (item.lead.firstName?.[0] || '') + (item.lead.lastName?.[0] || '')
              ).toUpperCase() || 'P';
              const isCadenceNeeded = item.lead.outreachStatus === 'needs_sequence' || !item.lead.sequenceId || Boolean(item.task?.title?.toLowerCase().includes('cadence'));
              const personalizedMsg = isCadenceNeeded ? '' : getPersonalizedMessage(item);
              const isCopied = copiedTaskId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition-colors hover:bg-[#f8fafc]/80 ${
                    item.isCompleted ? 'bg-[#f8fafc]/50 opacity-70' : ''
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Left: Lead Profile, Cadence Info, Message Preview */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-[#f0f4f8] border border-[#dfe3eb] text-[#2d3e50] flex items-center justify-center font-bold text-xs shrink-0">
                        {initialLetters}
                      </div>

                      <div className="space-y-2 min-w-0 flex-1">
                        {/* Name + Title + Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={ROUTES.LEAD_DETAIL(item.lead.id)}
                            className="font-bold text-sm text-[#2d3e50] hover:text-[#ff7a59] transition-colors hover:underline"
                          >
                            {leadName}
                          </Link>

                          <span className="text-xs text-[#7c98b6]">at</span>
                          <span className="font-semibold text-xs text-[#516f90]">
                            {item.lead.company}
                          </span>

                          {/* Action Type Badge */}
                          {isCadenceNeeded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="h-3 w-3" />
                              <span>Cadence Needed</span>
                            </span>
                          ) : item.type === 'message' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#e5f5f8] text-[#0091ae]">
                              <MessageSquare className="h-3 w-3" />
                              <span>Send Message</span>
                            </span>
                          ) : item.type === 'followup' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#fff5f2] text-[#ff7a59]">
                              <RotateCcw className="h-3 w-3" />
                              <span>Follow-up Due</span>
                            </span>
                          ) : item.type === 'connect' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#eff2f6] text-[#2d3e50]">
                              <UserPlus className="h-3 w-3" />
                              <span>Connection Request</span>
                            </span>
                          ) : null}

                          {/* Overdue / Due status */}
                          {item.isOverdue && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-600 border border-rose-200">
                              Overdue
                            </span>
                          )}
                          {!item.isOverdue && !item.isCompleted && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600">
                              Due Today
                            </span>
                          )}
                          {item.isCompleted && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600">
                              Completed
                            </span>
                          )}
                        </div>

                        {/* Job Title & Cadence Step */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#516f90]">
                          <span>{item.lead.jobTitle || 'Decision Maker'}</span>
                          <span className="text-[#cbd6e2]">•</span>
                          {isCadenceNeeded ? (
                            <span className="text-amber-700 font-medium flex items-center gap-1">
                              <Layers className="h-3 w-3 text-amber-600" />
                              Cadence not assigned
                            </span>
                          ) : (
                            <span className="text-[#7c98b6] flex items-center gap-1 font-medium">
                              <Layers className="h-3 w-3 text-[#0091ae]" />
                              {item.sequenceTitle} (Step {item.stepNumber})
                            </span>
                          )}
                        </div>

                        {/* Message Preview Box (only for active sequence messages/follow-ups) */}
                        {!isCadenceNeeded && personalizedMsg && (
                          <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5 sm:p-3 text-xs text-[#33475b] relative group/msg">
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-[#eef2f6]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0091ae] flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0091ae]" />
                                {item.type === 'followup'
                                  ? `Follow-up Message (Step ${item.stepNumber})`
                                  : item.stepTitle && !item.stepTitle.toLowerCase().includes('wait')
                                  ? `Sequence Step ${item.stepNumber}: ${item.stepTitle}`
                                  : `Follow-up Message (Step ${item.stepNumber})`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(item)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-[#0091ae] hover:text-[#007a93] transition-colors cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Copy Message</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="font-mono text-[11px] text-[#33475b] leading-relaxed whitespace-pre-wrap font-medium">
                              {personalizedMsg}
                            </p>
                          </div>
                        )}

                        {/* Contact details pills */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#7c98b6] pt-1">
                          {item.lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-400" />
                              <span>{item.lead.email}</span>
                            </span>
                          )}
                          {item.lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{item.lead.phone}</span>
                            </span>
                          )}
                          {item.lead.notes && (
                            <span className="italic truncate max-w-sm">
                              Note: {item.lead.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Direct Outreach & Cadence Actions */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#f0f4f8]">
                      {isCadenceNeeded ? (
                        /* Cadence Needed: ONLY Open LinkedIn + Assign Cadence. NO Reschedule, NO Log Reply, NO Mark Sent! */
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenLinkedIn(item.lead.linkedinUrl)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-[#0077b5] bg-[#0077b5]/10 hover:bg-[#0077b5]/20 transition-colors cursor-pointer"
                            title="Open LinkedIn profile in new tab"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            <span>Open LinkedIn</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>

                          <Link
                            href={ROUTES.LEAD_DETAIL(item.lead.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e06545] transition-colors shadow-xs cursor-pointer"
                            title="Assign or customize follow-up sequence"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>Assign Cadence</span>
                          </Link>
                        </>
                      ) : (
                        /* Standard task actions */
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenLinkedIn(item.lead.linkedinUrl)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-[#0077b5] bg-[#0077b5]/10 hover:bg-[#0077b5]/20 transition-colors cursor-pointer"
                            title="Open LinkedIn profile in new tab"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            <span>Open LinkedIn</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>

                          {!item.isCompleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkSent(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-white bg-[#0091ae] hover:bg-[#007a93] transition-colors shadow-xs cursor-pointer"
                                title="Mark message sent and advance sequence cadence"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Mark Sent</span>
                              </button>

                              {item.task && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReschedulingTask(item.task || null);
                                    setRescheduleDate(item.dueDate);
                                  }}
                                  className="text-[11px] font-semibold text-[#516f90] hover:text-[#2d3e50] hover:underline cursor-pointer"
                                >
                                  Reschedule
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setReplyLead({ lead: item.lead, task: item.task })}
                                className="text-[11px] font-semibold text-[#ff7a59] hover:text-[#e06545] hover:underline cursor-pointer"
                              >
                                Log Reply
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Sent &amp; Logged</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {reschedulingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <h3 className="font-bold text-sm text-[#2d3e50]">Reschedule Outreach Task</h3>
              <button
                type="button"
                onClick={() => setReschedulingTask(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3">
              <p className="text-xs text-[#516f90]">
                Select a new follow-up date for{' '}
                <strong className="text-[#2d3e50]">{reschedulingTask.leadName}</strong>:
              </p>

              <div>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={todayStr}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                  required
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setRescheduleDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 bg-[#f0f4f8] rounded text-[11px] font-semibold text-[#516f90] hover:bg-[#dfe3eb]"
                >
                  Tomorrow (+1d)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setRescheduleDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 bg-[#f0f4f8] rounded text-[11px] font-semibold text-[#516f90] hover:bg-[#dfe3eb]"
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    setRescheduleDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 bg-[#f0f4f8] rounded text-[11px] font-semibold text-[#516f90] hover:bg-[#dfe3eb]"
                >
                  Next Week
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReschedulingTask(null)}
                  className="h-8 text-xs text-[#516f90]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold"
                >
                  Save New Date
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Reply Modal */}
      {replyLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <h3 className="font-bold text-sm text-[#2d3e50]">
                Log Prospect Reply · {replyLead.lead.firstName} {replyLead.lead.lastName}
              </h3>
              <button
                type="button"
                onClick={() => setReplyLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLogReplySubmit} className="space-y-3">
              <p className="text-xs text-[#516f90]">
                Recording a reply automatically pauses further cadence follow-ups and updates the lead disposition.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                  Reply Outcome
                </label>
                <select
                  value={replyOutcome}
                  onChange={(e) => setReplyOutcome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                >
                  <option value="Interested">Interested (Warm Lead)</option>
                  <option value="Meeting Booked">Meeting Booked</option>
                  <option value="Not Interested">Not Interested / Unresponsive</option>
                  <option value="Needs Follow Up Later">Needs Follow Up Later</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                  Reply Excerpt or Notes
                </label>
                <textarea
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Paste what the prospect said on LinkedIn..."
                  className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyLead(null)}
                  className="h-8 text-xs text-[#516f90]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold"
                >
                  Record Reply
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Today's Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <h3 className="font-bold text-sm text-[#2d3e50]">Add Outreach Task for Today</h3>
              <button
                type="button"
                onClick={() => setIsNewTaskOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                  Select Lead
                </label>
                <select
                  value={newTaskLeadId}
                  onChange={(e) => setNewTaskLeadId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                  required
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName} ({l.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Send Value Prop LinkedIn Message"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                    Action Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                  >
                    <option value="linkedin_message">Send Message</option>
                    <option value="followup">Follow-up</option>
                    <option value="linkedin_connect">Connection Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#2d3e50] mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded border border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-hidden"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="h-8 text-xs text-[#516f90]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold"
                >
                  Add Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

