'use client';

import React, { useState } from 'react';
import { Mail, RefreshCw, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';

export const EmailVerificationNotice: React.FC = () => {
  const { user, emailVerified, resendVerificationEmail, refreshUser } = useAuthContext();
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  if (emailVerified || !user) return null;

  const handleResend = async () => {
    setIsSending(true);
    setMsg('');
    try {
      await resendVerificationEmail();
      setMsg('Verification email resent! Check your inbox and spam folder.');
    } catch (e) {
      setMsg((e as Error).message || 'Failed to resend email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setMsg('');
    try {
      await refreshUser();
      setMsg('Status refreshed.');
    } catch (e) {
      setMsg((e as Error).message || 'Failed to refresh status.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-[#33475b] shadow-2xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5 sm:mt-0">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
              <span>Email Verification Required</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-800 font-medium">
                Pending
              </span>
            </div>
            <p className="text-xs text-amber-800/90 mt-0.5">
              A verification link was sent to <strong className="font-semibold">{user.email}</strong>. Please verify your email before running sensitive outreach campaigns.
            </p>
            {msg && <p className="text-xs font-semibold text-amber-900 mt-1">{msg}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/70 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Send className="h-3 w-3" />
            <span>{isSending ? 'Sending...' : 'Resend Email'}</span>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>
    </div>
  );
};

