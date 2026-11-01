'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Menu, LogOut } from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, currentWorkspace, isAuthenticated, loading, logout } = useAuthContext();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f8fa] flex items-center justify-center text-[#33475b]">
        <div className="flex items-center gap-2.5 text-xs font-semibold">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#ff7a59]" />
          <span>Verifying LeadFlow session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const companyName = currentWorkspace?.companyName || user?.companyName || 'LeadFlow Workspace';

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col text-[#33475b] font-sans">
      {/* Top Header - Unified Clean Light Hubspot Design */}
      <header className="h-14 px-4 sm:px-6 border-b border-[#dfe3eb] bg-white flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-md text-[#516f90] hover:text-[#2d3e50] hover:bg-[#f8fafc]"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href={ROUTES.DASHBOARD} className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-[#e66343] transition-colors">
              L
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm tracking-tight text-[#2d3e50] block truncate max-w-[200px] sm:max-w-[300px]">
                {companyName}
              </span>
              <span className="text-[10px] text-[#516f90] block leading-none">LeadFlow Workspace</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* User Status Pill */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#f8fafc] border border-[#e2e8f0] text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-[#2d3e50] max-w-[180px] lg:max-w-[260px] truncate">
              {user?.email}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#e5f5f8] text-[#0091ae]">
              {user?.role === 'admin' ? 'ADMIN' : 'SDR'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              router.replace(ROUTES.LOGIN);
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[#dfe3eb] bg-white text-[#516f90] hover:text-[#2d3e50] hover:bg-[#f8fafc] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Sign out of LeadFlow"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-[1500px] w-full mx-auto">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
