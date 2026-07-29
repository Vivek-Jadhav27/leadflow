'use client';

import React from 'react';
import { SequenceType } from '@/types/lead';
import { Mail, CheckCircle2 } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { cn } from '@/lib/utils';

interface SequenceTypeSelectorProps {
  selectedType: SequenceType;
  onChange: (type: SequenceType) => void;
}

export function SequenceTypeSelector({ selectedType, onChange }: SequenceTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Select Sequence Type <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose either LinkedIn or Email sequence for manual SDR follow-up.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* LinkedIn Sequence Card */}
        <div
          onClick={() => onChange('linkedin')}
          className={cn(
            'relative cursor-pointer rounded-xl border p-4 transition-all hover:border-slate-400 dark:hover:border-slate-600',
            selectedType === 'linkedin'
              ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <Linkedin className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  LinkedIn Sequence
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manual InMail & Direct Message steps
                </p>
              </div>
            </div>
            {selectedType === 'linkedin' && (
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
        </div>

        {/* Email Sequence Card */}
        <div
          onClick={() => onChange('email')}
          className={cn(
            'relative cursor-pointer rounded-xl border p-4 transition-all hover:border-slate-400 dark:hover:border-slate-600',
            selectedType === 'email'
              ? 'border-purple-600 bg-purple-50/50 dark:border-purple-500 dark:bg-purple-950/20 ring-2 ring-purple-500/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Email Sequence
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cold outreach & email follow-up steps
                </p>
              </div>
            </div>
            {selectedType === 'email' && (
              <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
