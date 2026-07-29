'use client';

import React from 'react';
import { Sequence, SequenceStep } from '@/types/sequence';
import { Lead } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/date';
import { openGmailCompose, openLinkedinProfile } from '@/utils/outreach';
import { CheckCircle2, Clock, SkipForward, Mail, Calendar, ExternalLink } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { STEP_STATUS_COLORS } from '@/constants/status';

interface SequenceTimelineProps {
  sequence: Sequence | null;
  steps: SequenceStep[];
  lead?: Lead | null;
  onMarkSent: (stepId: string) => Promise<boolean>;
  onSkipStep: (stepId: string) => Promise<boolean>;
  loading?: boolean;
}

export function SequenceTimeline({
  sequence,
  steps,
  lead,
  onMarkSent,
  onSkipStep,
  loading = false,
}: SequenceTimelineProps) {
  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
        Loading follow-up timeline...
      </div>
    );
  }

  if (!sequence || steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No sequence or follow-up steps configured for this lead.
        </p>
      </div>
    );
  }

  const isLinkedin = sequence.type === 'linkedin';

  const handleActionAndMarkSent = async (step: SequenceStep) => {
    let opened = false;
    if (isLinkedin) {
      opened = openLinkedinProfile(lead?.linkedin || '', step.message);
    } else {
      opened = openGmailCompose(lead?.email || '', step.subject, step.message);
    }
    if (opened) {
      await onMarkSent(step.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          {isLinkedin ? (
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Linkedin className="h-4 w-4" />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <Mail className="h-4 w-4" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isLinkedin ? 'LinkedIn Sequence Timeline' : 'Email Sequence Timeline'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total {steps.length} follow-up steps
            </p>
          </div>
        </div>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {steps.map((step) => {
          const colors = STEP_STATUS_COLORS[step.status];
          const isPending = step.status === 'Pending';
          const isSent = step.status === 'Sent';
          const isSkipped = step.status === 'Skipped';

          return (
            <div key={step.id} className="relative group">
              <div className="absolute -left-6 top-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-slate-900 ring-4 ring-white dark:ring-slate-900">
                {isSent && <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />}
                {isSkipped && <SkipForward className="h-5 w-5 text-slate-400 fill-slate-100 dark:fill-slate-900" />}
                {isPending && <Clock className="h-5 w-5 text-amber-500 fill-amber-100 dark:fill-amber-950" />}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Follow-up #{step.stepNumber}
                    </span>
                    <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border}`}>
                      {step.status}
                    </Badge>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Scheduled: {formatDate(step.scheduledDate)}</span>
                    {step.sentAt && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-2">
                        (Sent {formatDate(step.sentAt)})
                      </span>
                    )}
                  </div>
                </div>

                {step.subject && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                      Subject
                    </span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {step.subject}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                    {isLinkedin ? 'Message Text' : 'Email Content'}
                  </span>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {step.message}
                  </div>
                </div>

                {isPending && (
                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSkipStep(step.id)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Skip Step
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkSent(step.id)}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    >
                      Mark Sent Only
                    </Button>

                    {isLinkedin ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleActionAndMarkSent(step)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                        Open LinkedIn Profile
                        <ExternalLink className="h-3 w-3 ml-0.5 opacity-80" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleActionAndMarkSent(step)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center gap-1.5"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Open Gmail Compose
                        <ExternalLink className="h-3 w-3 ml-0.5 opacity-80" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

