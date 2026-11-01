'use client';

import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, ExternalLink, Sparkles, Globe, UserCheck } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { Lead } from '@/types/crm';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';

interface AddLeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadToEdit?: Lead | null;
}

export function AddLeadDrawer({ isOpen, onClose, leadToEdit }: AddLeadDrawerProps) {
  const { leads, sequences, team, createLead, updateLead } = useCRM();

  const [activeTab, setActiveTab] = useState<'manual' | 'extension'>('manual');

  // Form fields
  const [firstName, setFirstName] = useState(leadToEdit?.firstName || '');
  const [lastName, setLastName] = useState(leadToEdit?.lastName || '');
  const [company, setCompany] = useState(leadToEdit?.company || '');
  const [jobTitle, setJobTitle] = useState(leadToEdit?.jobTitle || '');
  const [email, setEmail] = useState(leadToEdit?.email || '');
  const [phone, setPhone] = useState(leadToEdit?.phone || '');
  const [linkedinUrl, setLinkedinUrl] = useState(leadToEdit?.linkedinUrl || '');
  const [sequenceId, setSequenceId] = useState(leadToEdit?.sequenceId || '');
  const [assignedToId, setAssignedToId] = useState(leadToEdit?.assignedToId || (team[0]?.id || 'user_sdr_alex'));
  const [notes, setNotes] = useState(leadToEdit?.notes || '');

  // Errors & Duplicate warning
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Sync state if leadToEdit changes
  React.useEffect(() => {
    if (leadToEdit) {
      setFirstName(leadToEdit.firstName);
      setLastName(leadToEdit.lastName);
      setCompany(leadToEdit.company);
      setJobTitle(leadToEdit.jobTitle);
      setEmail(leadToEdit.email || '');
      setPhone(leadToEdit.phone || '');
      setLinkedinUrl(leadToEdit.linkedinUrl);
      setSequenceId(leadToEdit.sequenceId || '');
      setAssignedToId(leadToEdit.assignedToId || '');
      setNotes(leadToEdit.notes || '');
    } else {
      setFirstName('');
      setLastName('');
      setCompany('');
      setJobTitle('');
      setEmail('');
      setPhone('');
      setLinkedinUrl('');
      setSequenceId(sequences[0]?.id || '');
      setAssignedToId(team[1]?.id || team[0]?.id || 'user_sdr_alex');
      setNotes('');
    }
    setErrors({});
    setDuplicateWarning(null);
  }, [leadToEdit, isOpen, team, sequences]);

  if (!isOpen) return null;

  // Active LinkedIn sequences only
  const activeSequences = sequences.filter((s) => s.status !== 'archived');

  // Decision 1: Duplicate check logic
  const checkDuplicates = (mail: string, liUrl: string) => {
    if (leadToEdit) return; // Ignore during edit
    const normMail = mail.toLowerCase().trim();
    const normLi = liUrl.toLowerCase().trim();

    const existingMail = normMail ? leads.find((l) => l.email && l.email.toLowerCase() === normMail) : null;
    if (existingMail) {
      setDuplicateWarning(`Decision 1 Flag: Lead with email "${normMail}" already exists (${existingMail.firstName} ${existingMail.lastName} at ${existingMail.company}). Opening this will update existing record.`);
      return;
    }

    const existingLi = normLi ? leads.find((l) => l.linkedinUrl.toLowerCase() === normLi) : null;
    if (existingLi) {
      setDuplicateWarning(`Decision 1 Flag: Lead with LinkedIn URL already exists (${existingLi.firstName} ${existingLi.lastName} at ${existingLi.company}). Avoid duplicate creation.`);
      return;
    }

    setDuplicateWarning(null);
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!lastName.trim()) errs.lastName = 'Last name is required.';
    if (!company.trim()) errs.company = 'Company name is required.';
    if (!jobTitle.trim()) errs.jobTitle = 'Job title is required.';

    if (!email.trim()) {
      errs.email = 'Corporate email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email format (e.g. name@company.com).';
    }

    if (!linkedinUrl.trim()) {
      errs.linkedinUrl = 'LinkedIn profile URL is required.';
    } else if (!linkedinUrl.toLowerCase().includes('linkedin.com/')) {
      errs.linkedinUrl = 'Must be a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username).';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const assignedMember = team.find((m) => m.id === assignedToId) || team[0];
    const selectedSeq = sequences.find((s) => s.id === sequenceId);

    if (leadToEdit) {
      updateLead(leadToEdit.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        linkedinUrl: linkedinUrl.trim(),
        sequenceId: sequenceId || undefined,
        sequenceName: selectedSeq?.name,
        assignedToId: assignedMember.id,
        assignedToName: assignedMember.name,
        assignedToEmail: assignedMember.email,
        notes: notes.trim(),
      });
    } else {
      createLead({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        linkedinUrl: linkedinUrl.trim(),
        channel: 'linkedin',
        sequenceId: sequenceId || undefined,
        sequenceName: selectedSeq?.name,
        currentStepNumber: sequenceId ? 1 : 0,
        totalSteps: selectedSeq ? selectedSeq.steps.length : 0,
        connectionStatus: sequenceId ? 'request_pending' : 'not_started',
        outreachStatus: sequenceId ? 'in_sequence' : 'unassigned',
        disposition: 'active',
        assignedToId: assignedMember.id,
        assignedToName: assignedMember.name,
        assignedToEmail: assignedMember.email,
        nextFollowUpDate: sequenceId ? new Date().toISOString().split('T')[0] : undefined,
        nextActionTitle: selectedSeq?.steps[0]?.title || undefined,
        notes: notes.trim(),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#142b55]/40 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg bg-white shadow-2xl border-l border-[#dfe3eb] flex flex-col h-full animate-in slide-in-from-right duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#dfe3eb] bg-[#f5f8fa]">
          <div>
            <h3 className="text-base font-bold text-[#2d3e50]">
              {leadToEdit ? 'Edit Prospect Record' : 'Capture LinkedIn Lead'}
            </h3>
            <p className="text-xs text-[#516f90]">
              {leadToEdit ? 'Update contact, connection state, and sequence parameters' : 'LeadFlow Decision 1: Capture, duplicate check, and enrich'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#7c98b6] hover:text-[#2d3e50] hover:bg-[#eaf0f6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher if Creating */}
        {!leadToEdit && (
          <div className="flex border-b border-[#dfe3eb] text-xs px-6 bg-white">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-2.5 px-3 font-bold border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-[#ff7a59] text-[#ff7a59]'
                  : 'border-transparent text-[#516f90] hover:text-[#2d3e50]'
              }`}
            >
              Manual Prospect Entry
            </button>
            <button
              onClick={() => setActiveTab('extension')}
              className={`py-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'extension'
                  ? 'border-[#ff7a59] text-[#ff7a59]'
                  : 'border-transparent text-[#516f90] hover:text-[#2d3e50]'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Browser Extension Capture</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === 'extension' && !leadToEdit ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#0091ae]/30 bg-[#e7f7fa] p-4 text-[#007a8c]">
                <div className="flex items-center gap-2 font-bold text-xs mb-1">
                  <Linkedin className="h-4 w-4 text-[#0091ae]" />
                  <span>LeadFlow LinkedIn Extension Capture</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Browse any LinkedIn profile or Sales Navigator account and click <strong>&quot;Capture Lead to LeadFlow&quot;</strong> in your browser toolbar to automatically run Decision 1 duplicate check and enroll into your cadence.
                </p>
              </div>

              <div className="rounded-lg border border-[#dfe3eb] p-4 space-y-3 bg-[#f5f8fa]">
                <h4 className="font-bold text-[#2d3e50]">
                  Simulate Extension Capture
                </h4>
                <p className="text-[#516f90] text-[11px]">
                  Click below to simulate auto-capturing a verified prospect from LinkedIn:
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setFirstName('Dmitri');
                    setLastName('Volkov');
                    setCompany('Krypton Cyber Defense');
                    setJobTitle('Chief Information Security Officer');
                    setEmail('dmitri.volkov@kryptoncyber.com');
                    setPhone('+1 (415) 332-9011');
                    setLinkedinUrl('https://linkedin.com/in/dmitri-volkov-ciso');
                    setSequenceId(sequences[0]?.id || '');
                    setNotes('Captured via LeadFlow Chrome Extension from LinkedIn profile on Oct 29.');
                    setActiveTab('manual');
                  }}
                  className="w-full bg-[#142b55] hover:bg-[#1f3b73] text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#ff7a59]" />
                  <span>Pre-fill Sample Profile from Extension</span>
                </Button>
              </div>
            </div>
          ) : (
            <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Decision 1 Duplicate Alert */}
              {duplicateWarning && (
                <div className="rounded-lg border border-[#f5a623] bg-[#fef4e8] p-3 text-[#a7750b] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#d49a19] mt-0.5" />
                  <div className="text-[11px] leading-snug">
                    <p className="font-bold">Decision 1: Duplicate Match Found</p>
                    <p>{duplicateWarning}</p>
                  </div>
                </div>
              )}

              {/* Names row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#33475b]">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Elena"
                    className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                  />
                  {errors.firstName && <p className="text-[10px] text-rose-500">{errors.firstName}</p>}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#33475b]">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rostova"
                    className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                  />
                  {errors.lastName && <p className="text-[10px] text-rose-500">{errors.lastName}</p>}
                </div>
              </div>

              {/* Company & Title */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#33475b]">
                    Company <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="CloudScale AI"
                    className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                  />
                  {errors.company && <p className="text-[10px] text-rose-500">{errors.company}</p>}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#33475b]">
                    Job Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="VP Engineering"
                    className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                  />
                  {errors.jobTitle && <p className="text-[10px] text-rose-500">{errors.jobTitle}</p>}
                </div>
              </div>

              {/* Email & LinkedIn */}
              <div className="space-y-1">
                {/* <label className="font-bold text-[#33475b]">
                  Corporate Email <span className="text-rose-500">*</span>
                </label> */}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    checkDuplicates(e.target.value, linkedinUrl);
                  }}
                  placeholder="elena.rostova@cloudscale.ai"
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                />
                {errors.email && <p className="text-[10px] text-rose-500">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#33475b]">
                  LinkedIn Profile URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={linkedinUrl}
                  onChange={(e) => {
                    setLinkedinUrl(e.target.value);
                    checkDuplicates(email, e.target.value);
                  }}
                  placeholder="https://linkedin.com/in/elena-rostova"
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                />
                {errors.linkedinUrl && <p className="text-[10px] text-rose-500">{errors.linkedinUrl}</p>}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#33475b]">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2831"
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                />
              </div>

              {/* LinkedIn Sequence Assignment */}
              <div className="space-y-1 pt-2 border-t border-[#eaf0f6]">
                <label className="font-bold text-[#33475b]">
                  Assign to LinkedIn Outreach Cadence
                </label>
                <select
                  value={sequenceId}
                  onChange={(e) => setSequenceId(e.target.value)}
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                >
                  <option value="">No Sequence (Unassigned Prospect Pool)</option>
                  {activeSequences.map((seq) => (
                    <option key={seq.id} value={seq.id}>
                      {seq.name} ({seq.steps.length} steps)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#7c98b6]">
                  Enrolls prospect into Decision 2 LinkedIn connection gate.
                </p>
              </div>

              {/* Assigned Representative */}
              <div className="space-y-1">
                <label className="font-bold text-[#33475b]">
                  Assigned Team Member <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-1.5 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                >
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              {/* SDR Notes */}
              <div className="space-y-1">
                <label className="font-bold text-[#33475b]">
                  SDR Notes &amp; Pain Points (Optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Growth trigger, tech stack insights, personalized connection hook..."
                  className="w-full rounded-md border border-[#cbd8eb] px-3 py-2 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59] resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#dfe3eb] bg-[#f5f8fa]">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          {activeTab === 'manual' && (
            <Button
              type="submit"
              form="lead-form"
              size="sm"
              className="bg-[#ff7a59] hover:bg-[#e06646] text-white font-bold text-xs shadow-xs"
            >
              {leadToEdit ? 'Save Changes' : 'Capture & Validate Lead'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
