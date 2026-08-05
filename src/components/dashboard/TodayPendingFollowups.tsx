'use client';

import React from 'react';
import Link from 'next/link';
import { PendingFollowUp } from '@/types/sequence';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/date';
import { openGmailCompose, openLinkedinProfile } from '@/utils/outreach';
import { ROUTES } from '@/constants/routes';
import { Mail, CheckCircle2, Calendar, ArrowRight, UserCheck, ExternalLink } from 'lucide-react';
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
      <Card className="p-0 border border-slate-200 dark:border-slate-800">
        <CardHeader className="py-3 px-4 sm:px-5 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold">Today&apos;s Pending Follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const handleOutreachAction = async (stepId: string, isLinkedin: boolean, email: string, linkedinUrl: string, subject?: string, message?: string) => {
    let opened = false;
    if (isLinkedin) {
      opened = openLinkedinProfile(linkedinUrl, message);
    } else {
      opened = openGmailCompose(email, subject, message);
    }
    if (opened) {
      await onMarkSent(stepId);
    }
  };

  return (
    <Card className="p-0 border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="py-3 px-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
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

      <CardContent className="p-4 sm:p-5">
        {pendingList.length === 0 ? (
          <div className="py-6 text-center space-y-2.5">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
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

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkSent(step.id)}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      >
                        Mark Sent Only
                      </Button>

                      {/* {isLinkedin ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOutreachAction(step.id, true, lead.email, lead.linkedin || '', step.subject, step.message)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                          Open LinkedIn
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOutreachAction(step.id, false, lead.email, lead.linkedin || '', step.subject, step.message)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Open Gmail Compose
                          <ExternalLink className="h-3 w-3 opacity-80" />
                        </Button>
                      )} */}
                    </div>
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

