'use client';

import React, { useState, useEffect, Suspense, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Building2,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';
import { isValidEmail } from '@/utils/validation';
import { ROUTES } from '@/constants/routes';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const { login, selectWorkspace, isAuthenticated, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/workspace/onboarding');
    }
  }, [isAuthenticated, loading, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [accountDisabled, setAccountDisabled] = useState(false);

  // Workspace selector state if user belongs to multiple workspaces
  const [workspacesList, setWorkspacesList] = useState<Array<{ workspaceId: string; companyName: string }>>([]);
  const [showWorkspaceSelector, setShowWorkspaceSelector] = useState(false);

  // Form field IDs
  const emailId = useId();
  const passwordId = useId();
  const rememberMeId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAccountDisabled(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password, rememberMe);

      // Check if there was a redirect URL (e.g. from invitation link)
      if (redirectUrl) {
        router.replace(redirectUrl);
        return;
      }

      // Check user session context via fetch
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();

        // Check if multiple workspaces
        if (data.workspaces && data.workspaces.length > 1) {
          setWorkspacesList(data.workspaces);
          setShowWorkspaceSelector(true);
          setIsSubmitting(false);
          return;
        }

        // Role-based routing
        if (data.role === 'admin') {
          router.replace('/workspace/onboarding');
        } else {
          router.replace('/sdr/dashboard');
        }
      } else {
        router.replace(ROUTES.DASHBOARD);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Invalid email or password.';
      if (msg.includes('disabled')) {
        setAccountDisabled(true);
      } else {
        setErrorMsg(msg);
      }
      setIsSubmitting(false);
    }
  };

  const handleSelectWorkspace = async (workspaceId: string) => {
    setIsSubmitting(true);
    try {
      await selectWorkspace(workspaceId);
      router.replace('/workspace/onboarding');
    } catch (e) {
      setErrorMsg('Failed to set active workspace.');
      setIsSubmitting(false);
    }
  };

  // If account is disabled
  if (accountDisabled) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#2d3e50]">Account Disabled</h1>
        <p className="text-xs text-[#516f90] leading-relaxed">
          Your account has been disabled. Please contact your company workspace administrator to restore access.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center py-2 px-4 rounded-md text-xs font-semibold text-[#0091ae] hover:underline"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // Workspace selector modal if account belongs to multiple workspaces
  if (showWorkspaceSelector) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs space-y-4">
        <div className="text-center space-y-1">
          <div className="h-10 w-10 mx-auto rounded-full bg-[#e5f5f8] text-[#0091ae] flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-[#2d3e50]">Select Workspace</h1>
          <p className="text-xs text-[#516f90]">
            You have active membership in multiple workspaces. Choose one to open:
          </p>
        </div>

        <div className="space-y-2 pt-2">
          {workspacesList.map((ws) => (
            <button
              key={ws.workspaceId}
              type="button"
              onClick={() => handleSelectWorkspace(ws.workspaceId)}
              className="w-full p-3 rounded-md border border-[#dfe3eb] hover:border-[#ff7a59] hover:bg-[#fff5f2] text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="font-semibold text-xs text-[#2d3e50] block group-hover:text-[#ff7a59]">
                  {ws.companyName}
                </span>
                <span className="text-[11px] text-[#7c98b6]">ID: {ws.workspaceId}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-[#7c98b6] group-hover:text-[#ff7a59] transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-[#2d3e50] tracking-tight">Sign in to LeadFlow</h1>
        <p className="text-xs text-[#516f90]">
          Enter your credentials to access your sales workspace
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor={emailId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
            <input
              id={emailId}
              type="email"
              value={email}
               onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={isSubmitting}
              required
              className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-[#cbd6e2] bg-white focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={passwordId} className="block text-xs font-semibold text-[#33475b]">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-[#0091ae] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSubmitting}
              required
              className="w-full pl-9 pr-10 py-2 text-xs rounded-md border border-[#cbd6e2] bg-white focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-[#7c98b6] hover:text-[#33475b]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label htmlFor={rememberMeId} className="flex items-center gap-2 cursor-pointer text-[#516f90]">
            <input
              id={rememberMeId}
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-[#cbd6e2] text-[#ff7a59] focus:ring-[#ff7a59] h-3.5 w-3.5"
            />
            <span>Remember me on this browser</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="text-center pt-3 border-t border-[#edf1f5] text-xs text-[#516f90] space-y-2">
        <div>
          Need a company workspace?{' '}
          <Link href="/signup/admin" className="font-semibold text-[#ff7a59] hover:underline">
            Create an Admin Workspace
          </Link>
        </div>
        <div>
          Are you an SDR?{' '}
          <Link href="/signup" className="text-[#0091ae] hover:underline">
            Join with invitation link
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      {/* Top Header */}
      <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-base tracking-tight text-[#2d3e50]">LeadFlow</span>
        </Link>

        <Link
          href={ROUTES.WALKTHROUGH}
          className="text-xs font-semibold text-[#0091ae] hover:text-[#007a93] flex items-center gap-1.5 transition-colors"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Architecture Canvas</span>
        </Link>
      </header>

      {/* Main Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Suspense
          fallback={
            <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-8 text-center text-xs text-[#7c98b6]">
              Loading sign in...
            </div>
          }
        >
          <LoginContent />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#7c98b6]">
        &copy; {new Date().getFullYear()} LeadFlow Inc. All rights reserved.
      </footer>
    </div>
  );
}
