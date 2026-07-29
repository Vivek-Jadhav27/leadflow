'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLeads } from '@/hooks/useLeads';
import { LeadForm } from '@/components/leads/LeadForm';
import { Lead, CreateLeadInput } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { Loader } from '@/components/common/Loader';
import { ROUTES } from '@/constants/routes';

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { getLeadById, updateLead } = useLeads();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      const data = await getLeadById(id);
      if (isMounted) {
        setLead(data);
        setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSubmit = async (data: CreateLeadInput, _steps: CreateSequenceStepInput[]) => {
    if (!lead) return;
    const success = await updateLead(lead.id, data);
    if (success) {
      router.push(ROUTES.LEAD_DETAIL(lead.id));
    }
  };

  if (loading) {
    return <Loader message="Fetching lead details for editing..." />;
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold">Lead Not Found</h3>
      </div>
    );
  }

  return (
    <div className="py-6">
      <LeadForm
        initialData={lead}
        title={`Edit Lead: ${lead.firstName} ${lead.lastName}`}
        description="Update contact information, company details, or sequence type for this prospect."
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
