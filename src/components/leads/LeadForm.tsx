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
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { SequenceTypeSelector } from '@/components/sequence/SequenceTypeSelector';
import { FollowUpCardGenerator } from '@/components/sequence/FollowUpCardGenerator';
import { ROUTES } from '@/constants/routes';
import { DESIGNATION_OPTIONS } from '@/constants/designations';
import { getDefaultSequenceSteps } from '@/utils/leadParser';

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
  description = 'Select outreach sequence, enter lead details, and generate follow-up steps.',
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
          company: initialData.company || '',
          designation: initialData.designation || DESIGNATION_OPTIONS[0],
          email: initialData.email || '',
          phone: initialData.phone || '',
          linkedin: initialData.linkedin || '',
          notes: initialData.notes || '',
          sequenceType: initialData.sequenceType,
        }
      : {
          firstName: '',
          lastName: '',
          company: '',
          designation: DESIGNATION_OPTIONS[0],
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

  const handleNextStep1 = () => {
    setCurrentStep(2);
  };

  const handleNextStep2 = async () => {
    const fieldsToValidate: (keyof LeadFormData)[] = ['firstName'];
    if (sequenceType === 'email') {
      fieldsToValidate.push('email');
    }
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(3);
    }
  };

  const handleFinalSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      const stepsToSave = generatedSteps.length > 0 ? generatedSteps : getDefaultSequenceSteps(sequenceType);
      await onSubmit({ ...data, sequenceType } as CreateLeadInput, stepsToSave);
    } finally {
      setIsSubmitting(false);
    }
  };

  const designationSelectOptions = DESIGNATION_OPTIONS.map((title) => ({
    label: title,
    value: title,
  }));

  return (
    <Card className="max-w-6xl mx-auto border-slate-200/80 dark:border-slate-800 shadow-sm">
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
            <span
              className={`px-2.5 py-1 rounded-full ${
                currentStep === 1
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              1. Sequence Type
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`px-2.5 py-1 rounded-full ${
                currentStep === 2
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              2. Lead Details
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`px-2.5 py-1 rounded-full ${
                currentStep === 3
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              3. Follow-up Steps
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <form onSubmit={handleSubmit(handleFinalSubmit)} className="space-y-6">
          {/* STEP 1: Select Sequence Type */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <SequenceTypeSelector
                selectedType={sequenceType}
                onChange={handleSequenceTypeChange}
              />

              <div className="flex items-center justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  onClick={handleNextStep1}
                  className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2"
                >
                  Continue to Lead Details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Lead Details Form */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Lead Profile & Information
                </h4>
                
                {/* 2 Columns x 2 Rows Form Grid */}
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
                      Company Name
                    </label>
                    <Input
                      placeholder="Acme Corp"
                      error={errors.company?.message}
                      {...register('company')}
                    />
                  </div>

                  <div>
                    <Select
                      label="Designation / Role"
                      options={designationSelectOptions}
                      error={errors.designation?.message}
                      {...register('designation')}
                    />
                  </div>

                  {sequenceType === 'email' ? (
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
                  ) : (
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
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sequence Type
                </Button>

                <Button
                  type="button"
                  onClick={handleNextStep2}
                  className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2"
                >
                  Continue to Sequence Steps
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Sequence Count & Steps */}
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
                  Back to Lead Details
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
