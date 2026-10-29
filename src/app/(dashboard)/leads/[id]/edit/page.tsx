'use client';

import React, { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.LEAD_DETAIL(id));
  }, [id, router]);

  return (
    <div className="flex items-center justify-center py-20 text-xs text-slate-400">
      Loading lead profile...
    </div>
  );
}
