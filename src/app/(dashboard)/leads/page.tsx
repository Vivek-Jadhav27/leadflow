'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Archive,
  Edit2,
  Copy,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  UserCheck,
  Eye,
  RotateCcw,
  Sparkles,
  GitBranch,
  Send,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { Lead, LinkedInConnectionStatus, TeamMember } from '@/types/crm';
import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { BulkUploadModal } from '@/components/leads/BulkUploadModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/date';
import { toast } from 'sonner';

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');
  const initialFilter = searchParams.get('filter') || searchParams.get('status');

  const { user, isAdmin, currentWorkspace } = useAuthContext();

  const {
    leads,
    sequences,
    team,
    updateLead,
    deleteLead,
    archiveLead,
    bulkAssign,
    bulkArchive,
    bulkMarkConnectionSent,
    bulkDelete,
    assignSequenceToLead,
    bulkAssignSequence,
  } = useCRM();

  // Team members list strictly EXCLUDING admin/owner accounts per user requirement
  const availableTeamMembers = useMemo(() => {
    const list: TeamMember[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    // Helper to check if role or name indicates admin
    const isMemberAdmin = (roleStr?: string, nameStr?: string) => {
      const r = (roleStr || '').toLowerCase();
      const n = (nameStr || '').toLowerCase();
      return r.includes('admin') || r.includes('owner') || n.includes('admin') || n.includes('owner');
    };

    // 1. Add all SDR team members from store (strictly excluding admins)
    team.forEach((m) => {
      if (!isMemberAdmin(m.role, m.name) && !seenIds.has(m.id)) {
        seenIds.add(m.id);
        if (m.email) seenEmails.add(m.email.toLowerCase().trim());
        list.push(m);
      }
    });

    // 2. If currently logged in user is not admin (SDR or AE), ensure their real name is registered
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

    // 3. Discover SDRs assigned to or who captured leads
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

  // Drawers & Modals
  const [drawerOpen, setDrawerOpen] = useState(initialAction === 'new');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkSequenceMenuOpen, setBulkSequenceMenuOpen] = useState(false);
  const [assigningSequenceLeadId, setAssigningSequenceLeadId] = useState<string | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionFilter, setConnectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter || 'all');
  const [sequenceFilter, setSequenceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [viewArchived, setViewArchived] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'company' | 'nextFollowUp'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignMenuOpen, setBulkAssignMenuOpen] = useState(false);

  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Filter & Sort leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        // 1. Strict Workspace Isolation: lead must belong to active workspace
        if (currentWorkspace?.workspaceId) {
          if (lead.workspaceId && lead.workspaceId !== currentWorkspace.workspaceId) {
            return false;
          }
        }

        // 2. Role-based Access Control:
        // Individual reps (SDR or AE) see ONLY leads added by them or assigned to them by admin
        if (!isAdmin) {
          const userEmailNorm = (user?.email || '').toLowerCase().trim();
          const leadAssignedEmail = (lead.assignedToEmail || '').toLowerCase().trim();
          const leadCapturedEmail = (lead.capturedBy || '').toLowerCase().trim();
          const isOwnerOrAssigned =
            (user?.uid && lead.assignedToId === user.uid) ||
            (user?.uid && lead.capturedByUid === user.uid) ||
            (userEmailNorm && leadAssignedEmail && leadAssignedEmail === userEmailNorm) ||
            (userEmailNorm && leadCapturedEmail && leadCapturedEmail === userEmailNorm);
          if (!isOwnerOrAssigned) return false;
        }

        // Active vs Archived
        if (viewArchived) {
          if (lead.disposition !== 'archived') return false;
        } else {
          if (lead.disposition === 'archived') return false;
        }

        // Connection Gate filter
        if (connectionFilter !== 'all' && lead.connectionStatus !== connectionFilter) return false;

        // Sequence filter
        if (sequenceFilter !== 'all' && lead.sequenceId !== sequenceFilter) return false;

        // Owner filter
        if (ownerFilter !== 'all' && lead.assignedToId !== ownerFilter) return false;

        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'in_sequence') {
            if (lead.outreachStatus !== 'in_sequence' && lead.outreachStatus !== 'followup_due') return false;
          } else if (statusFilter === 'replied') {
            if (lead.outreachStatus !== 'replied' && lead.disposition !== 'meeting_booked') return false;
          } else if (statusFilter === 'meeting_booked') {
            if (lead.disposition !== 'meeting_booked' && lead.outcome !== 'Meeting Booked') return false;
          } else if (statusFilter === 'complete_details') {
            if (lead.disposition !== 'complete_details') return false;
          } else if (statusFilter === 'enriched') {
            if (lead.disposition !== 'enriched') return false;
          } else if (lead.outreachStatus !== statusFilter) {
            return false;
          }
        }

        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
          const comp = lead.company.toLowerCase();
          const em = (lead.email || '').toLowerCase();
          const job = lead.jobTitle.toLowerCase();
          if (!fullName.includes(q) && !comp.includes(q) && !em.includes(q) && !job.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'createdAt') {
          comp = a.createdAt.localeCompare(b.createdAt);
        } else if (sortBy === 'name') {
          comp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        } else if (sortBy === 'company') {
          comp = a.company.localeCompare(b.company);
        } else if (sortBy === 'nextFollowUp') {
          comp = (a.nextFollowUpDate || '9999').localeCompare(b.nextFollowUpDate || '9999');
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [leads, viewArchived, connectionFilter, statusFilter, sequenceFilter, ownerFilter, searchQuery, sortBy, sortOrder]);

  // Pagination (25 leads per page batch)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to first page when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, connectionFilter, statusFilter, sequenceFilter, ownerFilter, viewArchived, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLeads.length);
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  const isAllPageSelected =
    paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedIds.includes(l.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedLeads.map((l) => l.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIdSet = new Set(paginatedLeads.map((l) => l.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Export to real CSV
  const handleExportCSV = (selectedOnly: boolean = false) => {
    const dataToExport = selectedOnly
      ? leads.filter((l) => selectedIds.includes(l.id))
      : filteredLeads;

    if (dataToExport.length === 0) {
      toast.error('No leads to export');
      return;
    }

    const headers = [
      'First Name',
      'Last Name',
      'Company',
      'Job Title',
      'Email',
      'Phone',
      'LinkedIn URL',
      'Sequence',
      'Step',
      'Connection Gate',
      'Outreach Status',
      'Outcome',
      'Representative',
      'Next Follow-up',
      'Date Added',
    ];

    const rows = dataToExport.map((l) => [
      `"${l.firstName}"`,
      `"${l.lastName}"`,
      `"${l.company}"`,
      `"${l.jobTitle}"`,
      `"${l.email}"`,
      `"${l.phone || ''}"`,
      `"${l.linkedinUrl}"`,
      `"${l.sequenceName || 'Unassigned'}"`,
      l.currentStepNumber,
      `"${l.connectionStatus}"`,
      `"${l.outreachStatus}"`,
      `"${l.outcome || l.disposition}"`,
      `"${l.assignedToName}"`,
      `"${l.nextFollowUpDate || ''}"`,
      `"${l.createdAt.split('T')[0]}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leadflow_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${dataToExport.length} leads to CSV`);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingLeadId) return;
    setIsDeleting(true);
    try {
      const ok = await deleteLead(deletingLeadId);
      if (ok) setSelectedIds((prev) => prev.filter((id) => id !== deletingLeadId));
    } finally {
      setIsDeleting(false);
      setDeletingLeadId(null);
    }
  };

  // Status badge styling helper
  const renderConnectionBadge = (lead: Lead) => {
    if (lead.connectionStatus === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#def3e9] px-2 py-0.5 text-[10px] font-bold text-[#00a389]">
          <Linkedin className="h-2.5 w-2.5" />
          Connected
        </span>
      );
    }
    if (lead.connectionStatus === 'request_sent') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#e7f7fa] px-2 py-0.5 text-[10px] font-bold text-[#0091ae]">
          Request Sent
        </span>
      );
    }
    if (lead.connectionStatus === 'request_pending') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#fef4e8] px-2 py-0.5 text-[10px] font-bold text-[#d49a19]">
          Pending
        </span>
      );
    }
    if (lead.connectionStatus === 'declined') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[#fde8e8] px-2 py-0.5 text-[10px] font-bold text-[#d34c58]">
          Declined
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-[#f5f8fa] text-[#7c98b6]">
        Not Started
      </span>
    );
  };

  const renderOutcomeBadge = (lead: Lead) => {
    if (lead.disposition === 'archived') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-[#f5f8fa] text-[#7c98b6] border border-[#dfe3eb]">
          Archived
        </span>
      );
    }
    if (lead.disposition === 'meeting_booked' || lead.outcome === 'Meeting Booked') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#def3e9] text-[#00a389] border border-[#c2ebd7]">
          Meeting Booked
        </span>
      );
    }
    if (lead.disposition === 'enriched') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#def3e9] text-[#00a389] border border-[#c2ebd7]">
          Enriched
        </span>
      );
    }
    if (lead.disposition === 'complete_details') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#f2eefd] text-[#7d5bd6] border border-[#e1d9fc]">
          Complete Details
        </span>
      );
    }
    if (lead.outreachStatus === 'replied') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#e7f7fa] text-[#0091ae] border border-[#bee7ee]">
          Reply Received
        </span>
      );
    }
    if (lead.outreachStatus === 'followup_due') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#fef4e8] text-[#d49a19] border border-[#fbdca7]">
          Follow-up Due
        </span>
      );
    }
    if (lead.outreachStatus === 'stopped') {
      return (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#fde8e8] text-[#d34c58] border border-[#f8bebe]">
          Stopped / Lost
        </span>
      );
    }
    const displayStatus = (!lead.sequenceId && lead.outreachStatus === 'in_sequence')
      ? 'unassigned'
      : (lead.outreachStatus || 'unassigned');

    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-[#f5f8fa] text-[#516f90] border border-[#dfe3eb] capitalize">
        {displayStatus.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#dfe3eb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#2d3e50]">
              {viewArchived ? 'Archived Contacts' : 'Target Prospects & Accounts'}
            </h1>
            <span className="rounded-full bg-[#eaf0f6] px-2 py-0.5 text-xs font-bold text-[#516f90]">
              {filteredLeads.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Active vs Archived */}
          {/* <button
            onClick={() => {
              setViewArchived((v) => !v);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              viewArchived
                ? 'border-[#ff7a59] bg-[#fef4e8] text-[#ff7a59]'
                : 'border-[#dfe3eb] text-[#516f90] hover:bg-[#f5f8fa]'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{viewArchived ? 'Viewing Archived' : 'Archive Filter'}</span>
          </button> */}

          {/* Export CSV button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV(false)}
            className="h-8 gap-1.5 text-xs text-[#516f90] border-[#dfe3eb]"
            title="Download CSV"
          >
            <Download className="h-3.5 w-3.5 text-[#7c98b6]" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          {/* Bulk Import CSV button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkUploadOpen(true)}
            className="h-8 gap-1.5 text-xs text-[#33475b] border-[#cbd8eb] hover:bg-[#f5f8fa] font-medium"
            title="Upload Leads via CSV"
          >
            <Upload className="h-3.5 w-3.5 text-[#ff7a59]" />
            <span>Import CSV</span>
          </Button>

          {/* Add Lead button */}
          <Button
            size="sm"
            onClick={() => {
              setEditingLead(null);
              setDrawerOpen(true);
            }}
            className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06646] text-white text-xs font-bold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Capture Lead</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-[#dfe3eb] bg-white p-3 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7c98b6]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name, company, email, or job title..."
              className="w-full rounded-md border border-[#cbd8eb] bg-[#f5f8fa] pl-9 pr-3 py-1.5 text-xs text-[#33475b] placeholder:text-[#7c98b6] focus:outline-none focus:border-[#ff7a59]"
            />
          </div>

          {/* Connection Gate Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={connectionFilter}
              onChange={(e) => setConnectionFilter(e.target.value)}
              className="rounded-md border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs text-[#33475b] focus:outline-none"
            >
              <option value="all">All Connection States</option>
              <option value="connected">Connected</option>
              <option value="request_sent">Request Sent</option>
              <option value="request_pending">Pending</option>
              <option value="declined">Declined / Withdrawn</option>
            </select>

            {/* Outcome / Status selector */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs text-[#33475b] focus:outline-none"
            >
              <option value="all">All Outcomes</option>
              <option value="in_sequence">In Active Cadence</option>
              <option value="followup_due">Follow-up Due</option>
              <option value="replied">Reply Received</option>
              <option value="meeting_booked">Meeting Booked</option>
              <option value="complete_details">Complete Details</option>
              <option value="enriched">Enriched</option>
            </select>

            {/* Sequence filter */}
            <select
              value={sequenceFilter}
              onChange={(e) => setSequenceFilter(e.target.value)}
              className="rounded-md border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs text-[#33475b] focus:outline-none hidden sm:block"
            >
              <option value="all">All Sequences</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Owner filter */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-md border border-[#cbd8eb] bg-white px-2.5 py-1.5 text-xs text-[#33475b] focus:outline-none hidden md:block"
            >
              <option value="all">All Reps</option>
              {availableTeamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="rounded-lg border border-[#0091ae]/30 bg-[#e7f7fa] px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2 font-bold text-[#007a8c]">
            <span>{selectedIds.length} lead{selectedIds.length > 1 ? 's' : ''} selected</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkAssignMenuOpen((v) => !v)}
                  className="h-7 text-xs bg-white text-[#33475b] gap-1"
                >
                  <UserCheck className="h-3 w-3 text-[#7c98b6]" />
                  <span>Assign Owner</span>
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>

                {bulkAssignMenuOpen && (
                  <div className="absolute right-0 mt-1 w-44 rounded-md border border-[#dfe3eb] bg-white p-1 shadow-lg z-50">
                    {availableTeamMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          bulkAssign(selectedIds, m.id);
                          setBulkAssignMenuOpen(false);
                          setSelectedIds([]);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] text-[#33475b] text-xs font-semibold"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bulk: record that the LinkedIn connection request was sent */}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const n = selectedIds.length;
                if (!confirm(`Mark ${n} lead${n > 1 ? 's' : ''} as connection request sent on LinkedIn?`)) return;
                const res = await bulkMarkConnectionSent(selectedIds);
                if (res) setSelectedIds([]);
              }}
              className="h-7 text-xs bg-white text-[#33475b] gap-1 cursor-pointer"
              title="Record that you sent the LinkedIn connection request to these leads"
            >
              <Send className="h-3 w-3 text-[#0091ae]" />
              <span>Mark Connection Sent</span>
            </Button>

            {/* Bulk Enroll in Sequence */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkSequenceMenuOpen((v) => !v)}
                className="h-7 text-xs bg-white text-[#33475b] gap-1 cursor-pointer"
              >
                <GitBranch className="h-3 w-3 text-[#0091ae]" />
                <span>Enroll in Sequence</span>
                <ChevronDown className="h-2.5 w-2.5" />
              </Button>

              {bulkSequenceMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 rounded-md border border-[#dfe3eb] bg-white p-1 shadow-lg z-50">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-[#f0f4f8]">
                    Choose Sequence
                  </div>
                  {sequences.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        bulkAssignSequence(selectedIds, s.id);
                        setBulkSequenceMenuOpen(false);
                        setSelectedIds([]);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] text-[#33475b] text-xs font-semibold truncate"
                    >
                      {s.name} ({s.steps.length} steps)
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      bulkAssignSequence(selectedIds, null);
                      setBulkSequenceMenuOpen(false);
                      setSelectedIds([]);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-rose-50 text-rose-600 text-xs font-semibold border-t border-[#f0f4f8] mt-1"
                  >
                    Unenroll from Sequence
                  </button>
                </div>
              )}
            </div>

            {/* <Button
              size="sm"
              variant="outline"
              onClick={() => {
                bulkArchive(selectedIds);
                setSelectedIds([]);
              }}
              className="h-7 text-xs bg-white text-[#33475b] gap-1"
            >
              <Archive className="h-3 w-3 text-[#7c98b6]" />
              <span>Archive</span>
            </Button> */}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExportCSV(true)}
              className="h-7 text-xs bg-white text-[#33475b] gap-1"
            >
              <Download className="h-3 w-3 text-[#7c98b6]" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`Delete ${selectedIds.length} leads? This cannot be undone.`)) {
                  bulkDelete(selectedIds);
                  setSelectedIds([]);
                }
              }}
              className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </Button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-[#0091ae] hover:underline ml-2 font-bold"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Leads Table Container */}
      <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#33475b]">
            <thead className="bg-[#f5f8fa] text-[10px] uppercase font-bold text-[#516f90] border-b border-[#dfe3eb]">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={handleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#ff7a59] focus:ring-[#ff7a59] cursor-pointer"
                  />
                </th>

                <th
                  onClick={() => {
                    setSortBy('name');
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-[#2d3e50]"
                >
                  <div className="flex items-center gap-1">
                    <span>Prospect Name &amp; Title</span>
                    <ArrowUpDown className="h-3 w-3 text-[#7c98b6]" />
                  </div>
                </th>

                <th
                  onClick={() => {
                    setSortBy('company');
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-[#2d3e50]"
                >
                  <div className="flex items-center gap-1">
                    <span>Company</span>
                    <ArrowUpDown className="h-3 w-3 text-[#7c98b6]" />
                  </div>
                </th>

                <th className="px-4 py-3 whitespace-nowrap">Connection Status</th>

                <th className="px-4 py-3">Assigned Sequence</th>

                <th className="px-4 py-3">Lead Outcome</th>

                <th className="px-4 py-3">Representative</th>

                <th
                  onClick={() => {
                    setSortBy('nextFollowUp');
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  }}
                  className="px-4 py-3 cursor-pointer hover:text-[#2d3e50]"
                >
                  <div className="flex items-center gap-1">
                    <span>Next Follow-up</span>
                    <ArrowUpDown className="h-3 w-3 text-[#7c98b6]" />
                  </div>
                </th>

                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eaf0f6]">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#7c98b6]">
                    <p className="font-bold text-[#2d3e50]">No leads found</p>
                    <p className="text-[11px] mt-1">Adjust filters or click &quot;Capture Lead&quot; to add one.</p>
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedIds.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-[#e7f7fa]/50'
                          : 'hover:bg-[#f9fbff]'
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(lead.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#ff7a59] focus:ring-[#ff7a59] cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={ROUTES.LEAD_DETAIL(lead.id)}
                            className="font-bold text-[#2d3e50] hover:text-[#ff7a59] hover:underline truncate"
                          >
                            {lead.firstName} {lead.lastName}
                          </Link>
                          <span className="text-[11px] text-[#7c98b6] truncate">
                            {lead.jobTitle}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-[#2d3e50] whitespace-nowrap">
                        {lead.company}
                      </td>
{/* 
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 group">
                          <span className="truncate max-w-[150px] text-[#516f90]">
                            {lead.email}
                          </span>
                          <button
                            onClick={() => handleCopyEmail(lead.email || '')}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#7c98b6] hover:text-[#2d3e50] transition-opacity"
                            title="Copy email"
                          >
                            {copiedEmail === lead.email ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center">
                        {lead.linkedinUrl ? (
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex p-1 rounded text-[#0091ae] hover:bg-[#e7f7fa]"
                            title="Open LinkedIn Profile"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td> */}

                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderConnectionBadge(lead)}
                      </td>

                      <td className="px-4 py-3 relative">
                        {lead.sequenceName ? (
                          <div className="flex items-center gap-1 group/seq">
                            <span className="truncate max-w-[130px] block font-semibold text-[#2d3e50]" title={lead.sequenceName}>
                              {lead.sequenceName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAssigningSequenceLeadId(assigningSequenceLeadId === lead.id ? null : lead.id)}
                              className="opacity-0 group-hover/seq:opacity-100 text-[10px] text-[#0091ae] hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAssigningSequenceLeadId(assigningSequenceLeadId === lead.id ? null : lead.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-[#0091ae] bg-[#e5f5f8] hover:bg-[#d6f0f5] border border-[#b2d5e5] transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Assign</span>
                          </button>
                        )}

                        {/* Inline Sequence Dropdown */}
                        {assigningSequenceLeadId === lead.id && (
                          <div className="absolute left-4 top-10 w-52 rounded-md border border-[#dfe3eb] bg-white p-1 shadow-xl z-50 text-xs">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-[#f0f4f8] flex items-center justify-between">
                              <span>Select Sequence</span>
                              <button
                                type="button"
                                onClick={() => setAssigningSequenceLeadId(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                ✕
                              </button>
                            </div>
                            {sequences.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  assignSequenceToLead(lead.id, s.id);
                                  setAssigningSequenceLeadId(null);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] text-[#33475b] text-xs font-semibold truncate"
                              >
                                {s.name} ({s.steps.length} steps)
                              </button>
                            ))}
                            {lead.sequenceId && (
                              <button
                                onClick={() => {
                                  assignSequenceToLead(lead.id, null);
                                  setAssigningSequenceLeadId(null);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-rose-50 text-rose-600 text-xs font-semibold border-t border-[#f0f4f8] mt-1"
                              >
                                Unenroll from Sequence
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderOutcomeBadge(lead)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const resolvedMember =
                            (lead.assignedToId ? availableTeamMembers.find((m) => m.id === lead.assignedToId) : null) ||
                            (lead.assignedToEmail ? availableTeamMembers.find((m) => m.email?.toLowerCase().trim() === lead.assignedToEmail?.toLowerCase().trim()) : null) ||
                            (lead.capturedBy ? availableTeamMembers.find((m) => m.email?.toLowerCase().trim() === lead.capturedBy?.toLowerCase().trim()) : null) ||
                            (lead.capturedByUid ? availableTeamMembers.find((m) => m.id === lead.capturedByUid) : null);

                          const effectiveAssignedId = lead.assignedToId || resolvedMember?.id || '';
                          const effectiveAssignedName = resolvedMember?.name || lead.assignedToName || (resolvedMember?.email ? resolvedMember.email.split('@')[0] : (lead.assignedToEmail ? lead.assignedToEmail.split('@')[0] : 'Unassigned'));

                          const userEmailNorm = (user?.email || '').toLowerCase().trim();
                          const isAssignedToUser =
                            (user?.uid && (effectiveAssignedId === user.uid || lead.capturedByUid === user.uid)) ||
                            (userEmailNorm && (
                              (lead.assignedToEmail && lead.assignedToEmail.toLowerCase().trim() === userEmailNorm) ||
                              (lead.capturedBy && lead.capturedBy.toLowerCase().trim() === userEmailNorm) ||
                              (resolvedMember?.email && resolvedMember.email.toLowerCase().trim() === userEmailNorm)
                            ));

                          if (isAdmin) {
                            return (
                              <div className="relative inline-block text-left">
                                <select
                                  value={effectiveAssignedId}
                                  onChange={(e) => {
                                    const newMemberId = e.target.value;
                                    if (!newMemberId) {
                                      toast.info('Every lead needs an owner. Choose a team member to reassign it.');
                                    } else {
                                      // Server action: moves the lead's open tasks and records the reassignment.
                                      void bulkAssign([lead.id], newMemberId);
                                    }
                                  }}
                                  className={`text-[11px] font-semibold rounded-md border px-2 py-1 pr-6 cursor-pointer transition-all focus:outline-none appearance-none bg-no-repeat bg-[right_6px_center] ${
                                    effectiveAssignedId
                                      ? 'border-[#cbd8eb] bg-white text-[#33475b] hover:border-[#ff7a59]'
                                      : 'border-dashed border-amber-300 bg-amber-50 text-amber-800 hover:border-amber-400'
                                  }`}
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%237c98b6%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")`,
                                  }}
                                  title="Click to shift / assign SDR"
                                >
                                  <option value="">Unassigned (Assign SDR)</option>
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
                            );
                          }

                          return (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] ${
                                isAssignedToUser
                                  ? 'font-bold text-[#ff7a59]'
                                  : 'font-medium text-[#516f90]'
                              }`}
                            >
                              {effectiveAssignedName}
                              {isAssignedToUser && (
                                <span className="rounded bg-[#ff7a59]/10 px-1.5 py-0.2 text-[9px] font-bold text-[#ff7a59]">
                                  You
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {lead.nextFollowUpDate ? (
                          <span
                            className={
                              lead.nextFollowUpDate < new Date().toISOString().split('T')[0]
                                ? 'text-rose-600 font-bold'
                                : 'text-[#33475b]'
                            }
                          >
                            {lead.nextFollowUpDate}
                          </span>
                        ) : (
                          <span className="text-[#7c98b6]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={ROUTES.LEAD_DETAIL(lead.id)}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#7c98b6] hover:text-[#ff7a59]"
                              title="View Lead Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingLead(lead);
                              setDrawerOpen(true);
                            }}
                            className="h-7 w-7 p-0 text-[#7c98b6] hover:text-[#2d3e50]"
                            title="Edit Lead"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          {/* <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => archiveLead(lead.id, lead.disposition !== 'archived')}
                            className="h-7 w-7 p-0 text-[#7c98b6] hover:text-[#2d3e50]"
                            title={lead.disposition === 'archived' ? 'Restore Lead' : 'Archive Lead'}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button> */}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingLeadId(lead.id)}
                            className="h-7 w-7 p-0 text-[#7c98b6] hover:text-rose-600"
                            title="Delete Lead"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          {filteredLeads.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#dfe3eb] bg-[#f8fafc] text-xs text-[#516f90]">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="text-[#2d3e50]">{startIndex + 1}</strong> to{' '}
                  <strong className="text-[#2d3e50]">{endIndex}</strong> of{' '}
                  <strong className="text-[#2d3e50]">{filteredLeads.length}</strong> leads
                </span>

                <div className="flex items-center gap-1.5 pl-3 border-l border-[#dfe3eb]">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded border border-[#cbd8eb] bg-white px-2 py-0.5 text-xs text-[#2d3e50] focus:border-[#ff7a59] focus:outline-none cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clampedPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2 text-xs border-[#cbd8eb] hover:bg-white disabled:opacity-40 cursor-pointer gap-0.5"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev</span>
                </Button>

                {/* Page Number Pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - clampedPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-slate-400">…</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`h-7 w-7 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            clampedPage === p
                              ? 'bg-[#ff7a59] text-white shadow-xs'
                              : 'text-[#33475b] hover:bg-[#dfe3eb]/50 border border-[#dfe3eb] bg-white'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={clampedPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2 text-xs border-[#cbd8eb] hover:bg-white disabled:opacity-40 cursor-pointer gap-0.5"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Drawer */}
      <AddLeadDrawer
        isOpen={drawerOpen}
        leadToEdit={editingLead}
        onClose={() => {
          setDrawerOpen(false);
          setEditingLead(null);
        }}
      />

      {/* Bulk CSV Upload Modal */}
      <BulkUploadModal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        sequences={sequences}
        team={team}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingLeadId}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? All associated sequence tasks and history will be permanently removed."
        confirmLabel="Delete Lead"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingLeadId(null)}
      />
    </div>
  );
}
