'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';

export default function Home() {
  const { isAuthenticated, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace(ROUTES.DASHBOARD);
      } else {
        router.replace(ROUTES.LOGIN);
      }
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f8fa] text-[#33475b]">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#ff7a59]" />
        <span>Loading LeadFlow CRM...</span>
      </div>
    </div>
  );
}
