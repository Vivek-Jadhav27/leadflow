'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  GitBranch,
  Play,
  Pause,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Save,
  Clock,
  Send,
  Sparkles,
  Archive,
  Users,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Sequence, SequenceStep } from '@/types/crm';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { toast } from 'sonner';

export default function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'builder' | 'workflow' | 'leads') || 'builder';

  const {
    sequences,
    leads,
    saveSequence,
    approveSequence,
    toggleSequenceStatus,
    advanceLeadStep,
    assignSequenceToLead,
  } = useCRM();

  const { user, isAdmin, role } = useAuthContext();
  const isOwnerOrAdmin = isAdmin || user?.role === 'admin' || role === 'admin';

  const originalSequence = sequences.find((s) => s.id === id);

  const [activeTab, setActiveTab] = useState<'builder' | 'workflow' | 'leads'>(initialTab);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  const enrolledLeads = leads.filter((l) => l.sequenceId === originalSequence?.id);
  const targetLead =
    enrolledLeads[0] ||
    (originalSequence?.targetLeadId ? leads.find((l) => l.id === originalSequence.targetLeadId) : null) ||
    leads.find(
      (l) => originalSequence && originalSequence.name.toLowerCase().includes(`${l.firstName.toLowerCase()} ${l.lastName.toLowerCase()}`)
    ) ||
    leads.find(
      (l) => originalSequence && (
        originalSequence.name.toLowerCase().includes(l.firstName.toLowerCase()) ||
        originalSequence.name.toLowerCase().includes(l.lastName.toLowerCase())
      )
    );
  const isCustomCadence = Boolean(
    originalSequence?.isCustom ||
    originalSequence?.id.startsWith('seq_custom_') ||
    originalSequence?.name.toLowerCase().includes('custom cadence') ||
    originalSequence?.description?.toLowerCase().includes('bespoke') ||
    targetLead
  );

  const displayProspectName = targetLead
    ? `${targetLead.firstName} ${targetLead.lastName}`
    : (originalSequence?.targetLeadName || originalSequence?.name?.replace(/^custom cadence:\s*/i, '').trim());
  const displayCompany = targetLead?.company || originalSequence?.targetLeadCompany || (originalSequence?.description?.match(/at\s+([^.]+)/i)?.[1]?.trim());
  const displayLinkedin = targetLead?.linkedinUrl || originalSequence?.targetLeadLinkedin;
  const displayJobTitle = targetLead?.jobTitle || 'Target Prospect';
  const displayOwner = targetLead?.assignedToName || originalSequence?.createdBy || 'Assigned Rep';

  // Editable sequence state
  const [seqName, setSeqName] = useState(originalSequence?.name || '');
  const [seqDesc, setSeqDesc] = useState(originalSequence?.description || '');
  const [seqTargetRole, setSeqTargetRole] = useState<'all' | 'sdr' | 'ae'>(originalSequence?.targetRole || 'all');
  const [steps, setSteps] = useState<SequenceStep[]>(originalSequence?.steps || []);

  // Sync if sequence loaded
  React.useEffect(() => {
    if (originalSequence) {
      setSeqName(originalSequence.name);
      setSeqDesc(originalSequence.description);
      setSeqTargetRole(originalSequence.targetRole || (isCustomCadence ? 'sdr' : 'all'));

      const loadedSteps = [...originalSequence.steps];
      if (loadedSteps.length > 0 && targetLead) {
        const first = loadedSteps[0];
        const isPlaceholder =
          !first.messageTemplate ||
          first.messageTemplate === 'Connection request sent on LinkedIn' ||
          first.messageTemplate === 'Connection request sent manually on LinkedIn';
        if (isPlaceholder) {
          const actualNote =
            targetLead.connectionNote ||
            targetLead.notes?.match(/connection note:\s*(.+)/i)?.[1]?.trim() ||
            targetLead.notes?.match(/connection sent with note:\s*"?([^"]+)"?/i)?.[1]?.trim() ||
            (!targetLead.notes?.startsWith('Added to') && !targetLead.notes?.startsWith('Imported') && (targetLead.notes?.length || 0) > 5
              ? targetLead.notes
              : null);
          if (actualNote) {
            loadedSteps[0] = { ...first, messageTemplate: actualNote };
          }
        }
      }
      setSteps(loadedSteps);
    }
  }, [originalSequence, targetLead, isCustomCadence]);

  const isCreator =
    (user?.uid && originalSequence?.createdByUid === user.uid) ||
    (user?.email && originalSequence?.createdBy?.toLowerCase().trim() === user.email.toLowerCase().trim());
  const isAdminCreated =
    originalSequence?.createdByRole === 'admin' ||
    !originalSequence?.createdByUid ||
    originalSequence?.createdBy === 'Workspace Admin' ||
    (originalSequence?.createdBy && originalSequence.createdBy.toLowerCase().includes('admin'));
  const matchesTargetRole =
    !originalSequence?.targetRole ||
    originalSequence?.targetRole === 'all' ||
    originalSequence?.targetRole === role;

  const isUnauthorized = !isOwnerOrAdmin && originalSequence && !(isCreator || (isAdminCreated && matchesTargetRole));

  if (!originalSequence || isUnauthorized) {
    return (
      <div className="py-16 text-center space-y-3">
        <h3 className="text-base font-semibold text-[#33475b]">
          {isUnauthorized ? 'Access Restricted' : 'Sequence Not Found'}
        </h3>
        <p className="text-xs text-slate-500">
          {isUnauthorized
            ? 'This sequence was not created by you or designated for your role. Only administrators and authorized role holders may access it.'
            : 'The requested sequence does not exist or has been removed.'}
        </p>
        <Link href={ROUTES.SEQUENCES}>
          <Button variant="outline" size="sm" className="border-[#cbd6e2] text-[#33475b]">
            Back to Sequences
          </Button>
        </Link>
      </div>
    );
  }

  const isApproved = originalSequence.approvalStatus === 'approved';

  // Step reordering
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    // Re-index stepNumbers
    newSteps.forEach((s, i) => {
      s.stepNumber = i + 1;
    });

    setSteps(newSteps);
  };

  // Step removal
  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      toast.error('A sequence must contain at least one step.');
      return;
    }
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((s, i) => {
      s.stepNumber = i + 1;
    });
    setSteps(newSteps);
  };

  // Add new step
  const addStep = () => {
    const nextNum = steps.length + 1;
    const newStep: SequenceStep = {
      id: `step_${Date.now()}_${nextNum}`,
      stepNumber: nextNum,
      actionType: 'followup',
      title: `Follow-up ${nextNum}`,
      delayDays: 3,
      messageTemplate: 'Hi {{firstName}}, checking in on my previous LinkedIn message. Would love to share some insights on {{company}}.',
      enabled: true,
    };
    setSteps([...steps, newStep]);
  };

  // Update a single step
  const updateStep = (index: number, updates: Partial<SequenceStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  // Save changes
  const handleSave = () => {
    if (!seqName.trim()) {
      toast.error('Sequence name cannot be empty.');
      return;
    }
    if (steps.length === 0) {
      toast.error('A sequence must have at least one valid step.');
      return;
    }

    const updated: Sequence = {
      ...originalSequence,
      name: seqName.trim(),
      description: seqDesc.trim(),
      targetRole: isOwnerOrAdmin ? seqTargetRole : (originalSequence.targetRole || 'all'),
      steps,
    };

    void saveSequence(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={ROUTES.SEQUENCES}
            className="flex items-center gap-1 text-slate-500 hover:text-[#ff7a59] font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Sequences</span>
          </Link>
          <span className="text-[#cbd6e2]">/</span>
          <span className="font-bold text-[#33475b]">
            {originalSequence.name}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ml-1 ${
              isApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {isApproved ? 'Approved' : 'Awaiting Admin Approval'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Target Role Selector or Bespoke Badge */}
          {isCustomCadence ? (
            <span className="rounded px-2.5 py-1 text-[10px] font-bold border uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200">
              1:1 Bespoke Cadence · SDR Exclusive
            </span>
          ) : isOwnerOrAdmin ? (
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2 py-1 rounded border border-[#dfe3eb]">
              <span className="font-semibold text-slate-500">Target Role:</span>
              <select
                value={seqTargetRole}
                onChange={(e) => setSeqTargetRole(e.target.value as 'all' | 'sdr' | 'ae')}
                className="h-6 rounded border border-[#cbd6e2] px-1.5 text-xs font-semibold text-[#33475b] bg-white focus:outline-none"
              >
                <option value="all">Everyone (All)</option>
                <option value="sdr">SDR Only</option>
                <option value="ae">AE Only</option>
              </select>
            </div>
          ) : (
            <span className={`rounded px-2 py-1 text-[10px] font-bold border uppercase tracking-wider ${
              originalSequence.targetRole === 'ae'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : (originalSequence.targetRole === 'sdr'
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200')
            }`}>
              Role: {originalSequence.targetRole === 'ae' ? 'AE Only' : (originalSequence.targetRole === 'sdr' ? 'SDR Only' : 'All Roles')}
            </span>
          )}

          {/* Admin Approve Button */}
          {!isApproved && isOwnerOrAdmin && (
            <Button
              size="sm"
              onClick={() => approveSequence(originalSequence.id)}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Approve &amp; Activate (Decision 3)</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleSequenceStatus(originalSequence.id)}
            className="h-8 text-xs gap-1.5 border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
          >
            {originalSequence.status === 'active' ? (
              <>
                <Pause className="h-3.5 w-3.5 text-amber-600" />
                <span>Pause Sequence</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-600" />
                <span>Resume Sequence</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-semibold shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Sequence</span>
          </Button>
        </div>
      </div>

      {/* Target Prospect & Review Card (for 1:1 bespoke lead cadences) */}
      {(isCustomCadence && displayProspectName) && (
        <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50/90 to-slate-50 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0077b5]/10 text-[#0077b5] border border-[#0077b5]/20 flex items-center justify-center font-bold text-sm shrink-0">
              {displayProspectName[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm text-[#2d3e50]">
                  {displayProspectName}
                </h3>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                  Target Prospect
                </span>
                <span className="text-xs text-slate-500">
                  SDR Owner: <strong className="text-slate-700">{displayOwner}</strong>
                </span>
              </div>
              <p className="text-xs text-[#516f90] mt-0.5">
                {displayJobTitle} {displayCompany ? <span>at <strong className="text-[#33475b]">{displayCompany}</strong></span> : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {displayLinkedin && (
              <a
                href={displayLinkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs text-white bg-[#0077b5] hover:bg-[#006097] transition-colors cursor-pointer shadow-xs"
              >
                <Linkedin className="h-3.5 w-3.5" />
                <span>Open LinkedIn Profile</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {targetLead && (
              <Link
                href={ROUTES.LEAD_DETAIL(targetLead.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-semibold text-xs text-[#33475b] bg-white border border-[#cbd6e2] hover:bg-[#f8fafc] transition-colors"
              >
                <span>View Lead Journey</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#dfe3eb] text-xs">
        <button
          onClick={() => setActiveTab('builder')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'builder'
              ? 'border-[#ff7a59] text-[#ff7a59]'
              : 'border-transparent text-slate-500 hover:text-[#33475b]'
          }`}
        >
          LinkedIn Step Builder ({steps.length} Steps)
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          className={`py-2 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'workflow'
              ? 'border-[#ff7a59] text-[#ff7a59]'
              : 'border-transparent text-slate-500 hover:text-[#33475b]'
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span>Interactive Visual Workflow</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`py-2 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'leads'
              ? 'border-[#ff7a59] text-[#ff7a59]'
              : 'border-transparent text-slate-500 hover:text-[#33475b]'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Enrolled Leads ({enrolledLeads.length})</span>
        </button>
      </div>

      {/* TAB 1: Structured Step Builder */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          {/* Main Steps List (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
                <div>
                  <h3 className="font-bold text-sm text-[#33475b]">
                    LinkedIn Action Cadence
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Each step represents a timed LinkedIn task generated for the assigned SDR.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addStep} className="h-7 text-xs gap-1 border-[#cbd6e2] text-[#0091ae] font-semibold">
                  <Plus className="h-3 w-3" />
                  <span>Add Step</span>
                </Button>
              </div>

              {/* Steps List */}
              <div className="space-y-3">
                {steps.map((st, index) => {
                  return (
                    <div
                      key={st.id}
                      className="rounded-lg border border-[#dfe3eb] bg-[#f5f8fa] p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2d3e50] text-white font-bold text-[10px]">
                            {st.stepNumber}
                          </span>
                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) => updateStep(index, { title: e.target.value })}
                            className="font-bold text-[#33475b] bg-transparent border-b border-transparent hover:border-[#cbd6e2] focus:border-[#ff7a59] focus:outline-none px-1 text-xs"
                          />
                        </div>

                        {/* Reorder and Delete controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveStep(index, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move Step Up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === steps.length - 1}
                            onClick={() => moveStep(index, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Move Step Down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 ml-1"
                            title="Remove Step"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step Timing / Delay */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-600 bg-white p-2 rounded border border-[#dfe3eb]">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-[#33475b]">Wait Delay:</span>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={st.delayDays}
                          onChange={(e) => updateStep(index, { delayDays: parseInt(e.target.value) || 0 })}
                          className="w-14 rounded border border-[#cbd6e2] px-2 py-0.5 text-xs text-center text-[#33475b]"
                        />
                        <span>day(s) after previous step</span>
                      </div>

                      {/* Message Template textarea */}
                      {st.actionType !== 'wait_for_acceptance' && st.actionType !== 'complete_details' && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase font-semibold text-slate-400">
                              LinkedIn Message Template
                            </label>
                            <span className="text-[10px] text-slate-400">
                              Variables: <code className="bg-white px-1 rounded border border-[#dfe3eb]">&#123;&#123;firstName&#125;&#125;</code>, <code className="bg-white px-1 rounded border border-[#dfe3eb]">&#123;&#123;company&#125;&#125;</code>
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={st.messageTemplate || ''}
                            onChange={(e) => updateStep(index, { messageTemplate: e.target.value })}
                            className="w-full rounded border border-[#cbd6e2] p-2 text-xs bg-white text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59] resize-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addStep}
                className="w-full text-xs py-2 border-dashed border-[#cbd6e2] text-slate-600 hover:border-[#ff7a59]"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-[#ff7a59]" />
                <span>Add Next Cadence Step</span>
              </Button>
            </div>
          </div>

          {/* Sequence Parameters Sidebar (1 col) */}
          <div className="space-y-4">
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-[#33475b] pb-2 border-b border-[#dfe3eb]">
                Sequence Settings
              </h3>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Sequence Name</label>
                <input
                  type="text"
                  value={seqName}
                  onChange={(e) => setSeqName(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Channel</label>
                <div className="p-2.5 rounded bg-[#f5f8fa] border border-[#dfe3eb] flex items-center gap-2 font-medium">
                  <Linkedin className="h-4 w-4 text-[#0077b5]" />
                  <span className="font-semibold text-[#33475b]">LinkedIn Outreach</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Description</label>
                <textarea
                  rows={3}
                  value={seqDesc}
                  onChange={(e) => setSeqDesc(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-2 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59] resize-none"
                />
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="w-full bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold text-xs shadow-xs"
                >
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Visual Workflow */}
      {activeTab === 'workflow' && (
        <WorkflowCanvas sequence={originalSequence} enrolledLeads={enrolledLeads} />
      )}

      {/* TAB 3: Enrolled Leads */}
      {activeTab === 'leads' && (
        <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden text-xs">
          <div className="px-4 py-3 border-b border-[#dfe3eb] bg-[#f5f8fa] flex items-center justify-between">
            <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
              Enrolled Leads in this Sequence ({enrolledLeads.length})
            </h3>
            <Button
              size="sm"
              onClick={() => setIsEnrollModalOpen(true)}
              className="h-7 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold cursor-pointer"
            >
              <Plus className="h-3 w-3 mr-1" />
              <span>Enroll Existing Lead</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#f5f8fa] text-[10px] uppercase font-semibold text-slate-500 border-b border-[#dfe3eb]">
                <tr>
                  <th className="px-4 py-2.5">Lead Name</th>
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Current Step</th>
                  <th className="px-4 py-2.5">Outreach State</th>
                  <th className="px-4 py-2.5">Next Action Due</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe3eb]">
                {enrolledLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No leads currently enrolled in this sequence.
                    </td>
                  </tr>
                ) : (
                  enrolledLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#f5f8fa]/80 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          href={ROUTES.LEAD_DETAIL(lead.id)}
                          className="font-bold text-[#33475b] hover:text-[#ff7a59] hover:underline"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {lead.company}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-[#0091ae]">
                          Step {lead.currentStepNumber}
                        </span>{' '}
                        of {steps.length}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-[#33475b]">
                        {lead.outreachStatus.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {lead.nextFollowUpDate || 'None'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => advanceLeadStep(lead.id)}
                            className="h-6 text-[10px] px-2 text-[#0091ae] border-[#b2d5e5] bg-white font-semibold cursor-pointer"
                          >
                            Advance Step
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Unenroll ${lead.firstName} from ${originalSequence?.name}?`)) {
                                assignSequenceToLead(lead.id, null);
                              }
                            }}
                            className="h-6 text-[10px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            Unenroll
                          </Button>
                          <Link href={ROUTES.LEAD_DETAIL(lead.id)}>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-slate-500 cursor-pointer">
                              Profile
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enroll Lead Modal */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 max-w-lg w-full shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
              <div>
                <h3 className="font-bold text-sm text-[#2d3e50]">
                  Enroll Leads into {originalSequence?.name}
                </h3>
                <p className="text-xs text-[#7c98b6]">
                  Select leads from your workspace pipeline to enroll into this cadence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-[#dfe3eb] flex-1">
              {leads.filter((l) => l.sequenceId !== id && l.disposition !== 'archived').length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  All active leads are already enrolled in this sequence or archived.
                </div>
              ) : (
                leads
                  .filter((l) => l.sequenceId !== id && l.disposition !== 'archived')
                  .map((lead) => (
                    <div
                      key={lead.id}
                      className="py-2.5 px-2 flex items-center justify-between hover:bg-[#f8fafc] text-xs"
                    >
                      <div>
                        <p className="font-bold text-[#2d3e50]">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-[11px] text-[#7c98b6]">
                          {lead.jobTitle} at {lead.company}
                          {lead.sequenceName ? ` · Currently in "${lead.sequenceName}"` : ' · Unassigned'}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          void assignSequenceToLead(lead.id, id);
                        }}
                        className="h-7 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold cursor-pointer"
                      >
                        Enroll Now
                      </Button>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-[#dfe3eb] flex items-center justify-between">
              <Link href="/leads?action=new">
                <Button size="sm" variant="outline" className="text-xs border-[#cbd6e2] text-[#2d3e50]">
                  <Plus className="h-3 w-3 mr-1" />
                  <span>Create New Lead</span>
                </Button>
              </Link>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
