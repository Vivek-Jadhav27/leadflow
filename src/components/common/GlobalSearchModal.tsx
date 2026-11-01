'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Users, GitBranch, CheckSquare, X, ArrowRight } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { ROUTES } from '@/constants/routes';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const { leads, sequences, tasks } = useCRM();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchingLeads = q
    ? leads.filter(
        (l) =>
          `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          (l.email ? l.email.toLowerCase().includes(q) : false) ||
          l.jobTitle.toLowerCase().includes(q)
      ).slice(0, 5)
    : [];

  const matchingSequences = q
    ? sequences.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const matchingTasks = q
    ? tasks.filter((t) => t.title.toLowerCase().includes(q) || t.leadName.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const hasResults = matchingLeads.length > 0 || matchingSequences.length > 0 || matchingTasks.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, companies, sequences, tasks... (Esc to close)"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 text-xs">
          {!q ? (
            <div className="py-8 text-center text-slate-400">
              <p>Type to search across leads, companies, and sequences</p>
              <p className="text-[11px] mt-1 text-slate-400">e.g. &quot;Elena&quot;, &quot;CloudScale&quot;, &quot;Founder&quot;</p>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-slate-400">
              No matching records found for &quot;{query}&quot;
            </div>
          ) : (
            <div className="space-y-3">
              {matchingLeads.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    <span>Leads ({matchingLeads.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          onClose();
                          router.push(ROUTES.LEAD_DETAIL(lead.id));
                        }}
                        className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {lead.jobTitle} at <span className="font-medium text-slate-700 dark:text-slate-300">{lead.company}</span>
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingSequences.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3" />
                    <span>Sequences ({matchingSequences.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingSequences.map((seq) => (
                      <button
                        key={seq.id}
                        onClick={() => {
                          onClose();
                          router.push(ROUTES.SEQUENCE_DETAIL(seq.id));
                        }}
                        className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {seq.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate capitalize">
                            {seq.channel} Sequence · {seq.steps.length} Steps
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingTasks.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CheckSquare className="h-3 w-3" />
                    <span>Tasks ({matchingTasks.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {matchingTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onClose();
                          router.push(ROUTES.TASKS);
                        }}
                        className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {t.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            Lead: {t.leadName} · Due: {t.dueDate}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                          {t.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 dark:bg-slate-950 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with mouse or Esc to close</span>
          <span className="font-mono text-[10px]">LeadFlow Operational Search</span>
        </div>
      </div>
    </div>
  );
}
