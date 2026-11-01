'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import DashboardOverviewPage from '@/app/(dashboard)/dashboard/page';

export default function WorkspaceOnboardingPage() {
  const router = useRouter();

  // Prevent back button from going back to the signup flow
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href);
      const onPopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  return (
    <DashboardLayout>
      <DashboardOverviewPage />
    </DashboardLayout>
  );
}
