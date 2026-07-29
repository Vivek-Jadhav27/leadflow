'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, Edit2, Trash2, Mail } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { Lead } from '@/types/lead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/date';
import { ROUTES } from '@/constants/routes';

interface LeadTableProps {
  leads: Lead[];
  isLoading?: boolean;
  onDeleteLead: (id: string) => Promise<boolean>;
  onAddNew?: () => void;
}

export function LeadTable({
  leads,
  isLoading = false,
  onDeleteLead,
  onAddNew,
}: LeadTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await onDeleteLead(deletingId);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads found"
        description="Start by adding your first lead or try adjusting your search filters."
        actionLabel={onAddNew ? 'Add New Lead' : undefined}
        onAction={onAddNew}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3.5 font-semibold">Name</th>
              <th scope="col" className="px-6 py-3.5 font-semibold">Company</th>
              <th scope="col" className="px-6 py-3.5 font-semibold">Sequence Type</th>
              <th scope="col" className="px-6 py-3.5 font-semibold">Created Date</th>
              <th scope="col" className="px-6 py-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {leads.map((lead) => {
              const fullName = `${lead.firstName} ${lead.lastName}`.trim();
              const isLinkedin = lead.sequenceType === 'linkedin';

              return (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <Link
                        href={ROUTES.LEAD_DETAIL(lead.id)}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:underline"
                      >
                        {fullName}
                      </Link>
                      {lead.designation && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {lead.designation}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                    {lead.company}
                  </td>

                  <td className="px-6 py-4">
                    <Badge
                      variant="secondary"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isLinkedin
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                      }`}
                    >
                      {isLinkedin ? <Linkedin className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                      {isLinkedin ? 'LinkedIn Sequence' : 'Email Sequence'}
                    </Badge>
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(lead.createdAt)}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={ROUTES.LEAD_DETAIL(lead.id)}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View Lead & Timeline">
                          <Eye className="h-4 w-4 text-slate-500" />
                        </Button>
                      </Link>

                      <Link href={ROUTES.EDIT_LEAD(lead.id)}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Edit Lead">
                          <Edit2 className="h-4 w-4 text-slate-500" />
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        title="Delete Lead"
                        onClick={() => setDeletingId(lead.id)}
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Lead"
        description="Are you sure you want to delete this lead and its associated sequence? This action cannot be undone."
        confirmLabel="Delete Lead"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingId(null)}
      />
    </>
  );
}
