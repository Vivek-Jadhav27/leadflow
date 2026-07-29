'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLeads } from '@/hooks/useLeads';
import { LeadForm } from '@/components/leads/LeadForm';
import { CreateLeadInput } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { ROUTES } from '@/constants/routes';

export default function NewLeadPage() {
  const { createLeadWithSequence } = useLeads();
  const router = useRouter();

  const handleSubmit = async (
    leadData: CreateLeadInput,
    steps: CreateSequenceStepInput[]
  ) => {
    const newLead = await createLeadWithSequence(leadData, steps);
    if (newLead) {
      router.push(ROUTES.LEADS);
    }
  };

  return (
    <div className="py-6">
      <LeadForm
        title="Add SDR Prospect & Sequence"
        description="Fill prospect details, select LinkedIn or Email outreach, and generate follow-up steps."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
