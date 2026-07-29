'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { SearchBar } from '@/components/common/SearchBar';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LeadFilterOptions, SequenceType } from '@/types/lead';

interface LeadFiltersProps {
  filters: LeadFilterOptions;
  onFilterChange: (filters: Partial<LeadFilterOptions>) => void;
  onReset: () => void;
}

export function LeadFilters({ filters, onFilterChange, onReset }: LeadFiltersProps) {
  const sequenceTypeOptions = [
    { label: 'All Sequences', value: 'All' },
    { label: 'LinkedIn Sequence', value: 'linkedin' },
    { label: 'Email Sequence', value: 'email' },
  ];

  const sortOptions = [
    { label: 'Created Date (Newest)', value: 'createdAt-desc' },
    { label: 'Created Date (Oldest)', value: 'createdAt-asc' },
    { label: 'Company (A-Z)', value: 'company-asc' },
    { label: 'Company (Z-A)', value: 'company-desc' },
    { label: 'First Name (A-Z)', value: 'firstName-asc' },
  ];

  const currentSortValue = `${filters.sortBy || 'createdAt'}-${filters.sortOrder || 'desc'}`;

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split('-') as ['createdAt' | 'company' | 'firstName', 'asc' | 'desc'];
    onFilterChange({ sortBy, sortOrder });
  };

  const isFiltered = filters.searchQuery !== '' || (filters.sequenceType && filters.sequenceType !== 'All');

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={filters.searchQuery || ''}
          onChange={(searchQuery) => onFilterChange({ searchQuery })}
          placeholder="Search by lead name, company, designation, email..."
        />
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-slate-500 text-xs">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Select
          value={filters.sequenceType || 'All'}
          onChange={(e) => onFilterChange({ sequenceType: e.target.value as SequenceType | 'All' })}
          options={sequenceTypeOptions}
        />

        <Select
          value={currentSortValue}
          onChange={handleSortChange}
          options={sortOptions}
        />
      </div>
    </div>
  );
}
