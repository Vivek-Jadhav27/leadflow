'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  Sparkles,
  ArrowRight,
  Database,
  Building2,
  User,
  Briefcase,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { Sequence, TeamMember } from '@/types/crm';
import { toast } from 'sonner';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  sequences: Sequence[];
  team: TeamMember[];
}

export interface ParsedLeadRow {
  _rowId: string;
  originalRowNumber: number;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  linkedinUrl: string;
  missingFields: string[];
}

export function BulkUploadModal({ isOpen, onClose, sequences, team }: BulkUploadModalProps) {
  const { bulkCreateLeads } = useCRM();
  const { user, isAdmin } = useAuthContext();

  const isSdr = !isAdmin && !!user;
  const currentSdrName = user?.displayName || user?.email?.split('@')[0] || 'Outbound SDR';
  const currentSdrEmail = user?.email || '';
  const currentSdrId = user?.uid || 'sdr_current';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Parsed data
  const [allRows, setAllRows] = useState<ParsedLeadRow[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');

  if (!isOpen) return null;

  // 1. Download Sample CSV (Strictly 5 extension fields: firstName, lastName, jobTitle, company, linkedinUrl)
  const handleDownloadSampleCSV = () => {
    const headers = [
      'firstName',
      'lastName',
      'jobTitle',
      'company',
      'linkedinUrl',
    ];

    const sampleRows = [
      [
        'Sarah',
        'Connor',
        'VP of Enterprise Sales',
        'Cyberdyne Systems',
        'https://www.linkedin.com/in/sarah-connor',
      ],
      [
        'David',
        'Miller',
        'Head of Revenue Operations',
        'CloudScale Technologies',
        'https://www.linkedin.com/in/david-miller',
      ],
      [
        'Priya',
        'Sharma',
        'Engineering Director',
        'FinTech Global India',
        'https://www.linkedin.com/in/priya-sharma',
      ],
    ];

    const csvContent =
      headers.join(',') +
      '\n' +
      sampleRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'leadflow_leads_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sample CSV template downloaded!');
  };

  // Helper to validate a row for missing extension-matched required fields
  const getMissingFields = (row: Partial<ParsedLeadRow>): string[] => {
    const missing: string[] = [];
    if (!row.firstName || !row.firstName.trim()) missing.push('firstName');
    if (!row.lastName || !row.lastName.trim()) missing.push('lastName');
    if (!row.jobTitle || !row.jobTitle.trim()) missing.push('jobTitle');
    if (!row.company || !row.company.trim()) missing.push('company');
    if (!row.linkedinUrl || !row.linkedinUrl.trim()) missing.push('linkedinUrl');
    return missing;
  };

  // Robust CSV line parser handling quotes
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((c === ',' || c === ';') && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a valid .csv file');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string) || '';
        const lines = text
          .split(/\r\n|\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length < 2) {
          toast.error('CSV file is empty or missing data rows');
          setIsParsing(false);
          return;
        }

        const rawHeaders = parseCSVLine(lines[0]);
        // Normalize headers strictly for extension fields
        const headerIndexMap: Record<string, number> = {};
        rawHeaders.forEach((h, idx) => {
          const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (norm.includes('firstname') || norm === 'first') headerIndexMap['firstName'] = idx;
          else if (norm.includes('lastname') || norm === 'last') headerIndexMap['lastName'] = idx;
          else if (norm.includes('jobtitle') || norm === 'title' || norm === 'position' || norm === 'designation') headerIndexMap['jobTitle'] = idx;
          else if (norm.includes('company') || norm === 'organization' || norm === 'account') headerIndexMap['company'] = idx;
          else if (norm.includes('linkedin') || norm.includes('profileurl')) headerIndexMap['linkedinUrl'] = idx;
        });

        // Parse data rows
        const parsed: ParsedLeadRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          const getVal = (field: string) => {
            const idx = headerIndexMap[field];
            return idx !== undefined && cells[idx] ? cells[idx].replace(/^"|"$/g, '').trim() : '';
          };

          const rowData: ParsedLeadRow = {
            _rowId: `row_${i}_${Date.now()}`,
            originalRowNumber: i + 1,
            firstName: getVal('firstName'),
            lastName: getVal('lastName'),
            jobTitle: getVal('jobTitle'),
            company: getVal('company'),
            linkedinUrl: getVal('linkedinUrl'),
            missingFields: [],
          };

          rowData.missingFields = getMissingFields(rowData);
          parsed.push(rowData);
        }

        setAllRows(parsed);
        setIsParsing(false);

        const invalidCount = parsed.filter((r) => r.missingFields.length > 0).length;
        if (invalidCount > 0) {
          toast.warning(`${invalidCount} lead(s) have missing required data. Please add manually.`);
        } else {
          toast.success(`Successfully parsed ${parsed.length} leads. Ready to import!`);
        }
      } catch (err) {
        console.error('CSV Parsing error:', err);
        toast.error('Failed to parse CSV file. Please check file format.');
        setIsParsing(false);
      }
    };

    reader.readAsText(selectedFile);
  };

  // Update a field for a row in real-time
  const handleUpdateRowField = (rowId: string, field: keyof ParsedLeadRow, value: string) => {
    setAllRows((prev) =>
      prev.map((r) => {
        if (r._rowId !== rowId) return r;
        const updated = { ...r, [field]: value };
        updated.missingFields = getMissingFields(updated);
        return updated;
      })
    );
  };

  // Discard a row
  const handleDiscardRow = (rowId: string) => {
    setAllRows((prev) => prev.filter((r) => r._rowId !== rowId));
    toast.info('Lead row discarded');
  };

  // Filter rows with missing data
  const invalidRows = allRows.filter((r) => r.missingFields.length > 0);
  const validRows = allRows.filter((r) => r.missingFields.length === 0);

  // 3. Save & Import to Firestore (No browser local storage!)
  const handleSaveAndImport = async () => {
    if (invalidRows.length > 0) {
      toast.error(`Please fill in missing fields for the ${invalidRows.length} flagged lead(s) or discard them before importing.`);
      return;
    }

    if (allRows.length === 0) {
      toast.error('No leads to import.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedAssignee = team.find((t) => t.id === selectedAssigneeId);

      const finalAssigneeId = isSdr ? currentSdrId : (selectedAssigneeId || null);
      const finalAssigneeName = isSdr ? currentSdrName : (selectedAssignee?.name || null);
      const finalAssigneeEmail = isSdr ? currentSdrEmail : (selectedAssignee?.email || null);

      const leadsPayload = allRows.map((r) => ({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        company: r.company.trim(),
        jobTitle: r.jobTitle.trim(),
        linkedinUrl: r.linkedinUrl.trim(),
        email: null,
        phone: null,
        sequenceId: selectedSequenceId || null,
        assignedToId: finalAssigneeId,
        assignedToName: finalAssigneeName,
        assignedToEmail: finalAssigneeEmail,
        capturedBy: user?.email || 'bulk_csv_import',
        capturedByUid: user?.uid || null,
        notes: 'Imported via CSV',
      }));

      await bulkCreateLeads(leadsPayload, {
        defaultSequenceId: selectedSequenceId || undefined,
        defaultAssignedToId: finalAssigneeId || undefined,
        defaultAssignedToName: finalAssigneeName || undefined,
      });

      // Reset and close
      setFile(null);
      setAllRows([]);
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-[#cbd8eb] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dfe3eb] bg-[#f8fafc] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ff7a59]/10 text-[#ff7a59]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#33475b] flex items-center gap-2">
                Bulk CSV Lead Upload
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  Direct Cloud Save
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Matches LinkedIn Chrome Extension fields. Cloud persisted to Firebase Firestore without browser local storage.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#eaf0f6] hover:text-[#33475b] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Download Template & Upload Area */}
          {allRows.length === 0 ? (
            <div className="space-y-6">
              {/* Sample CSV Download Callout */}
              <div className="rounded-lg border border-[#cbd8eb] bg-[#f5f8fa] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#33475b] flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-[#ff7a59]" />
                    SDR CSV Template (Chrome Extension Fields)
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xl">
                    Download this sample CSV file pre-formatted with the exact LinkedIn extension columns:
                    <span className="font-semibold text-slate-700"> firstName, lastName, jobTitle, company, linkedinUrl</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="h-8 gap-2 bg-white text-[#ff7a59] border border-[#ff7a59]/40 hover:bg-[#fff6f4] text-xs font-semibold shadow-xs shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Sample CSV
                </Button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd8eb] hover:border-[#ff7a59] bg-[#fcfdfe] hover:bg-[#fffdfd] p-10 text-center transition-all cursor-pointer"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv"
                  className="hidden"
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ff7a59]/10 text-[#ff7a59] group-hover:scale-110 transition-transform mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-[#33475b]">
                  {isParsing ? 'Parsing CSV data…' : 'Click or drag CSV file to upload'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Upload your completed SDR leads CSV. If any lead has missing fields, LeadFlow will display them for manual entry.
                </p>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <span>Supported format: .csv</span>
                  <span>•</span>
                  <span>UTF-8 encoded</span>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Inspection, Missing Data Dialog, and Assignment */
            <div className="space-y-6">
              {/* Status Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-[#cbd8eb] bg-[#f8fafc]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[#33475b] font-bold text-xs">
                    {allRows.length}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#33475b]">
                      Parsed {allRows.length} lead(s) from <span className="text-[#ff7a59]">{file?.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {validRows.length} complete • {invalidRows.length} need attention
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setAllRows([]);
                    }}
                    className="h-7 text-xs border-slate-300 text-slate-600 hover:bg-slate-100"
                  >
                    Upload Different File
                  </Button>
                </div>
              </div>

              {/* MISSING DATA DIALOG BOX (Required by user) */}
              {invalidRows.length > 0 && (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-4 space-y-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-100 p-2 text-amber-700 mt-0.5">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-900">
                        {invalidRows.length === 1
                          ? 'This lead has missing data — add manually'
                          : `${invalidRows.length} leads have missing data — add manually below`}
                      </h4>
                      <p className="text-xs text-amber-800/90 mt-0.5">
                        The fields highlighted in red are required to match extension standards (First Name, Last Name, Job Title, Company, LinkedIn URL). Enter the missing details or discard unwanted rows.
                      </p>
                    </div>
                  </div>

                  {/* List of ALL leads having issues in the same dialog */}
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {invalidRows.map((row) => (
                      <div
                        key={row._rowId}
                        className="rounded-lg border border-amber-200 bg-white p-3 shadow-xs space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px]">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            CSV Row #{row.originalRowNumber}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-semibold text-[10px]">
                              Missing: {row.missingFields.join(', ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDiscardRow(row._rowId)}
                              title="Discard this row"
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline editable inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          {/* First Name */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              First Name *
                            </label>
                            <input
                              type="text"
                              value={row.firstName}
                              onChange={(e) => handleUpdateRowField(row._rowId, 'firstName', e.target.value)}
                              placeholder="Required"
                              className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${
                                !row.firstName.trim()
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />
                          </div>

                          {/* Last Name */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Last Name *
                            </label>
                            <input
                              type="text"
                              value={row.lastName}
                              onChange={(e) => handleUpdateRowField(row._rowId, 'lastName', e.target.value)}
                              placeholder="Required"
                              className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${
                                !row.lastName.trim()
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />
                          </div>

                          {/* Job Title */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Job Title *
                            </label>
                            <input
                              type="text"
                              value={row.jobTitle}
                              onChange={(e) => handleUpdateRowField(row._rowId, 'jobTitle', e.target.value)}
                              placeholder="Required"
                              className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${
                                !row.jobTitle.trim()
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />
                          </div>

                          {/* Company */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Company *
                            </label>
                            <input
                              type="text"
                              value={row.company}
                              onChange={(e) => handleUpdateRowField(row._rowId, 'company', e.target.value)}
                              placeholder="Required"
                              className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${
                                !row.company.trim()
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />
                          </div>

                          {/* LinkedIn URL */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              LinkedIn URL *
                            </label>
                            <input
                              type="text"
                              value={row.linkedinUrl}
                              onChange={(e) => handleUpdateRowField(row._rowId, 'linkedinUrl', e.target.value)}
                              placeholder="https://linkedin.com/in/..."
                              className={`w-full rounded border px-2 py-1 text-xs focus:outline-none ${
                                !row.linkedinUrl.trim()
                                  ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                                  : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Leads Preview */}
              {validRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#33475b]">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {validRows.length} Complete Lead(s) Ready for Cloud Import
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Preview of first {Math.min(validRows.length, 5)} rows
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#dfe3eb] bg-white overflow-hidden text-xs">
                    <div className="grid grid-cols-12 bg-[#f8fafc] px-3 py-2 font-bold text-slate-600 border-b border-[#dfe3eb]">
                      <div className="col-span-3">Prospect</div>
                      <div className="col-span-3">Title</div>
                      <div className="col-span-3">Company</div>
                      <div className="col-span-3">LinkedIn</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {validRows.slice(0, 5).map((r) => (
                        <div key={r._rowId} className="grid grid-cols-12 px-3 py-1.5 text-slate-700 items-center">
                          <div className="col-span-3 font-semibold truncate">
                            {r.firstName} {r.lastName}
                          </div>
                          <div className="col-span-3 truncate text-slate-500">{r.jobTitle}</div>
                          <div className="col-span-3 truncate">{r.company}</div>
                          <div className="col-span-3 truncate text-blue-600 text-[11px]">{r.linkedinUrl}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Cadence & Assignment Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#dfe3eb]">
                <div>
                  <label className="block text-xs font-bold text-[#33475b] mb-1">
                    Assign Cadence (Optional)
                  </label>
                  <select
                    value={selectedSequenceId}
                    onChange={(e) => setSelectedSequenceId(e.target.value)}
                    className="w-full rounded-md border border-[#cbd8eb] bg-white px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                  >
                    <option value="">No Sequence (Leave Unassigned)</option>
                    {sequences.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.steps?.length || 4} steps)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#33475b] mb-1">
                    {isSdr ? 'Assigned Representative' : 'Assign SDR Representative (Optional)'}
                  </label>
                  {isSdr ? (
                    <div className="flex items-center gap-2 rounded-md border border-[#cbd8eb] bg-[#f5f8fa] px-3 py-1.5 text-xs text-[#33475b]">
                      <User className="h-3.5 w-3.5 text-[#ff7a59]" />
                      <span className="font-semibold">{currentSdrName}</span>
                      <span className="text-[10px] text-slate-500">({currentSdrEmail})</span>
                      <span className="ml-auto rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                        Auto-assigned to You
                      </span>
                    </div>
                  ) : (
                    <select
                      value={selectedAssigneeId}
                      onChange={(e) => setSelectedAssigneeId(e.target.value)}
                      className="w-full rounded-md border border-[#cbd8eb] bg-white px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:border-[#ff7a59]"
                    >
                      <option value="">Unassigned (Round Robin / Pool)</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#dfe3eb] bg-[#f8fafc] px-6 py-3.5">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            <span>Saves directly to Firebase Firestore • Zero browser caching</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs text-slate-600"
            >
              Cancel
            </Button>

            {allRows.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={isSaving || invalidRows.length > 0}
                onClick={handleSaveAndImport}
                className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Saving to Cloud…</span>
                ) : (
                  <>
                    <span>Import {allRows.length} Leads to Cloud</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

