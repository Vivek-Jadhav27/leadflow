'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';

export default function AccessDeniedPage() {
  const { user, role } = useAuthContext();

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-base tracking-tight text-[#2d3e50]">LeadFlow</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="text-xl font-bold text-[#2d3e50]">Access Denied</h1>
          <p className="text-xs text-[#516f90] leading-relaxed">
            You do not have the required administrative permissions to access this workspace resource. If you believe this is an error, please contact your workspace owner.
          </p>

          <div className="pt-4 border-t border-[#edf1f5] flex items-center justify-center gap-3">
            <Link
              href={role === 'admin' ? '/workspace/dashboard' : '/sdr/dashboard'}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#2d3e50] hover:bg-[#1e2b37]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-md font-semibold text-xs text-[#516f90] bg-[#f8fafc] border border-[#cbd6e2] hover:bg-[#edf1f5]"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#7c98b6]">
        &copy; {new Date().getFullYear()} LeadFlow Platform
      </footer>
    </div>
  );
}

