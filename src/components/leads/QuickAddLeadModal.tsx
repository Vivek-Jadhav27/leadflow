'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { leadSchema, LeadFormData } from '@/schemas/lead.schema';
import { CreateLeadInput, SequenceType } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { getDefaultSequenceSteps } from '@/utils/leadParser';
import { DESIGNATION_OPTIONS } from '@/constants/designations';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (leadData: CreateLeadInput, steps: CreateSequenceStepInput[]) => Promise<any>;
}

export function QuickAddLeadModal({
  isOpen,
  onClose,
  onSave,
}: QuickAddLeadModalProps) {
  const [sequenceType, setSequenceType] = useState<SequenceType>('linkedin');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
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
  };

  const handleFormSubmit = async (data: LeadFormData, keepOpen = false) => {
    setIsSubmitting(true);
    try {
      const defaultSteps = getDefaultSequenceSteps(sequenceType);
      const leadPayload: CreateLeadInput = {
        ...data,
        sequenceType,
      };

      await onSave(leadPayload, defaultSteps);

      if (keepOpen) {
        reset();
        toast.success('Lead saved! Ready to add next lead.');
      } else {
        reset();
        onClose();
      }
    } catch (err) {
      toast.error('Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const designationSelectOptions = DESIGNATION_OPTIONS.map((title) => ({
    label: title,
    value: title,
  }));

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="⚡ Quick Add Lead"
      description="Add a new lead in seconds with 1-click auto sequence setup."
    >
      <div className="space-y-4">
        {/* Quick Form Fields */}
        <form onSubmit={handleSubmit((d) => handleFormSubmit(d, false))} className="space-y-3">
          {/* Sequence Outreach Mode Selector */}
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Sequence Outreach Mode
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSequenceTypeChange('linkedin')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                  sequenceType === 'linkedin'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                LinkedIn Sequence
              </button>
              <button
                type="button"
                onClick={() => handleSequenceTypeChange('email')}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                  sequenceType === 'email'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                Email Sequence
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="John"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Company Name
              </label>
              <Input placeholder="Acme Corp" {...register('company')} />
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
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
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
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
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

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={handleSubmit((d) => handleFormSubmit(d, true))}
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Save & Add Another
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                {isSubmitting ? 'Saving...' : 'Save Lead'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
