'use client';

import React, { useState } from 'react';
import { Mail, Shield, UserPlus, X, AlertCircle, CheckCircle2, Loader2, ArrowRight, Copy, Check, ExternalLink } from 'lucide-react';
import { isValidEmail } from '@/utils/validation';
import { useAuthContext } from '@/context/AuthProvider';
import { authRepository } from '@/repositories/auth.repository';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentWorkspace } = useAuthContext();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'sdr' | 'ae'>('sdr');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [canResendId, setCanResendId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [deliveryProvider, setDeliveryProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setEmail('');
    setRole('sdr');
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedLink(null);
    setDeliveryProvider(null);
    setCanResendId(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setCanResendId(null);
    setGeneratedLink(null);

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
        body: JSON.stringify({ email: trimmed, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.canResend && data.invitationId) {
          setCanResendId(data.invitationId);
        }
        setErrorMsg(data.error || 'Failed to send invitation.');
        setIsSubmitting(false);
        return;
      }

      setGeneratedLink(data.invitationLink || null);
      setDeliveryProvider(data.provider || null);
      setSuccessMsg(`Invitation created for ${trimmed} as ${role === 'ae' ? 'Account Executive (AE)' : 'Sales Development Rep (SDR)'} with 48-hour secure token.`);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Network error sending invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!canResendId) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedLink(null);

    try {
      const idToken = await authRepository.getIdToken();
      const res = await fetch('/api/invitations/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-workspace-id': currentWorkspace?.workspaceId || '',
        },
        body: JSON.stringify({ invitationId: canResendId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to resend invitation.');
        return;
      }

      setGeneratedLink(data.invitationLink || null);
      setDeliveryProvider(data.provider || null);
      setSuccessMsg('Invitation has been refreshed with a new single-use token.');
      setCanResendId(null);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to resend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-lg border border-[#dfe3eb] p-6 shadow-xl text-[#33475b] relative animate-in fade-in zoom-in-95">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-[#7c98b6] hover:text-[#33475b]"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-9 w-9 rounded-md bg-[#fff5f2] text-[#ff7a59] flex items-center justify-center">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#2d3e50]">Invite Team Member</h3>
            <p className="text-xs text-[#516f90]">
              Workspace: {currentWorkspace?.companyName || 'LeadFlow Workspace'}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div>{errorMsg}</div>
              {canResendId && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isSubmitting}
                  className="font-semibold text-rose-800 underline hover:no-underline cursor-pointer"
                >
                  Click here to resend the pending invitation now
                </button>
              )}
            </div>
          </div>
        )}

        {/* If an invitation link was generated (either new or resent) */}
        {generatedLink ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            </div>

            {deliveryProvider === 'console-dev' && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Outbound Email Provider Not Configured in .env.local</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  No SMTP credentials or Resend API key were found in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code>. The invitation email was logged to the terminal console. Copy the link below to share it directly with the SDR or test the signup flow.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#2d3e50]">
                Single-Use Invitation Link (48-Hour Validity)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd6e2] rounded-md font-mono text-[#2d3e50] focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3.5 py-2 bg-[#ff7a59] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 hover:bg-[#e66343] transition-colors shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#edf1f5]">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-semibold text-[#0091ae] hover:underline"
              >
                + Invite another team member
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="py-2 px-4 text-xs font-semibold rounded-md bg-[#2d3e50] text-white hover:bg-[#1e2b37]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Team Member Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-[#cbd6e2] focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#7c98b6]">
                A single-use 48-hour secure acceptance link will be generated and dispatched.
              </p>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Assign Role <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    role === 'sdr'
                      ? 'border-[#0091ae] bg-[#f0f9fb] ring-1 ring-[#0091ae]'
                      : 'border-[#dfe3eb] bg-white hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#2d3e50]">SDR</span>
                    <input
                      type="radio"
                      name="inviteRole"
                      value="sdr"
                      checked={role === 'sdr'}
                      onChange={() => setRole('sdr')}
                      className="text-[#0091ae] focus:ring-[#0091ae]"
                    />
                  </div>
                  <p className="text-[10px] text-[#516f90] mt-1 leading-snug">
                    Sales Development Rep. Prospecting, outreach &amp; lead qualification.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    role === 'ae'
                      ? 'border-[#7c3aed] bg-[#f5f3ff] ring-1 ring-[#7c3aed]'
                      : 'border-[#dfe3eb] bg-white hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#2d3e50]">AE</span>
                    <input
                      type="radio"
                      name="inviteRole"
                      value="ae"
                      checked={role === 'ae'}
                      onChange={() => setRole('ae')}
                      className="text-[#7c3aed] focus:ring-[#7c3aed]"
                    />
                  </div>
                  <p className="text-[10px] text-[#516f90] mt-1 leading-snug">
                    Account Executive. Deal closing, pipeline management &amp; personalized cadences.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="py-2 px-3.5 text-xs font-semibold rounded-md border border-[#cbd6e2] text-[#516f90] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="flex items-center gap-1.5 py-2 px-4 text-xs font-semibold rounded-md bg-[#ff7a59] text-white hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Invitation</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
