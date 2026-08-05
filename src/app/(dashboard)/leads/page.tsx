'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, LayoutGrid, List, Zap } from 'lucide-react';

import { useLeads } from '@/hooks/useLeads';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadCard } from '@/components/leads/LeadCard';
import { QuickAddLeadModal } from '@/components/leads/QuickAddLeadModal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';

export default function LeadsPage() {
  const {
    leads,
    filters,
    loading,
    updateFilters,
    resetFilters,
    deleteLead,
    createLeadWithSequence,
  } = useLeads();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header and View Mode Toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Leads Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage, filter, and track all your prospective clients in one place
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* <Button
            onClick={() => setIsQuickAddOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Zap className="h-4 w-4" />
            ⚡ Quick Add
          </Button> */}

          <Link href={ROUTES.NEW_LEAD}>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Full Setup Form
            </Button>
          </Link>
        </div>
      </div>

      <QuickAddLeadModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={createLeadWithSequence}
      />

      {/* Search & Filter Controls */}
      <LeadFilters
        filters={filters}
        onFilterChange={updateFilters}
        onReset={resetFilters}
      />

      {/* Content Rendering */}
      {viewMode === 'table' ? (
        <LeadTable
          leads={leads}
          isLoading={loading}
          onDeleteLead={deleteLead}
        />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          title="No matching leads"
          description="Try broadening your search term or clearing filter criteria."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onDelete={deleteLead} />
          ))}
        </div>
      )}
    </div>
  );
}
