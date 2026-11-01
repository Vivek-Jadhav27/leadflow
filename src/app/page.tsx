'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Compass,
  Sparkles,
  Layers,
  KeyRound,
  X,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';

export default function WelcomePage() {
  const router = useRouter();
  const { isAuthenticated, loading, role } = useAuthContext();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteInput, setInviteInput] = useState('');

  // If already authenticated, allow direct navigation to dashboard
  const handleGoToDashboard = () => {
    if (role === 'admin') {
      router.push('/workspace/dashboard');
    } else {
      router.push('/sdr/dashboard');
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    let token = inviteInput.trim();
    if (token.includes('token=')) {
      try {
        const url = new URL(token);
        token = url.searchParams.get('token') || token;
      } catch {
        const match = token.match(/token=([a-zA-Z0-9]+)/);
        if (match) token = match[1];
      }
    }
    router.push(`/invite/accept?token=${encodeURIComponent(token)}`);
  };

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      {/* Navigation Bar */}
      <header className="h-16 px-6 sm:px-12 border-b border-[#dfe3eb] bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#ff7a59] text-white flex items-center justify-center font-bold text-base shadow-xs">
            L
          </div>
          <span className="font-bold text-lg tracking-tight text-[#2d3e50]">LeadFlow</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={ROUTES.WALKTHROUGH}
            className="hidden sm:flex text-xs font-semibold text-[#0091ae] hover:text-[#007a93] items-center gap-1.5 transition-colors"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Interactive Architecture</span>
          </Link>

          {isAuthenticated ? (
            <button
              onClick={handleGoToDashboard}
              className="text-xs font-semibold px-4 py-2 rounded-md bg-[#2d3e50] text-white hover:bg-[#1e2b37] transition-all cursor-pointer shadow-xs"
            >
              Open Workspace
            </button>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold text-[#0091ae] hover:text-[#007a93] px-3 py-1.5 rounded-md hover:bg-[#e5f5f8] transition-all"
            >
              Already have an account? Log in
            </Link>
          )}
        </div>
      </header>

      {/* Hero Welcome Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center max-w-4xl mx-auto">
        {/* <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#fff5f2] text-[#ff7a59] border border-[#ffe0d6] mb-6 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>B2B Multi-User Sales CRM & Outreach Platform</span>
        </div> */}

        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#2d3e50] tracking-tight leading-tight sm:leading-tight mb-4">
          Welcome to LeadFlow
        </h1>

        <p className="text-base sm:text-lg text-[#516f90] max-w-2xl mb-8 leading-relaxed">
          Manage your sales team, leads and outreach in one place. Streamline pipeline tracking, automate follow-up sequences, and empower your SDRs.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md justify-center mb-6">
          <Link
            href="/signup/admin"
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm text-white bg-[#ff7a59] hover:bg-[#e66343] transition-all shadow-xs cursor-pointer"
          >
            <Building2 className="h-4 w-4" />
            <span>Create Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm text-[#2d3e50] bg-white border border-[#cbd6e2] hover:bg-[#f8fafc] hover:border-[#b0c1d4] transition-all shadow-xs cursor-pointer"
          >
            <Users className="h-4 w-4 text-[#0091ae]" />
            <span>Join a Workspace</span>
          </button>
        </div>

        <div className="text-xs text-[#516f90]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#0091ae] hover:underline">
            Log in here
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full border-t border-[#dfe3eb] pt-12">
          <div className="p-4 rounded-lg bg-white border border-[#dfe3eb] shadow-2xs space-y-2">
            <div className="h-8 w-8 rounded-md bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm text-[#2d3e50]">Multi-Tenant Workspaces</h3>
            <p className="text-xs text-[#516f90] leading-relaxed">
              Company-isolated environments with granular Admin and SDR roles, invitation tokens, and member management.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#dfe3eb] shadow-2xs space-y-2">
            <div className="h-8 w-8 rounded-md bg-[#fff5f2] text-[#ff7a59] flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm text-[#2d3e50]">Owner-Scoped Leads</h3>
            <p className="text-xs text-[#516f90] leading-relaxed">
              Capture leads from LinkedIn, assign to dedicated SDRs, and preserve strict cross-workspace data boundaries.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#dfe3eb] shadow-2xs space-y-2">
            <div className="h-8 w-8 rounded-md bg-[#eff2f6] text-[#2d3e50] flex items-center justify-center">
              <GitBranch className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm text-[#2d3e50]">Automated Sequences</h3>
            <p className="text-xs text-[#516f90] leading-relaxed">
              Schedule multi-channel follow-ups, monitor completion statuses, and empower your sales team to convert faster.
            </p>
          </div>
        </div> */}
      </main>

      {/* Join Workspace Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 shadow-lg text-[#33475b] relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute right-4 top-4 text-[#7c98b6] hover:text-[#33475b]"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-9 w-9 rounded-md bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#2d3e50]">Join an Existing Workspace</h3>
                <p className="text-xs text-[#516f90]">Invitation required for SDR access</p>
              </div>
            </div>

            <p className="text-xs text-[#516f90] mb-4 leading-relaxed">
              To join an existing company workspace as an SDR, you need an active invitation from your workspace administrator. An invitation link was emailed to you if you were invited.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#33475b] mb-1">
                  Enter Invitation Link or Token
                </label>
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="https://.../invite/accept?token=... or token"
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#cbd6e2] focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-md border border-[#cbd6e2] text-[#516f90] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteInput.trim()}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-md bg-[#0091ae] text-white hover:bg-[#007a93] disabled:opacity-50"
                >
                  Continue to Accept
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-14 px-6 border-t border-[#dfe3eb] bg-white flex items-center justify-between text-xs text-[#7c98b6]">
        <div>&copy; {new Date().getFullYear()} LeadFlow Platform. All rights reserved.</div>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <Link href="/security" className="hover:underline">Security</Link>
        </div>
      </footer>
    </div>
  );
}
