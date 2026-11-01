'use client';

import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import DashboardOverviewPage from '@/app/(dashboard)/dashboard/page';

export default function AdminWorkspaceDashboard() {
  return (
    <DashboardLayout>
      <DashboardOverviewPage />
    </DashboardLayout>
  );
}
