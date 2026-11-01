'use client';

import React, { useState, useEffect, Suspense, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList';
import { checkPasswordRequirements } from '@/utils/validation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [emailForCode, setEmailForCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(true);
  const [codeError, setCodeError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form field IDs
  const passwordId = useId();
  const confirmPasswordId = useId();

  // Validate action code on load
  useEffect(() => {
    async function verifyCode() {
      if (!oobCode) {
        setCodeError('No password reset code found in this URL. The link may be incomplete.');
        setIsValidatingCode(false);
        return;
      }

      try {
        const verifiedEmail = await authService.verifyPasswordResetCode(oobCode);
        setEmailForCode(verifiedEmail);
      } catch (err: unknown) {
        setCodeError((err as Error).message || 'This password reset link is invalid or has expired.');
      } finally {
        setIsValidatingCode(false);
      }
    }

    verifyCode();
  }, [oobCode]);

  const passwordReqs = checkPasswordRequirements(password);
  const isConfirmPasswordValid = confirmPassword.length > 0 && confirmPassword === password;
  const isFormValid = passwordReqs.isValid && isConfirmPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || !isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await authService.confirmPasswordReset(oobCode, password);
      setSubmitSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      setSubmitError((err as Error).message || 'Failed to update password.');
      setIsSubmitting(false);
    }
  };

  if (isValidatingCode) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-8 text-center text-xs text-[#7c98b6]">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#ff7a59]" />
          <span>Verifying security reset code...</span>
        </div>
      </div>
    );
  }

  if (codeError) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#2d3e50]">Reset Link Invalid or Expired</h1>
        <p className="text-xs text-[#516f90] leading-relaxed">{codeError}</p>
        <div className="pt-2">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center py-2 px-4 rounded-md text-xs font-semibold text-white bg-[#ff7a59] hover:bg-[#e66343]"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs space-y-5">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5f5f8] text-[#0091ae] mb-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Security Verification</span>
        </div>
        <h1 className="text-xl font-bold text-[#2d3e50]">Set New Password</h1>
        <p className="text-xs text-[#516f90]">
          Enter your new password for <strong className="font-semibold">{emailForCode}</strong>
        </p>
      </div>

      {submitError && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {submitSuccess ? (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold block">Password changed successfully!</span>
            <span>Redirecting to login page...</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label htmlFor={passwordId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
              New Password <span className="text-rose-500">*</span>
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
                disabled={isSubmitting}
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordRequirementsList password={password} showAlways={touched.password || password.length > 0} />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor={confirmPasswordId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
              Confirm New Password <span className="text-rose-500">*</span>
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
                disabled={isSubmitting}
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
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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
        <Suspense
          fallback={
            <div className="w-full max-w-md mx-auto bg-white rounded-lg border border-[#dfe3eb] p-8 text-center text-xs text-[#7c98b6]">
              Loading reset interface...
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </main>

      <footer className="py-4 text-center text-xs text-[#7c98b6]">
        &copy; {new Date().getFullYear()} LeadFlow Inc.
      </footer>
    </div>
  );
}

