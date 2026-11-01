'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import DashboardPage from '@/app/(dashboard)/dashboard/page';
import { EmailVerificationNotice } from '@/components/auth/EmailVerificationNotice';
import { UserCheck, Shield } from 'lucide-react';

export default function SDRDashboard() {
  const router = useRouter();
  const { user, role, loading, isAuthenticated, currentWorkspace } = useAuthContext();

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
      <div className="space-y-4">
        {/* SDR Workspace Context Pill */}
        <div className="p-3 rounded-lg bg-white border border-[#dfe3eb] shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center font-bold text-xs uppercase">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-xs text-[#2d3e50] flex items-center gap-1.5">
                <span>{user?.displayName || user?.email}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-[#e5f5f8] text-[#0091ae]">
                  SDR Member
                </span>
              </div>
              <p className="text-[11px] text-[#7c98b6]">
                Assigned to Workspace: <strong className="text-[#516f90]">{currentWorkspace?.companyName || user?.companyName || 'LeadFlow Workspace'}</strong>
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#7c98b6]">
            <Shield className="h-3 w-3" />
            <span>SDR Permissions Active</span>
          </div>
        </div>

        <EmailVerificationNotice />
        <DashboardPage />
      </div>
    </DashboardLayout>
  );
}

