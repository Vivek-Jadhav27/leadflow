'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, ArrowRight, ShieldAlert, KeyRound } from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';

export default function SignUpRedirectPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuthContext();
  const [inviteTokenInput, setInviteTokenInput] = useState('');

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/workspace/onboarding');
    }
  }, [isAuthenticated, loading, router]);

  const handleOpenInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTokenInput.trim()) return;

    let token = inviteTokenInput.trim();
    if (token.includes('token=')) {
      try {
        const url = new URL(token);
        token = url.searchParams.get('token') || token;
      } catch {
        // Fallback to substring
        const match = token.match(/token=([a-zA-Z0-9]+)/);
        if (match) token = match[1];
      }
    }
    router.push(`/invite/accept?token=${encodeURIComponent(token)}`);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-[#33475b] space-y-5">
      <div className="text-center space-y-1.5">
        <div className="h-10 w-10 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold text-[#2d3e50]">Registration Information</h1>
        <p className="text-xs text-[#516f90]">
          LeadFlow is an invite-only B2B workspace platform. Unrestricted self-registration is disabled.
        </p>
      </div>

      <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0] space-y-3 text-xs">
        <div className="font-semibold text-[#2d3e50] flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#ff7a59]" />
          <span>Company Workspace Owners</span>
        </div>
        <p className="text-[#516f90]">
          If you are an Administrator creating a new company workspace for your sales team:
        </p>
        <Link
          href="/signup/admin"
          className="inline-flex items-center gap-1.5 font-semibold text-[#ff7a59] hover:underline"
        >
          <span>Create an Admin Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0] space-y-3 text-xs">
        <div className="font-semibold text-[#2d3e50] flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#0091ae]" />
          <span>SDR Team Members</span>
        </div>
        <p className="text-[#516f90]">
          SDRs must be invited by their workspace Administrator. Check your email for your invitation link, or paste it below:
        </p>
        <form onSubmit={handleOpenInvite} className="space-y-2">
          <input
            type="text"
            value={inviteTokenInput}
            onChange={(e) => setInviteTokenInput(e.target.value)}
            placeholder="Paste invitation link or token..."
            className="w-full px-3 py-1.5 text-xs rounded border border-[#cbd6e2] focus:outline-none focus:border-[#0091ae]"
          />
          <button
            type="submit"
            disabled={!inviteTokenInput.trim()}
            className="w-full py-1.5 px-3 rounded bg-[#0091ae] text-white font-medium text-xs hover:bg-[#007a93] disabled:opacity-50 cursor-pointer"
          >
            Open Invitation
          </button>
        </form>
      </div>

      <div className="text-center pt-2 text-xs text-[#516f90]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#0091ae] hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}
