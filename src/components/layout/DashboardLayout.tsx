'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Menu } from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthContext();
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

  return (
    <div className="min-h-screen flex bg-[#f5f8fa] text-[#33475b] font-sans">
      {/* Shift Navbar to Left Sidebar */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Mobile Header with Hamburger Menu */}
        <header className="lg:hidden h-12 bg-[#2d3e50] text-white px-4 flex items-center justify-between shrink-0 shadow-xs">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 rounded text-[#cbd9f4] hover:text-white"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <div className="h-5 w-5 rounded bg-[#ff7a59] text-white flex items-center justify-center text-xs">
              L
            </div>
            <span>LeadFlow</span>
          </div>
          <div className="w-5" />
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
