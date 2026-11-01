'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { isValidEmail } from '@/utils/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.sendPasswordResetEmail(trimmed);
      setSubmitted(true);
    } catch (e) {
      // Per Section 9: Do not reveal whether account exists; show generic success or handle network failure
      const msg = (e as Error).message || '';
      if (msg.includes('network') || msg.includes('connection')) {
        setErrorMsg('Network error. Please try again.');
      } else {
        // Safe generic completion to prevent email enumeration
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
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
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-[#2d3e50]">Reset your password</h1>
            <p className="text-xs text-[#516f90]">
              Enter your registered email address to receive password reset instructions.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Password reset link dispatched</span>
                  <p className="text-emerald-700 leading-relaxed">
                    If an account exists for <strong className="font-semibold">{email}</strong>, you will receive an email with instructions to securely reset your password.
                  </p>
                </div>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0091ae] hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#33475b] mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={isSubmitting}
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-[#cbd6e2] focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sending reset email...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#516f90] hover:text-[#2d3e50]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#7c98b6]">
        &copy; {new Date().getFullYear()} LeadFlow Inc.
      </footer>
    </div>
  );
}

