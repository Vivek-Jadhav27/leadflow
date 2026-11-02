'use client';

import React, { useState, useEffect, Suspense, useId } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  LogOut,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { useAuthContext } from '@/context/AuthProvider';
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList';
import { checkPasswordRequirements } from '@/utils/validation';

interface InvitationValidationResponse {
  valid: boolean;
  reason?: string;
  message?: string;
  invitationId?: string;
  companyName?: string;
  companyLinkedinUrl?: string | null;
  email?: string;
  role?: string;
}

function InvitationAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const {
    user,
    isAuthenticated,
    sdrSignUpAndAccept,
    acceptExistingInvitation,
    logout,
  } = useAuthContext();

  const [loadingValidation, setLoadingValidation] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InvitationValidationResponse | null>(null);

  // Form states for new SDR signup
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form field IDs
  const fullNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  // Validate invitation token with backend API on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInviteInfo({
          valid: false,
          reason: 'missing_token',
          message: 'No invitation token was supplied in this URL.',
        });
        setLoadingValidation(false);
        return;
      }

      try {
        const res = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        setInviteInfo(data);
      } catch (e) {
        setInviteInfo({
          valid: false,
          reason: 'network_error',
          message: 'Failed to contact the invitation server. Please check your connection.',
        });
      } finally {
        setLoadingValidation(false);
      }
    }

    validateToken();
  }, [token]);

  // Validation checks for SDR signup form
  const isFullNameValid = fullName.trim().length >= 2 && fullName.trim().length <= 80;
  const passwordReqs = checkPasswordRequirements(password);
  const isConfirmPasswordValid = confirmPassword.length > 0 && confirmPassword === password;
  const isFormValid = isFullNameValid && passwordReqs.isValid && isConfirmPasswordValid;

  // Handler for New SDR Signup & Accept
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isFormValid || isSubmitting || !inviteInfo?.email) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await sdrSignUpAndAccept({
        fullName: fullName.trim(),
        email: inviteInfo.email,
        password,
        token,
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push('/sdr/dashboard');
      }, 1500);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to complete registration.');
      setIsSubmitting(false);
    }
  };

  // Handler for Existing User Accepting
  const handleExistingUserAccept = async () => {
    if (!token || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await acceptExistingInvitation(token);
      setSubmitSuccess(true);
      setTimeout(() => {
        router.push('/sdr/dashboard');
      }, 1500);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to accept invitation.');
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (loadingValidation) {
    return (
      <div className="min-h-screen bg-[#f5f8fa] flex items-center justify-center text-[#33475b]">
        <div className="flex items-center gap-2.5 text-xs font-semibold">
          <Loader2 className="h-4 w-4 animate-spin text-[#ff7a59]" />
          <span>Verifying invitation credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Invalid / Expired / Revoked State
  if (!inviteInfo || !inviteInfo.valid) {
    const reason = inviteInfo?.reason;
    let title = 'Invalid Invitation';
    let icon = <XCircle className="h-8 w-8 text-rose-500" />;

    if (reason === 'expired') {
      title = 'Invitation Expired';
      icon = <Clock className="h-8 w-8 text-amber-500" />;
    } else if (reason === 'revoked') {
      title = 'Invitation Revoked';
      icon = <XCircle className="h-8 w-8 text-rose-500" />;
    } else if (reason === 'already_accepted') {
      title = 'Invitation Already Used';
      icon = <CheckCircle2 className="h-8 w-8 text-emerald-500" />;
    }

    return (
      <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
        <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              L
            </div>
            <span className="font-bold text-base tracking-tight text-[#2d3e50]">LeadFlow</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
              {icon}
            </div>

            <h1 className="text-xl font-bold text-[#2d3e50]">{title}</h1>
            <p className="text-xs text-[#516f90] leading-relaxed">
              {inviteInfo?.message || 'This invitation link is not valid or has expired.'}
            </p>

            <div className="pt-4 border-t border-[#edf1f5] space-y-2">
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center py-2 px-4 rounded-md font-semibold text-xs text-white bg-[#2d3e50] hover:bg-[#1e2b37]"
              >
                Sign In to Existing Account
              </Link>
              <div>
                <Link href="/" className="text-xs text-[#0091ae] hover:underline font-medium">
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-[#7c98b6]">
          &copy; {new Date().getFullYear()} LeadFlow Platform
        </footer>
      </div>
    );
  }

  // 3. Authenticated user email mismatch check
  const isEmailMismatch =
    isAuthenticated &&
    user?.email &&
    inviteInfo.email &&
    user.email.toLowerCase().trim() !== inviteInfo.email.toLowerCase().trim();

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      {/* Header */}
      <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-base tracking-tight text-[#2d3e50]">LeadFlow</span>
        </Link>

        <div className="text-xs text-[#516f90]">
          Invited as: <strong className="font-semibold text-[#2d3e50]">{inviteInfo.email}</strong>
        </div>
      </header>

      {/* Main Acceptance Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-lg bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs">
          {/* Step 2: Display Invitation Details */}
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#e5f5f8] text-[#0091ae]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Workspace Invitation</span>
            </div>

            <h1 className="text-2xl font-bold text-[#2d3e50] tracking-tight">
              Join {inviteInfo.companyName}
            </h1>

            <p className="text-xs text-[#516f90]">
              You have been invited to collaborate as an{' '}
              <span className="font-bold text-[#ff7a59]">
                {inviteInfo.role === 'ae' ? 'Account Executive (AE)' : 'Outbound SDR'}
              </span>{' '}
              on LeadFlow.
            </p>

            {inviteInfo.companyLinkedinUrl && (
              <div className="inline-flex items-center gap-1.5 text-xs text-[#0091ae] hover:underline pt-1">
                <Linkedin className="h-3.5 w-3.5" />
                <a href={inviteInfo.companyLinkedinUrl} target="_blank" rel="noopener noreferrer">
                  {inviteInfo.companyLinkedinUrl}
                </a>
              </div>
            )}
          </div>

          {submitError && (
            <div className="mb-5 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{submitError}</div>
            </div>
          )}

          {submitSuccess && (
            <div className="mb-5 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Invitation accepted!</span>
                <span>Setting up your workspace dashboard...</span>
              </div>
            </div>
          )}

          {/* Condition A: Logged in as a DIFFERENT user than invited */}
          {isEmailMismatch ? (
            <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-3">
              <div className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <span>Account Email Mismatch</span>
              </div>
              <p>
                You are currently signed in as <strong>{user?.email}</strong>, but this invitation was issued to{' '}
                <strong>{inviteInfo.email}</strong>.
              </p>
              <p className="text-amber-800">
                To accept this invitation, please log out and sign in with the invited email address.
              </p>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out and switch account</span>
              </button>
            </div>
          ) : isAuthenticated && user?.email?.toLowerCase().trim() === inviteInfo.email?.toLowerCase().trim() ? (
            /* Condition B: Logged in with MATCHING invited email -> One-click Accept */
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-2">
                <span className="font-semibold text-[#2d3e50] block">Existing Account Detected</span>
                <p className="text-[#516f90]">
                  You are currently signed in as <strong>{user?.email}</strong>. Click below to add{' '}
                  <strong>{inviteInfo.companyName}</strong> to your workspaces.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExistingUserAccept}
                disabled={isSubmitting || submitSuccess}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Accepting Invitation...</span>
                  </>
                ) : (
                  <>
                    <span>Accept and Join Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Condition C: Not signed in -> New SDR Registration Form */
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor={fullNameId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                  <input
                    id={fullNameId}
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                    placeholder="e.g. Alex Morgan"
                    disabled={isSubmitting || submitSuccess}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                      touched.fullName && !isFullNameValid
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-[#cbd6e2] focus:border-[#0091ae]'
                    }`}
                  />
                </div>
                {touched.fullName && !isFullNameValid && (
                  <p className="mt-1 text-[11px] text-rose-500">Full name must be at least 2 characters.</p>
                )}
              </div>

              {/* Pre-filled Email (Read-only) */}
              <div>
                <label htmlFor={emailId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                  <input
                    id={emailId}
                    type="email"
                    value={inviteInfo.email || ''}
                    readOnly
                    disabled
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-[#cbd6e2] bg-[#f8fafc] text-[#516f90] cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#7c98b6]">Locked to the invited address.</p>
              </div>

              {/* Password */}
              <div>
                <label htmlFor={passwordId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                  Create Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                    placeholder="••••••••••••"
                    disabled={isSubmitting || submitSuccess}
                    className={`w-full pl-9 pr-10 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                      touched.password && !passwordReqs.isValid
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-[#cbd6e2] focus:border-[#0091ae]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#7c98b6] hover:text-[#33475b]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordRequirementsList password={password} showAlways={touched.password || password.length > 0} />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor={confirmPasswordId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                  <input
                    id={confirmPasswordId}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                    placeholder="••••••••••••"
                    disabled={isSubmitting || submitSuccess}
                    className={`w-full pl-9 pr-10 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                      touched.confirmPassword && !isConfirmPasswordValid
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-[#cbd6e2] focus:border-[#0091ae]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-[#7c98b6] hover:text-[#33475b]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {touched.confirmPassword && !isConfirmPasswordValid && (
                  <p className="mt-1 text-[11px] text-rose-500">
                    {confirmPassword.length === 0 ? 'Please confirm your password.' : 'Passwords do not match.'}
                  </p>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting || submitSuccess}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account & Joining Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete SDR Registration</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-3 text-xs text-[#516f90]">
                Already have a LeadFlow account with this email?{' '}
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
                  className="font-semibold text-[#0091ae] hover:underline"
                >
                  Sign in here
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

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f8fa] flex items-center justify-center text-[#33475b]">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff7a59]" />
            <span>Loading invitation...</span>
          </div>
        </div>
      }
    >
      <InvitationAcceptContent />
    </Suspense>
  );
}
