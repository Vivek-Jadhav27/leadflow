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
  HelpCircle,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/date';
import { EnrichedData, ConnectionStatus, LeadOutcome } from '@/types/crm';
import { toast } from 'sonner';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const {
    leads,
    sequences,
    team,
    activities,
    updateLead,
    deleteLead,
    archiveLead,
    enrichLead,
    markReply,
    advanceLeadStep,
    assignSequenceToLead,
  } = useCRM();

  const lead = leads.find((l) => l.id === id);
  const leadActivities = activities.filter((a) => a.leadId === id);
  const sequence = lead?.sequenceId ? sequences.find((s) => s.id === lead.sequenceId) : null;

  // Drawer / Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEnrichOpen, setIsEnrichOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedSeqToAssign, setSelectedSeqToAssign] = useState<string>('');

  // Enrichment fields
  const [enrichPhone, setEnrichPhone] = useState(lead?.enrichedData?.phone || lead?.phone || '');
  const [enrichSize, setEnrichSize] = useState(lead?.enrichedData?.companySize || '100-250 employees');
  const [enrichRev, setEnrichRev] = useState(lead?.enrichedData?.annualRevenue || '$25M - $50M');
  const [enrichTech, setEnrichTech] = useState(lead?.enrichedData?.techStack?.join(', ') || 'HubSpot, React, AWS, Postgres');
  const [enrichNotes, setEnrichNotes] = useState(lead?.enrichedData?.enrichmentNotes || 'Verified corporate contact. High fit for Q4 expansion.');

  if (!lead) {
    return (
      <div className="py-16 text-center space-y-3">
        <h3 className="text-base font-semibold text-[#33475b]">Lead Not Found</h3>
        <p className="text-xs text-slate-500">The lead may have been deleted or is inaccessible.</p>
        <Link href={ROUTES.LEADS}>
          <Button variant="outline" size="sm" className="border-[#cbd6e2] text-[#33475b]">
            Back to Leads
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
    updateLead(lead.id, { connectionStatus: status });
    toast.success(`LinkedIn connection updated to: ${status}`);
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
              onClick={() => advanceLeadStep(lead.id)}
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => archiveLead(lead.id, !isArchived)}
            className="h-8 text-xs gap-1.5 border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
          >
            <Archive className="h-3.5 w-3.5 text-slate-400" />
            <span>{isArchived ? 'Restore' : 'Archive'}</span>
          </Button>

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
                      : lead.connectionStatus === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : lead.connectionStatus === 'declined'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {lead.connectionStatus === 'connected' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : lead.connectionStatus === 'pending' ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span className="capitalize">Connection: {lead.connectionStatus}</span>
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
              <span className="font-bold text-[#33475b]">{lead.assignedToName}</span>
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
                className={`h-8 text-xs font-semibold ${
                  lead.connectionStatus === 'connected'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                <span>Accepted</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'pending' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('pending')}
                className={`h-8 text-xs font-semibold ${
                  lead.connectionStatus === 'pending'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span>Pending</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'declined' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('declined')}
                className={`h-8 text-xs font-semibold ${
                  lead.connectionStatus === 'declined'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'border-[#cbd6e2] text-slate-700 hover:bg-[#f5f8fa]'
                }`}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                <span>Declined</span>
              </Button>

              <Button
                size="sm"
                variant={lead.connectionStatus === 'not_connected' ? 'primary' : 'outline'}
                onClick={() => handleSetConnectionStatus('not_connected')}
                className={`h-8 text-xs font-semibold ${
                  lead.connectionStatus === 'not_connected'
                    ? 'bg-slate-700 text-white'
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

          {/* SDR & Account Info */}
          {/* <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px] pb-2 border-b border-[#dfe3eb]">
              Account &amp; Assignment
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Assigned Representative</span>
                <p className="font-bold text-[#33475b] mt-0.5">{lead.assignedToName}</p>
                <p className="text-[11px] text-slate-500">{lead.assignedToEmail}</p>
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
          </div> */}
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
                    {lead.outreachStatus.replace('_', ' ')}
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
                  <p className="text-[10px] uppercase font-bold text-slate-400">Due Date</p>
                  <p className="font-bold text-[#33475b] mt-0.5">
                    {lead.nextFollowUpDate || 'None'}
                  </p>
                </div>
              </div>

              {/* Step Sequence Timeline or Empty Enrollment Card */}
              {!sequence ? (
                <div className="p-6 rounded-lg border border-dashed border-[#cbd6e2] bg-[#f8fafc] text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center mx-auto">
                    <Linkedin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#2d3e50] text-sm">No Outreach Sequence Assigned</h4>
                    <p className="text-xs text-[#516f90] max-w-md mx-auto mt-0.5">
                      Assign {lead.firstName} to an active LinkedIn sequence cadence to schedule outreach tasks and start follow-ups.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-2">
                    <select
                      value={selectedSeqToAssign}
                      onChange={(e) => setSelectedSeqToAssign(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded border border-[#cbd6e2] bg-white text-[#2d3e50] focus:border-[#ff7a59] focus:outline-hidden"
                    >
                      <option value="">Choose a Sequence...</option>
                      {sequences.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.steps.length} steps) {s.approvalStatus === 'approved' ? '✓ Approved' : ''}
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
                      className="h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold shadow-xs cursor-pointer"
                    >
                      <span>Enroll in Sequence</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-[#33475b]">
                      Cadence Steps ({lead.currentStepNumber} of {sequence.steps.length} completed)
                    </p>
                    {lead.outreachStatus !== 'completed' && lead.outreachStatus !== 'replied' && (
                      <Button
                        size="sm"
                        onClick={() => advanceLeadStep(lead.id)}
                        className="h-7 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold"
                      >
                        <Send className="h-3 w-3 mr-1" />
                        <span>Send Next LinkedIn Step</span>
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {sequence.steps.map((st) => {
                      const isCompleted = st.stepNumber < lead.currentStepNumber || lead.outreachStatus === 'completed';
                      const isCurrent = st.stepNumber === lead.currentStepNumber && lead.outreachStatus !== 'completed';

                      return (
                        <div
                          key={st.id}
                          className={`p-3 rounded border transition-colors ${
                            isCurrent
                              ? 'border-[#b2d5e5] bg-[#f0f9fb]'
                              : isCompleted
                              ? 'border-[#dfe3eb] bg-[#f5f8fa] text-slate-500'
                              : 'border-[#dfe3eb] bg-white text-slate-400'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : isCurrent
                                  ? 'bg-[#ff7a59] text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isCompleted ? <Check className="h-3 w-3" /> : st.stepNumber}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#33475b] text-xs">
                                  {st.title}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {st.delayDays === 0 ? 'Immediately' : `+${st.delayDays}d delay`}
                                </span>
                              </div>

                              {st.messageTemplate && (
                                <div className="mt-1.5 p-2 rounded bg-white border border-[#dfe3eb] text-[11px] text-slate-700">
                                  <p className="font-mono text-[10px] text-slate-500 mb-0.5">Template:</p>
                                  {st.messageTemplate
                                    .replace('{{firstName}}', lead.firstName)
                                    .replace('{{company}}', lead.company)}
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
                        <span className="text-[10px] text-slate-400">{formatDate(act.timestamp)}</span>
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
