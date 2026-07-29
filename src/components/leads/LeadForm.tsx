'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { leadSchema, LeadFormData } from '@/schemas/lead.schema';
import { Lead, CreateLeadInput, SequenceType } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { SequenceTypeSelector } from '@/components/sequence/SequenceTypeSelector';
import { FollowUpCardGenerator } from '@/components/sequence/FollowUpCardGenerator';
import { ROUTES } from '@/constants/routes';

interface LeadFormProps {
  initialData?: Lead;
  initialSteps?: CreateSequenceStepInput[];
  onSubmit: (leadData: CreateLeadInput, steps: CreateSequenceStepInput[]) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
}

export function LeadForm({
  initialData,
  initialSteps = [],
  onSubmit,
  title = 'Add New Lead',
  description = 'Fill lead details, choose a sequence type, and generate follow-up steps.',
  submitLabel = 'Save Lead & Sequence',
}: LeadFormProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [sequenceType, setSequenceType] = useState<SequenceType>(initialData?.sequenceType || 'linkedin');
  const [generatedSteps, setGeneratedSteps] = useState<CreateSequenceStepInput[]>(initialSteps);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: initialData
      ? {
          firstName: initialData.firstName,
          lastName: initialData.lastName || '',
          company: initialData.company,
          designation: initialData.designation || '',
          email: initialData.email,
          phone: initialData.phone || '',
          linkedin: initialData.linkedin || '',
          notes: initialData.notes || '',
          sequenceType: initialData.sequenceType,
        }
      : {
          firstName: '',
          lastName: '',
          company: '',
          designation: '',
          email: '',
          phone: '',
          linkedin: '',
          notes: '',
          sequenceType: 'linkedin',
        },
  });

  const handleSequenceTypeChange = (type: SequenceType) => {
    setSequenceType(type);
    setValue('sequenceType', type);
    setGeneratedSteps([]);
  };

  const handleNextStep1 = async () => {
    const isValid = await trigger(['firstName', 'company', 'email']);
    if (isValid) {
      setCurrentStep(2);
    }
  };

  const handleNextStep2 = () => {
    setCurrentStep(3);
  };

  const handleFinalSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data as CreateLeadInput, generatedSteps);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto border-slate-200/80 dark:border-slate-800 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Link href={ROUTES.LEADS}>
            <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
              Back to Leads
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 1 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              1. Lead Info
            </span>
            <span className="text-slate-300">/</span>
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 2 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              2. Sequence Type
            </span>
            <span className="text-slate-300">/</span>
            <span className={`px-2.5 py-1 rounded-full ${currentStep === 3 ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
              3. Follow-up Steps
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <form onSubmit={handleSubmit(handleFinalSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Lead Profile & Position
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="John"
                      error={errors.firstName?.message}
                      {...register('firstName')}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Last Name
                    </label>
                    <Input
                      placeholder="Doe"
                      error={errors.lastName?.message}
                      {...register('lastName')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="Acme Corp"
                      error={errors.company?.message}
                      {...register('company')}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Designation / Title
                    </label>
                    <Input
                      placeholder="VP of Growth"
                      error={errors.designation?.message}
                      {...register('designation')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="john@acme.com"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                      Phone Number
                    </label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      error={errors.phone?.message}
                      {...register('phone')}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                    LinkedIn Profile URL
                  </label>
                  <Input
                    placeholder="https://linkedin.com/in/johndoe"
                    error={errors.linkedin?.message}
                    {...register('linkedin')}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                  SDR Notes & Context
                </label>
                <Textarea
                  rows={3}
                  placeholder="Key background info, target pain points, or notes..."
                  {...register('notes')}
                />
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  onClick={handleNextStep1}
                  className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2"
                >
                  Continue to Sequence Type
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <SequenceTypeSelector
                selectedType={sequenceType}
                onChange={handleSequenceTypeChange}
              />

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Lead Info
                </Button>

                <Button
                  type="button"
                  onClick={handleNextStep2}
                  className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2"
                >
                  Generate Follow-up Steps
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <FollowUpCardGenerator
                sequenceType={sequenceType}
                steps={generatedSteps}
                onStepsChange={setGeneratedSteps}
              />

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sequence Type
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? 'Saving Lead...' : submitLabel}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
