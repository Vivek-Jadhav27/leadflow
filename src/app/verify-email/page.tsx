'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, Send, CheckCircle2, ArrowRight, LogOut } from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, emailVerified, resendVerificationEmail, refreshUser, logout } = useAuthContext();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setFeedback(null);
    try {
      await resendVerificationEmail();
      setFeedback({
        type: 'success',
        message: 'A fresh verification link has been sent to your email inbox.',
      });
    } catch (e) {
      setFeedback({
        type: 'error',
        message: (e as Error).message || 'Failed to resend verification email.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      await refreshUser();
      if (emailVerified) {
        setFeedback({
          type: 'success',
          message: 'Your email has been verified! Redirecting to workspace...',
        });
        setTimeout(() => {
          router.push('/workspace/dashboard');
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          message: 'Email is not yet verified. Please click the verification link in your email.',
        });
      }
    } catch (e) {
      setFeedback({
        type: 'error',
        message: 'Could not refresh status. Please try again.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-base tracking-tight text-[#2d3e50]">LeadFlow</span>
        </Link>

        {user && (
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="flex items-center gap-1.5 text-xs text-[#516f90] hover:text-[#2d3e50]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-center space-y-5">
          <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <Mail className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-[#2d3e50]">Verify your email address</h1>
            <p className="text-xs text-[#516f90] mt-1 leading-relaxed">
              We&apos;ve sent an email verification link to:
            </p>
            <p className="font-semibold text-xs text-[#2d3e50] mt-1 bg-[#f8fafc] py-1.5 px-3 rounded border border-[#e2e8f0] inline-block">
              {user?.email || 'your-email@company.com'}
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-md text-xs flex items-center gap-2 text-left ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <p className="text-[11px] text-[#7c98b6] leading-relaxed">
            Click the link in the verification email to activate full workspace outreach features. Check your spam or promotions folder if you don&apos;t see it within a few minutes.
          </p>

          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>I&apos;ve verified my email</span>
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold text-xs text-[#516f90] bg-[#f8fafc] border border-[#cbd6e2] hover:bg-[#edf1f5] disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isResending ? 'Sending...' : 'Resend Verification Email'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[#edf1f5]">
            <Link
              href="/workspace/onboarding"
              className="inline-flex items-center gap-1.5 text-xs text-[#0091ae] hover:underline font-medium"
            >
              <span>Continue to Workspace Overview</span>
              <ArrowRight className="h-3 w-3" />
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

