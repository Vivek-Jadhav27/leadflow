'use client';

import React from 'react';
import Link from 'next/link';
import { PendingFollowUp } from '@/types/sequence';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/date';
import { ROUTES } from '@/constants/routes';
import { Mail, CheckCircle2, Calendar, ArrowRight, UserCheck } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

interface TodayPendingFollowupsProps {
  pendingList: PendingFollowUp[];
  onMarkSent: (stepId: string) => Promise<boolean>;
  loading?: boolean;
}

export function TodayPendingFollowups({
  pendingList,
  onMarkSent,
  loading = false,
}: TodayPendingFollowupsProps) {
  if (loading) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold">Today&apos;s Pending Follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-500" />
            Today&apos;s Pending Follow-ups
          </CardTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manual SDR follow-up actions due today or overdue ({pendingList.length})
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {pendingList.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              All caught up for today!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No pending follow-ups scheduled for today. Great job keeping your sequence outreach up to date!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingList.map(({ step, lead }) => {
              const isLinkedin = lead.sequenceType === 'linkedin';

              return (
                <div
                  key={step.id}
                  className="group rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isLinkedin
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                        }`}
                      >
                        {isLinkedin ? <Linkedin className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      </div>

                      <div>
                        <Link
                          href={ROUTES.LEAD_DETAIL(lead.id)}
                          className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline flex items-center gap-1.5"
                        >
                          {lead.firstName} {lead.lastName}
                          <span className="text-xs font-normal text-slate-500">
                            ({lead.company} • {lead.designation || 'Lead'})
                          </span>
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="secondary"
                            className={
                              isLinkedin
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200'
                                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200'
                            }
                          >
                            {isLinkedin ? 'LinkedIn Sequence' : 'Email Sequence'}
                          </Badge>
                          <span className="text-xs text-slate-500">Follow-up #{step.stepNumber}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(step.scheduledDate)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {step.subject && (
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Subject: {step.subject}
                      </p>
                    )}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                      {step.message}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Link
                      href={ROUTES.LEAD_DETAIL(lead.id)}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1"
                    >
                      View Timeline
                      <ArrowRight className="h-3 w-3" />
                    </Link>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onMarkSent(step.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Sent
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
