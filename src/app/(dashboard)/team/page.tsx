'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users2,
  UserPlus,
  Mail,
  Shield,
  Layers,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Crown,
  Briefcase,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { Button } from '@/components/ui/button';
import { TeamMember } from '@/types/crm';
import { toast } from 'sonner';

export default function TeamPage() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');

  const { team, leads, addTeamMember, bulkAssign } = useCRM();
  const { user, role, setRole } = useAuthContext();

  const [isInviteOpen, setIsInviteOpen] = useState(initialAction === 'invite');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Outbound SDR');

  // Pending invitations list
  const [pendingInvites, setPendingInvites] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      invitedAt: string;
    }>
  >([]);

  // Reassignment modal
  const [reassignMember, setReassignMember] = useState<TeamMember | null>(null);
  const [targetMemberId, setTargetMemberId] = useState('');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setPendingInvites([
      ...pendingInvites,
      {
        id: `inv_${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        invitedAt: 'Just now',
      },
    ]);

    setIsInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
    toast.success('Invitation dispatched per decision tree walkthrough');
  };

  const handleAcceptInvite = (invite: { id: string; name: string; email: string; role: string }) => {
    addTeamMember({
      name: invite.name,
      email: invite.email,
      role: invite.role,
      avatarBg: 'bg-[#0091ae]',
      initials: invite.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      assignedLeadsCount: 0,
      activeSequencesCount: 0,
      completedTasksWeek: 0,
      status: 'active',
    });
    setPendingInvites(pendingInvites.filter((i) => i.id !== invite.id));
    toast.success(`${invite.name} accepted invitation and joined workspace!`);
  };

  const handleDeclineInvite = (id: string) => {
    setPendingInvites(pendingInvites.filter((i) => i.id !== id));
    toast.info('Invitation declined per decision tree branch.');
  };

  const handleReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignMember || !targetMemberId) return;

    const leadsToReassign = leads.filter((l) => l.assignedToId === reassignMember.id).map((l) => l.id);
    if (leadsToReassign.length > 0) {
      bulkAssign(leadsToReassign, targetMemberId);
    } else {
      toast.info('No leads currently assigned to this member.');
    }
    setReassignMember(null);
  };

  if (role && role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-[#dfe3eb] rounded-xl text-center shadow-xs">
        <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[#2d3e50] mb-2">Workspace Owner Access Required</h2>
        <p className="text-xs text-[#516f90] mb-6 leading-relaxed">
          Team member management and invitations are reserved for Workspace Owners. As an Outbound SDR, you can manage your assigned leads and outreach sequences from your dashboard.
        </p>
        <Button
          onClick={() => (window.location.href = '/dashboard')}
          className="bg-[#ff7a59] hover:bg-[#e66343] text-white text-xs font-semibold"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#33475b]">
            Team Members &amp; Workspace Ownership
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin owner controls, member invites, and SDR prospect workload distribution.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsInviteOpen(true)}
          className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-semibold shadow-xs"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Invite Teammate</span>
        </Button>
      </div>



      {/* Active Team Cards Grid */}
      <div>
        <h3 className="font-bold text-[#33475b] uppercase tracking-wider text-xs mb-3">
          Active Workspace Members ({team.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {team.map((member) => {
            const memberLeads = leads.filter(
              (l) => l.assignedToId === member.id && l.disposition !== 'archived'
            );
            const isAdminMember = member.email.includes('admin') || member.role.toLowerCase().includes('admin');

            return (
              <div
                key={member.id}
                className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#b2d5e5] transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2d3e50] text-white font-bold text-sm shadow-xs">
                        {member.initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-[#33475b] truncate">
                            {member.name}
                          </p>
                          {isAdminMember && (
                            <span title="Workspace Admin">
                              <Crown className="h-3.5 w-3.5 text-[#ff7a59]" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{member.role}</p>
                      </div>
                    </div>

                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        member.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                      title={member.status}
                    />
                  </div>

                  <div className="text-[11px] text-slate-500 truncate">
                    {member.email}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#dfe3eb] text-[11px]">
                    <div className="p-2 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                      <span className="text-slate-400 text-[10px] block font-semibold uppercase">Assigned Leads</span>
                      <span className="font-bold text-[#33475b] text-base">
                        {memberLeads.length}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#f5f8fa] border border-[#dfe3eb]">
                      <span className="text-slate-400 text-[10px] block font-semibold uppercase">Tasks Done</span>
                      <span className="font-bold text-emerald-600 text-base">
                        {member.completedTasksWeek}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="pt-2 border-t border-[#dfe3eb] flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReassignMember(member);
                      setTargetMemberId(team.find((m) => m.id !== member.id)?.id || '');
                    }}
                    className="h-7 text-xs border-[#cbd6e2] text-[#33475b] hover:bg-[#f5f8fa]"
                  >
                    <UserCheck className="h-3 w-3 mr-1 text-[#0091ae]" />
                    <span>Reassign Leads</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Tree: Pending Invitations & Simulation */}
      {pendingInvites.length > 0 && (
        <div className="rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dfe3eb]">
            <div>
              <h3 className="font-bold text-sm text-[#33475b]">
                Pending Teammate Invitations (Walkthrough Simulation)
              </h3>
              <p className="text-[11px] text-slate-500">
                Decision tree branch: Teammate receives invite and can Accept (joins team) or Decline (access not granted).
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200">
              {pendingInvites.length} Pending
            </span>
          </div>

          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-md bg-[#f5f8fa] border border-[#dfe3eb] text-xs"
              >
                <div>
                  <p className="font-bold text-[#33475b]">{inv.name}</p>
                  <p className="text-[11px] text-slate-500">{inv.email} · {inv.role}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(inv)}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    <span>Accept (Simulate)</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeclineInvite(inv.id)}
                    className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    <span>Decline</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b]">
                Invite Team Member
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Grant SDR or AE access to LeadFlow pipeline workspace.
              </p>
            </div>

            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jordan.lee@leadflow.io"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  <option value="Outbound SDR">Outbound SDR</option>
                  <option value="Lead SDR">Lead SDR</option>
                  <option value="Account Executive">Account Executive</option>
                  <option value="Sales Operations">Sales Operations</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsInviteOpen(false)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b]">
                Reassign Leads from {reassignMember.name}
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Transfer all assigned prospects to another team member.
              </p>
            </div>

            <form onSubmit={handleReassign} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Transfer To</label>
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  {team
                    .filter((m) => m.id !== reassignMember.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setReassignMember(null)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Confirm Reassignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
