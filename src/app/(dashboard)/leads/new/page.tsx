'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

export default function NewLeadPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /leads with action=new to open the drawer
    router.replace('/leads?action=new');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 text-xs text-slate-400">
      Opening lead drawer...
    </div>
  );
}
