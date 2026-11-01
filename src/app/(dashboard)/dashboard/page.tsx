'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users2,
  UserPlus,
  GitBranch,
  Layers,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';
import { EmailVerificationNotice } from '@/components/auth/EmailVerificationNotice';
import { InviteMemberModal } from '@/components/team/InviteMemberModal';
import { ROUTES } from '@/constants/routes';

export default function DashboardOverviewPage() {
  const { user, currentWorkspace } = useAuthContext();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [stats, setStats] = useState({
    teamMembersCount: 1,
    leadsCount: 0,
    sequencesCount: 0,
  });

  // Fetch real workspace stats from backend
  useEffect(() => {
    async function loadStats() {
      if (!currentWorkspace?.workspaceId) return;
      try {
        const res = await fetch('/api/workspaces/current');
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch (e) {
        console.warn('Failed to load workspace stats', e);
      }
    }
    loadStats();
  }, [currentWorkspace?.workspaceId]);

  const companyName = currentWorkspace?.companyName || user?.companyName || 'LeadFlow Workspace';

  return (
    <div className="space-y-8">
      {/* Email Verification Banner */}
      <EmailVerificationNotice />

      {/* Welcome Banner */}
      <div className="bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5f5f8] text-[#0091ae] mb-3">
            <Building2 className="h-3.5 w-3.5" />
            <span>Workspace Provisioned</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2d3e50] tracking-tight mb-2">
            Welcome to {companyName}
          </h1>
          <p className="text-xs sm:text-sm text-[#516f90] leading-relaxed mb-6">
            Your workspace has been successfully created. You are signed in as the workspace owner (
            <strong>{user?.email}</strong>). Follow the quick start actions below to build your sales engine.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] transition-all shadow-xs cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Invite your first SDR</span>
            </button>

            <Link
              href={ROUTES.WORKSPACE_TEAM}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-md font-semibold text-xs text-[#2d3e50] bg-white border border-[#cbd6e2] hover:bg-[#f8fafc] transition-all shadow-xs"
            >
              <Users2 className="h-4 w-4 text-[#0091ae]" />
              <span>Manage Team & Invitations</span>
            </Link>

            <Link
              href={ROUTES.LEADS}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-md font-semibold text-xs text-[#516f90] hover:text-[#2d3e50] hover:underline"
            >
              <span>Explore Leads & Pipeline</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live Workspace Metrics */}
      <div>
        <h2 className="text-sm font-bold text-[#2d3e50] uppercase tracking-wider mb-3">
          Workspace Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Metric 1: Team Members */}
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#516f90]">Team Members</span>
              <div className="h-7 w-7 rounded-md bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center">
                <Users2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2d3e50] mb-1">{stats.teamMembersCount}</div>
            <p className="text-[11px] text-[#7c98b6]">SDRs actively collaborating</p>
          </div>

          {/* Metric 2: Leads */}
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#516f90]">Leads</span>
              <div className="h-7 w-7 rounded-md bg-[#fff5f2] text-[#ff7a59] flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2d3e50] mb-1">{stats.leadsCount}</div>
            <p className="text-[11px] text-[#7c98b6]">0 leads in workspace pipeline</p>
          </div>

          {/* Metric 3: Sequences */}
          <div className="bg-white rounded-lg border border-[#dfe3eb] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#516f90]">Sequences</span>
              <div className="h-7 w-7 rounded-md bg-[#eff2f6] text-[#2d3e50] flex items-center justify-center">
                <GitBranch className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2d3e50] mb-1">{stats.sequencesCount}</div>
            <p className="text-[11px] text-[#7c98b6]">0 active outreach workflows</p>
          </div>
        </div>
      </div>

      {/* Clean SaaS Empty State Section */}
      <div className="bg-white rounded-lg border border-dashed border-[#cbd6e2] p-8 sm:p-12 text-center">
        <div className="h-14 w-14 rounded-full bg-[#fff5f2] text-[#ff7a59] flex items-center justify-center mx-auto mb-4">
          <UserPlus className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-bold text-[#2d3e50] mb-1">
          Your sales team workspace is ready
        </h3>
        <p className="text-xs text-[#516f90] max-w-md mx-auto mb-6">
          Start by inviting your Sales Development Representatives. Each invited member receives a secure single-use link to join your company&apos;s workspace.
        </p>

        <button
          type="button"
          onClick={() => setIsInviteOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] transition-all shadow-xs cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Invite Team Members</span>
        </button>
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={() => {
          fetch('/api/workspaces/current')
            .then((r) => r.json())
            .then((d) => d.stats && setStats(d.stats))
            .catch(() => {});
        }}
      />
    </div>
  );
}
