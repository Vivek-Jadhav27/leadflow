'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useLeads } from '@/hooks/useLeads';
import { useSequence } from '@/hooks/useSequence';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/common/Loader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SequenceTimeline } from '@/components/sequence/SequenceTimeline';
import { formatDate } from '@/utils/date';
import { ROUTES } from '@/constants/routes';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { getLeadById, deleteLead } = useLeads();
  const { sequence, steps, fetchLeadSequence, markStepAsSent, skipStep, loading: seqLoading } = useSequence();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      const data = await getLeadById(id);
      if (isMounted) {
        setLead(data);
        setLoading(false);
      }
      if (data) {
        fetchLeadSequence(data.id);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!lead) return;
    setIsDeleting(true);
    try {
      const success = await deleteLead(lead.id);
      if (success) {
        router.push(ROUTES.LEADS);
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return <Loader message="Loading lead profile & sequence details..." />;
  }

  if (!lead) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-semibold">Lead Not Found</h3>
        <p className="text-sm text-slate-500">
          The requested lead profile could not be found or has been removed.
        </p>
        <Link href={ROUTES.LEADS}>
          <Button variant="outline">Back to Leads</Button>
        </Link>
      </div>
    );
  }

  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const isLinkedin = lead.sequenceType === 'linkedin';

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between">
        <Link href={ROUTES.LEADS}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" />
            Back to Leads
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Link href={ROUTES.EDIT_LEAD(lead.id)}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit2 className="h-4 w-4" />
              Edit Lead
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {fullName}
              </h2>
              <Badge
                variant="secondary"
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  isLinkedin
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                    : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                }`}
              >
                {isLinkedin ? <Linkedin className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                {isLinkedin ? 'LinkedIn Sequence' : 'Email Sequence'}
              </Badge>
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {lead.designation ? `${lead.designation} at ` : ''}
              <span className="text-slate-900 dark:text-slate-200 font-semibold">{lead.company}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            <span>Added {formatDate(lead.createdAt)}</span>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Contact Information
            </h4>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Email Address</p>
                  <a
                    href={`mailto:${lead.email}`}
                    className="font-medium hover:underline text-slate-900 dark:text-slate-100"
                  >
                    {lead.email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Phone Number</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {lead.phone || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              LinkedIn & Social
            </h4>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Linkedin className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">LinkedIn Profile</p>
                  {lead.linkedin ? (
                    <a
                      href={lead.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-xs"
                    >
                      {lead.linkedin}
                    </a>
                  ) : (
                    <p className="font-medium text-slate-900 dark:text-slate-100">Not provided</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {lead.notes && (
            <div className="md:col-span-2 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                SDR Notes
              </h4>
              <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300 whitespace-pre-wrap">
                {lead.notes}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <SequenceTimeline
          sequence={sequence}
          steps={steps}
          lead={lead}
          onMarkSent={markStepAsSent}
          onSkipStep={skipStep}
          loading={seqLoading}
        />
      </section>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete Lead"
        description={`Are you sure you want to delete ${fullName} and all sequence steps?`}
        confirmLabel="Delete Lead"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
