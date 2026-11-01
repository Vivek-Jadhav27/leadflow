'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SDRDashboardView } from '@/components/dashboard/SDRDashboardView';

export default function SDRDashboard() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <SDRDashboardView />
    </DashboardLayout>
  );
}
