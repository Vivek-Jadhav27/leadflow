'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Plus, ArrowRight, UserCheck } from 'lucide-react';

import { useLeads } from '@/hooks/useLeads';
import { useSequence } from '@/hooks/useSequence';
import { DashboardCards } from '@/components/dashboard/DashboardCards';
import { TodayPendingFollowups } from '@/components/dashboard/TodayPendingFollowups';
import { LeadTable } from '@/components/leads/LeadTable';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function DashboardPage() {
  const { leads, allLeads, stats, loading: leadsLoading, deleteLead, fetchLeads } = useLeads();
  const { pendingFollowUps, fetchTodayPendingFollowUps, markStepAsSent, loading: seqLoading } = useSequence();

  // Load today's pending follow-ups whenever allLeads updates
  useEffect(() => {
    if (allLeads.length > 0) {
      fetchTodayPendingFollowUps(allLeads);
    }
  }, [allLeads, fetchTodayPendingFollowUps]);

  const handleMarkSent = async (stepId: string) => {
    const success = await markStepAsSent(stepId);
    if (success) {
      // Refresh leads and stats in real time
      await fetchLeads();
    }
    return success;
  };

  const recentLeads = leads.slice(0, 5);

  return (
    <div className="space-y-8 py-4">

      {/* Metrics Cards */}
      <DashboardCards stats={stats} loading={leadsLoading} />

      {/* Today's Pending Follow-ups Section */}
      <TodayPendingFollowups
        pendingList={pendingFollowUps}
        onMarkSent={handleMarkSent}
        loading={seqLoading || leadsLoading}
      />

      {/* Recent Leads Table */}
      {/* <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Leads
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest leads added to your workspace
            </p>
          </div>
          <Link href={ROUTES.LEADS}>
            <Button variant="ghost" size="sm" className="gap-1 text-slate-600 dark:text-slate-400 text-xs">
              View All Leads ({leads.length})
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <LeadTable
          leads={recentLeads}
          isLoading={leadsLoading}
          onDeleteLead={deleteLead}
        />
      </section> */}
    </div>
  );
}
