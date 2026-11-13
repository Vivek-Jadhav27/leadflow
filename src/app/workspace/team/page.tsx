'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users2,
  UserPlus,
  Mail,
  Shield,
  Clock,
  RotateCcw,
  Ban,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  ChevronRight,
  Send,
  XCircle,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';
import { InviteMemberModal } from '@/components/team/InviteMemberModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { authRepository } from '@/repositories/auth.repository';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ROUTES } from '@/constants/routes';

interface MemberItem {
  uid: string;
  role: 'admin' | 'sdr' | 'ae';
  status: 'active' | 'suspended' | 'removed';
  joinedAt: string;
  isOwner: boolean;
  user: {
    name: string;
    email: string;
  };
}

interface InvitationItem {
  invitationId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export default function WorkspaceTeamPage() {
  const { currentWorkspace, role, isAdmin } = useAuthContext();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [latestResentLink, setLatestResentLink] = useState<{ email: string; link: string; provider: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  const loadTeamData = useCallback(async () => {
    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/workspaces/members', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to load team data.');
      }
    } catch (e) {
      setErrorMsg('Failed to connect to team management API.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.workspaceId]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  // Handle member actions (suspend, activate, remove)
  const handleMemberAction = async (targetUid: string, action: 'suspend' | 'activate' | 'remove') => {
    setActionLoading(targetUid);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/workspaces/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
        body: JSON.stringify({ targetUid, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Operation failed.');
        return;
      }

      setSuccessMsg(data.message || 'Operation succeeded.');
      await loadTeamData();
    } catch (e) {
      setErrorMsg('Network error updating member.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle invitation resend
  const handleResendInvite = async (invitationId: string) => {
    setActionLoading(invitationId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/invitations/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
        body: JSON.stringify({ invitationId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to resend invitation.');
        return;
      }

      if (data.invitationLink) {
        setLatestResentLink({
          email: data.email || 'SDR',
          link: data.invitationLink,
          provider: data.provider || 'console-dev',
        });
      }

      setSuccessMsg(data.message || 'Invitation refreshed and resent successfully.');
      await loadTeamData();
    } catch (e) {
      setErrorMsg('Network error resending invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle invitation revoke
  const handleRevokeInvite = async (invitationId: string) => {
    setActionLoading(invitationId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/invitations/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
        body: JSON.stringify({ invitationId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to revoke invitation.');
        return;
      }

      setSuccessMsg('Invitation revoked successfully.');
      await loadTeamData();
    } catch (e) {
      setErrorMsg('Network error revoking invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  if (role && role !== 'admin') {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-[#dfe3eb] rounded-xl text-center shadow-xs">
          <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[#2d3e50] mb-2">Workspace Owner Access Required</h2>
          <p className="text-xs text-[#516f90] mb-6 leading-relaxed">
            Team and member management is restricted to Workspace Owners. As an Outbound SDR, you can manage your prospects, outreach sequences, and daily follow-up tasks from your dashboard.
          </p>
          <Link
            href={ROUTES.DASHBOARD}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] transition-all shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#2d3e50]">Team & Workspace Access</h1>
            </div>


          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#ff7a59] text-white hover:bg-[#e66343] transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite SDR</span>
          </button>
          </div>


        {errorMsg && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
            </div>

        )}

        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {latestResentLink && (
          <div className="p-4 rounded-md bg-[#fff8f5] border border-[#ffcfc2] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#2d3e50]">
                Single-Use Invitation Link for {latestResentLink.email}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(latestResentLink.link);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-[#ff7a59] text-white font-medium hover:bg-[#e66343] transition-colors cursor-pointer text-xs"
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <input
              readOnly
              value={latestResentLink.link}
              className="w-full px-2.5 py-1.5 bg-white border border-[#cbd6e2] rounded font-mono text-[11px] text-[#2d3e50] select-all focus:outline-none"
            />
            {latestResentLink.provider === 'console-dev' && (
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ⚠️ Outbound email delivery is in <strong>local development fallback mode</strong> because no SMTP or Resend credentials were found in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code>. The email was logged to your dev terminal. Copy the link above to test or share directly.
              </p>
            )}
          </div>
        )}

        {/* Section 1: Active Workspace Members */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#edf1f5] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#2d3e50] flex items-center gap-2">
                <Users2 className="h-4 w-4 text-[#0091ae]" />
                <span>Workspace Members ({members.length})</span>
              </h2>
              <p className="text-[11px] text-[#7c98b6]">Authenticated users with role-scoped access</p>
              </div>

            </div>


          {loading ? (
            <div className="p-8 text-center text-xs text-[#7c98b6] flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#ff7a59]" />
              <span>Loading workspace members...</span>
              </div>

          ) : members.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7c98b6]">
              No members found in this workspace.
              </div>

          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#516f90] border-b border-[#edf1f5] text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {members.map((m) => (
                    <tr key={m.uid} className="hover:bg-[#fbfcfe] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {m.user.name.slice(0, 2) || 'U'}
                            </div>

                          <div>
                            <div className="font-semibold text-[#2d3e50] flex items-center gap-1.5">
                              <span>{m.user.name}</span>
                              {m.isOwner && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                  <Crown className="h-2.5 w-2.5" />
                                  <span>Owner</span>
                                </span>
                              )}
                              </div>

                            <div className="text-[11px] text-[#7c98b6]">{m.user.email}</div>
                            </div>

                          </div>

                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.role === 'admin'
                              ? 'bg-[#fff5f2] text-[#ff7a59] border border-[#ff7a59]/30'
                              : (m.role === 'ae'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-[#e5f5f8] text-[#0091ae] border border-[#0091ae]/30')
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : m.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-[11px] text-[#516f90]">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {m.isOwner ? (
                          <span className="text-[11px] text-[#7c98b6] italic">Protected Owner</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {m.status === 'active' ? (
                              <button
                                type="button"
                                disabled={actionLoading === m.uid}
                                onClick={() =>
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Suspend Team Member',
                                    description: `Are you sure you want to suspend ${m.user.name}? They will immediately lose access to all workspace CRM activities until activated.`,
                                    confirmLabel: 'Suspend Member',
                                    onConfirm: () => handleMemberAction(m.uid, 'suspend'),
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 rounded border border-amber-200"
                              >
                                Suspend
                              </button>
                            ) : m.status === 'suspended' ? (
                              <button
                                type="button"
                                disabled={actionLoading === m.uid}
                                onClick={() => handleMemberAction(m.uid, 'activate')}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200"
                              >
                                Activate
                              </button>
                            ) : null}

                            {m.status !== 'removed' && (
                              <button
                                type="button"
                                disabled={actionLoading === m.uid}
                                onClick={() =>
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Remove Team Member',
                                    description: `Are you sure you want to permanently remove ${m.user.name} from this workspace? They must be explicitly reinvited before regaining access.`,
                                    confirmLabel: 'Remove Member',
                                    onConfirm: () => handleMemberAction(m.uid, 'remove'),
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                              >
                                Remove
                              </button>
                            )}
                            </div>

                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

          )}
          </div>


        {/* Section 2: Invitations Management */}
        <div className="bg-white rounded-lg border border-[#dfe3eb] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#edf1f5] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#2d3e50] flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#ff7a59]" />
                <span>Dispatched Invitations ({invitations.length})</span>
              </h2>
              <p className="text-[11px] text-[#7c98b6]">Cryptographic single-use invitations with 48h expiry</p>
              </div>

            </div>


          {loading ? (
            <div className="p-8 text-center text-xs text-[#7c98b6]">Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7c98b6]">
              No invitations have been sent yet. Click &quot;Invite SDR&quot; to invite sales reps.
              </div>

          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#516f90] border-b border-[#edf1f5] text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Invited Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Sent Date</th>
                    <th className="px-4 py-3">Expires At</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {invitations.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) <= new Date() && inv.status === 'pending';
                    const displayStatus = isExpired ? 'expired' : inv.status;

                    return (
                      <tr key={inv.invitationId} className="hover:bg-[#fbfcfe] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[#2d3e50]">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-[#7c98b6]" />
                            <span>{inv.email}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              inv.role === 'ae'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                            }`}
                          >
                            {inv.role || 'sdr'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-[11px] text-[#516f90]">
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}
                        </td>

                        <td className="px-4 py-3.5 text-[11px] text-[#516f90]">
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : '—'}
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              displayStatus === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : displayStatus === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : displayStatus === 'expired'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.status !== 'accepted' && (
                              <button
                                type="button"
                                disabled={actionLoading === inv.invitationId}
                                onClick={() => handleResendInvite(inv.invitationId)}
                                className="px-2 py-1 text-[11px] font-semibold text-[#0091ae] hover:bg-[#e5f5f8] rounded border border-[#0091ae]/30"
                              >
                                Resend
                              </button>
                            )}

                            {inv.status === 'pending' && !isExpired && (
                              <button
                                type="button"
                                disabled={actionLoading === inv.invitationId}
                                onClick={() =>
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Revoke Invitation',
                                    description: `Are you sure you want to revoke the invitation for ${inv.email}? The invitation link will immediately become invalid.`,
                                    confirmLabel: 'Revoke Invitation',
                                    onConfirm: () => handleRevokeInvite(inv.invitationId),
                                  })
                                }
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                              >
                                Revoke
                              </button>
                            )}
                            </div>

                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

          )}
        </div>

        {/* Invite Member Modal */}
        <InviteMemberModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          onSuccess={() => loadTeamData()}
        />

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog((p) => ({ ...p, isOpen: false }));
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
        />
      </div>
    </DashboardLayout>
  );
}
