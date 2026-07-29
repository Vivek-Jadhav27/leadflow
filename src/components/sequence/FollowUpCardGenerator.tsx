'use client';

import React, { useState } from 'react';
import { SequenceType } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, Mail } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { getFutureDateString } from '@/utils/date';

interface FollowUpCardGeneratorProps {
  sequenceType: SequenceType;
  steps: CreateSequenceStepInput[];
  onStepsChange: (steps: CreateSequenceStepInput[]) => void;
}

export function FollowUpCardGenerator({
  sequenceType,
  steps,
  onStepsChange,
}: FollowUpCardGeneratorProps) {
  const [countInput, setCountInput] = useState<number>(3);

  const handleGenerate = () => {
    const num = Math.min(Math.max(countInput, 1), 10);
    const generated: CreateSequenceStepInput[] = [];

    for (let i = 1; i <= num; i++) {
      const daysAhead = (i - 1) * 2;
      const scheduledDate = getFutureDateString(daysAhead);

      if (sequenceType === 'linkedin') {
        generated.push({
          stepNumber: i,
          scheduledDate,
          message: i === 1
            ? 'Hi {{firstName}}, I noticed your work at {{company}} and would love to connect!'
            : `Hi {{firstName}}, following up on my previous message regarding {{company}}.`,
        });
      } else {
        generated.push({
          stepNumber: i,
          scheduledDate,
          subject: i === 1
            ? 'Quick question regarding {{company}}'
            : `Following up: {{company}} x LeadFlow`,
          message: i === 1
            ? 'Hi {{firstName}},\n\nI hope this email finds you well. I wanted to reach out regarding...'
            : 'Hi {{firstName}},\n\nJust checking in to see if you had a chance to read my previous email.',
        });
      }
    }

    onStepsChange(generated);
  };

  const handleStepFieldChange = (
    index: number,
    field: keyof CreateSequenceStepInput,
    value: string
  ) => {
    const updated = [...steps];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onStepsChange(updated);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Follow-up Sequence Setup
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              How many follow-up steps do you want in this {sequenceType === 'linkedin' ? 'LinkedIn' : 'Email'} sequence?
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-24">
              <Input
                type="number"
                min={1}
                max={10}
                value={countInput}
                onChange={(e) => setCountInput(parseInt(e.target.value) || 1)}
                placeholder="Count"
              />
            </div>
            <Button
              type="button"
              onClick={handleGenerate}
              variant="primary"
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {steps.length > 0 ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Generated Follow-up Cards ({steps.length})
            </h4>
            <span className="text-xs text-slate-500">
              All steps initialized with status <Badge variant="outline" className="ml-1 text-amber-600 bg-amber-50 border-amber-200">Pending</Badge>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {steps.map((step, idx) => (
              <Card key={idx} className="border border-slate-200 dark:border-slate-800">
                <CardHeader className="py-3 px-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {sequenceType === 'linkedin' ? (
                      <Linkedin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    )}
                    <CardTitle className="text-sm font-medium">
                      Follow-up #{step.stepNumber}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Pending
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <div className="w-full sm:w-64">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Scheduled Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={step.scheduledDate}
                      onChange={(e) => handleStepFieldChange(idx, 'scheduledDate', e.target.value)}
                    />
                  </div>

                  {sequenceType === 'email' && (
                    <div>
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                        Email Subject <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter email subject..."
                        value={step.subject || ''}
                        onChange={(e) => handleStepFieldChange(idx, 'subject', e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      {sequenceType === 'linkedin' ? 'LinkedIn Message Text' : 'Email Body'} <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      rows={3}
                      placeholder={sequenceType === 'linkedin' ? 'Write InMail/DM text...' : 'Write email content...'}
                      value={step.message}
                      onChange={(e) => handleStepFieldChange(idx, 'message', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
