'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  Archive,
  ArrowRight,
  ExternalLink,
  Layers,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  AlertCircle,
  Check,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date';
import { Sequence, SequenceStep } from '@/types/crm';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from 'sonner';

export default function SequencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');

  const {
    sequences,
    leads,
    saveSequence,
    approveSequence,
    duplicateSequence,
    toggleSequenceStatus,
    deleteSequence,
  } = useCRM();

  const { user, role, isAdmin } = useAuthContext();
  const isOwnerOrAdmin = isAdmin || user?.role === 'admin' || role === 'admin';

  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [deletingSeqId, setDeletingSeqId] = useState<string | null>(null);

  // New sequence modal state
  const [isCreating, setIsCreating] = useState(initialAction === 'new');
  const [newSeqName, setNewSeqName] = useState('');
  const [newSeqDesc, setNewSeqDesc] = useState('');

  const filteredSequences = sequences.filter((s) => {
    if (filterStatus === 'approved') return s.approvalStatus === 'approved';
    if (filterStatus === 'pending') return s.approvalStatus !== 'approved';
    return true;
  });

  const handleCreateSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeqName.trim()) return;

    const defaultSteps: SequenceStep[] = [
      {
        id: `step_li_${Date.now()}_1`,
        stepNumber: 1,
        actionType: 'connection_request',
        title: 'Send LinkedIn Connection Request',
        delayDays: 0,
        messageTemplate: 'Hi {{firstName}}, noticed your work at {{company}}. Would love to connect and follow your journey.',
        enabled: true,
      },
      {
        id: `step_li_${Date.now()}_2`,
        stepNumber: 2,
        actionType: 'wait_for_acceptance',
        title: 'Wait for Connection Acceptance',
        delayDays: 2,
        enabled: true,
      },
      {
        id: `step_li_${Date.now()}_3`,
        stepNumber: 3,
        actionType: 'send_message',
        title: 'Send Initial Value Proposition Message',
        delayDays: 1,
        messageTemplate: 'Thanks for connecting, {{firstName}}! How is {{company}} optimizing sales pipeline this quarter?',
        enabled: true,
      },
      {
        id: `step_li_${Date.now()}_4`,
        stepNumber: 4,
        actionType: 'followup',
        title: 'Follow-up Case Study Nudge',
        delayDays: 3,
        messageTemplate: 'Quick follow-up {{firstName}}—open to a brief 5-min walkthrough of our pipeline results next week?',
        enabled: true,
      },
      {
        id: `step_li_${Date.now()}_5`,
        stepNumber: 5,
        actionType: 'complete_details',
        title: 'Complete Details & Outcome Review',
        delayDays: 2,
        enabled: true,
      },
    ];

    const newSeq: Sequence = {
      id: `seq_${Date.now()}`,
      name: newSeqName.trim(),
      channel: 'linkedin',
      description: newSeqDesc.trim() || 'LinkedIn multi-step outbound cadence',
      status: isAdmin ? 'active' : 'draft',
      approvalStatus: isAdmin ? 'approved' : 'pending',
      approvedBy: isAdmin ? (user?.displayName || 'Admin') : undefined,
      approvedAt: isAdmin ? new Date().toISOString() : undefined,
      enrolledLeadsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: defaultSteps,
    };

    saveSequence(newSeq);
    setIsCreating(false);
    setNewSeqName('');
    setNewSeqDesc('');
    toast.success(
      isAdmin
        ? `Sequence "${newSeq.name}" created and approved!`
        : `Sequence "${newSeq.name}" created! Awaiting Admin approval per Decision 3.`
    );
    router.push(ROUTES.SEQUENCE_DETAIL(newSeq.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#33475b]">
            LinkedIn Outreach Sequences
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure approved multi-step LinkedIn messaging cadences aligned with the decision tree.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={ROUTES.WALKTHROUGH}>
            <Button variant="outline" size="sm" className="h-8 text-xs border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa] gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-[#0091ae]" />
              <span>Canvas Decision Tree</span>
            </Button>
          </Link>

          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Sequence</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#dfe3eb] pb-2 text-xs">
        <div className="flex items-center gap-1">
          {[
            { key: 'all', label: `All Sequences (${sequences.length})` },
            { key: 'approved', label: `Approved (${sequences.filter((s) => s.approvalStatus === 'approved').length})` },
            { key: 'pending', label: `Awaiting Approval (${sequences.filter((s) => s.approvalStatus === 'pending').length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as any)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                filterStatus === tab.key
                  ? 'bg-[#2d3e50] text-white'
                  : 'text-slate-600 hover:text-[#33475b] hover:bg-[#f5f8fa]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sequences Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSequences.map((seq) => {
          const activeLeadsForSeq = leads.filter(
            (l) => l.sequenceId === seq.id && l.disposition !== 'archived'
          );
          const isApproved = seq.approvalStatus === 'approved';

          return (
            <div
              key={seq.id}
              className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs flex flex-col justify-between hover:border-[#b2d5e5] transition-colors text-xs space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded bg-[#e8f3f8] px-2 py-0.5 text-[10px] font-semibold text-[#0077b5] border border-[#b2d5e5]">
                    <Linkedin className="h-2.5 w-2.5" />
                    <span>LinkedIn Cadence</span>
                  </span>

                  {/* Approval Status Badge */}
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                      isApproved
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isApproved ? 'Approved' : 'Awaiting Approval'}
                  </span>
                </div>

                <div>
                  <Link
                    href={ROUTES.SEQUENCE_DETAIL(seq.id)}
                    className="font-bold text-sm text-[#33475b] hover:text-[#ff7a59] hover:underline"
                  >
                    {seq.name}
                  </Link>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {seq.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#dfe3eb] text-[11px]">
                  <div>
                    <span className="text-slate-400 font-medium">Steps:</span>{' '}
                    <span className="font-semibold text-[#33475b]">
                      {seq.steps.length} ordered actions
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Enrolled:</span>{' '}
                    <span className="font-semibold text-[#33475b]">
                      {activeLeadsForSeq.length} leads
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-[#dfe3eb] flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {/* Admin 1-Click Approve Button */}
                  {!isApproved && isOwnerOrAdmin && (
                    <Button
                      size="sm"
                      onClick={() => approveSequence(seq.id, user?.displayName || user?.email || 'Admin')}
                      className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 cursor-pointer"
                      title="Approve this sequence as Admin"
                    >
                      <Check className="h-3 w-3" />
                      <span>Approve</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSequenceStatus(seq.id)}
                    className="h-7 px-2 text-slate-600 hover:text-[#33475b] text-xs"
                    title={seq.status === 'active' ? 'Pause Sequence' : 'Resume Sequence'}
                  >
                    {seq.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => duplicateSequence(seq.id)}
                    className="h-7 px-2 text-slate-600 hover:text-[#33475b] text-xs"
                    title="Duplicate Sequence"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingSeqId(seq.id)}
                    className="h-7 px-2 text-slate-400 hover:text-rose-600 text-xs"
                    title="Delete Sequence"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Link href={ROUTES.SEQUENCE_DETAIL(seq.id)}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-[#cbd6e2] text-[#0091ae] hover:bg-[#f5f8fa] font-semibold">
                    <span>Open Builder</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Sequence Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b]">
                Create LinkedIn Outreach Sequence
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Build a multi-step LinkedIn connection and messaging cadence.
              </p>
            </div>

            <form onSubmit={handleCreateSequence} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Sequence Name <span className="text-[#ff7a59]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSeqName}
                  onChange={(e) => setNewSeqName(e.target.value)}
                  placeholder="e.g. Series A Tech Founders LinkedIn Outbound"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="p-3 rounded bg-[#f5f8fa] border border-[#dfe3eb] flex items-center gap-2.5">
                <Linkedin className="h-4 w-4 text-[#0077b5]" />
                <div>
                  <p className="font-bold text-[#33475b] text-xs">LinkedIn Connection &amp; InMail Workflow</p>
                  <p className="text-[11px] text-slate-500">Includes connection request gate, acceptance listener, and follow-ups.</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newSeqDesc}
                  onChange={(e) => setNewSeqDesc(e.target.value)}
                  placeholder="Target audience, persona, or purpose..."
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreating(false)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Create Sequence &amp; Open Builder
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSeqId}
        title="Delete Sequence"
        description="Are you sure you want to delete this sequence? Leads enrolled in this sequence will become unassigned."
        confirmLabel="Delete Sequence"
        onConfirm={() => {
          if (deletingSeqId) {
            deleteSequence(deletingSeqId);
            setDeletingSeqId(null);
          }
        }}
        onClose={() => setDeletingSeqId(null)}
      />
    </div>
  );
}
