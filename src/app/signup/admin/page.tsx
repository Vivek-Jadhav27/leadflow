'use client';

import React, { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { useAuthContext } from '@/context/AuthProvider';
import { PasswordRequirementsList } from '@/components/auth/PasswordRequirementsList';
import {
  validateCompanyName,
  validateCompanyLinkedinUrl,
  checkPasswordRequirements,
  isValidEmail,
} from '@/utils/validation';
import { ROUTES } from '@/constants/routes';

export default function AdminSignupPage() {
  const router = useRouter();
  const { adminSignUp, isAuthenticated, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/workspace/onboarding');
    }
  }, [isAuthenticated, loading, router]);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLinkedinUrl, setCompanyLinkedinUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Form field IDs
  const fullNameId = useId();
  const companyNameId = useId();
  const linkedinId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  // Field validations
  const companyNameValidation = validateCompanyName(companyName);
  const linkedinValidation = validateCompanyLinkedinUrl(companyLinkedinUrl);
  const passwordValidation = checkPasswordRequirements(password);
  const isEmailValid = isValidEmail(email);
  const isConfirmPasswordValid = confirmPassword.length > 0 && confirmPassword === password;

  const isFormValid =
    companyNameValidation.isValid &&
    linkedinValidation.isValid &&
    isEmailValid &&
    passwordValidation.isValid &&
    isConfirmPasswordValid;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const normalizedLinkedin = linkedinValidation.normalizedUrl || companyLinkedinUrl.trim();
      await adminSignUp({
        fullName: fullName.trim() || undefined,
        companyName: companyName.trim(),
        companyLinkedinUrl: normalizedLinkedin,
        email: email.trim(),
        password,
        confirmPassword,
      });

      router.replace('/workspace/onboarding');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to create workspace. Please try again.';
      setServerError(msg);
      setIsSubmitting(false);
    }
  };

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

        <div className="text-xs text-[#516f90]">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#0091ae] hover:underline">
            Log in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-xl bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs">
          <div className="text-center mb-6 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5f5f8] text-[#0091ae] mb-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin Workspace Setup</span>
            </div>
            <h1 className="text-2xl font-bold text-[#2d3e50] tracking-tight">Create your company workspace</h1>
            <p className="text-xs text-[#516f90] max-w-md mx-auto">
              Set up your workspace, invite your SDR team, and launch automated outreach sequences.
            </p>
          </div>

          {serverError && (
            <div className="mb-5 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 0. Full Name */}
            <div>
              <label htmlFor={fullNameId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Your Full Name
              </label>
              <div className="relative">
                <input
                  id={fullNameId}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Abhay Singh Rathod"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#cbd6e2] bg-white focus:outline-none focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae] transition-colors"
                />
              </div>
            </div>

            {/* 1. Company Name */}
            <div>
              <label htmlFor={companyNameId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                <input
                  id={companyNameId}
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onBlur={() => handleBlur('companyName')}
                  placeholder="e.g. Acme Corporation"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                    touched.companyName && !companyNameValidation.isValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#cbd6e2] focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]'
                  }`}
                />
              </div>
              {touched.companyName && !companyNameValidation.isValid && (
                <p className="mt-1 text-[11px] text-rose-500">{companyNameValidation.error}</p>
              )}
            </div>

            {/* 2. Company LinkedIn URL */}
            <div>
              <label htmlFor={linkedinId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Company LinkedIn URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                <input
                  id={linkedinId}
                  type="url"
                  value={companyLinkedinUrl}
                  onChange={(e) => setCompanyLinkedinUrl(e.target.value)}
                  onBlur={() => handleBlur('linkedin')}
                  placeholder="https://www.linkedin.com/company/acme/"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                    touched.linkedin && !linkedinValidation.isValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#cbd6e2] focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]'
                  }`}
                />
              </div>
              {touched.linkedin && !linkedinValidation.isValid ? (
                <p className="mt-1 text-[11px] text-rose-500">{linkedinValidation.error}</p>
              ) : (
                <p className="mt-1 text-[11px] text-[#7c98b6]">Must be a valid company page URL on linkedin.com</p>
              )}
            </div>

            {/* 3. Admin Email */}
            <div>
              <label htmlFor={emailId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Admin Work Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="admin@company.com"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                    touched.email && !isEmailValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#cbd6e2] focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]'
                  }`}
                />
              </div>
              {touched.email && !isEmailValid && (
                <p className="mt-1 text-[11px] text-rose-500">Please enter a valid email address.</p>
              )}
            </div>

            {/* 4. Password */}
            <div>
              <label htmlFor={passwordId} className="block text-xs font-semibold text-[#33475b] mb-1.5">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#7c98b6]" />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-10 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                    touched.password && !passwordValidation.isValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#cbd6e2] focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]'
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

              {/* Real-time checklist */}
              <PasswordRequirementsList password={password} showAlways={touched.password || password.length > 0} />
            </div>

            {/* 5. Confirm Password */}
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
                  onBlur={() => handleBlur('confirmPassword')}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-10 py-2 text-xs rounded-md border bg-white focus:outline-none transition-colors ${
                    touched.confirmPassword && !isConfirmPasswordValid
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#cbd6e2] focus:border-[#0091ae] focus:ring-1 focus:ring-[#0091ae]'
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

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-semibold text-xs text-white bg-[#ff7a59] hover:bg-[#e66343] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Provisioning Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-[#edf1f5] text-center text-[11px] text-[#7c98b6]">
            By continuing, you agree to LeadFlow&apos;s Terms of Service and Privacy Policy.
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#7c98b6]">
        &copy; {new Date().getFullYear()} LeadFlow Inc. All rights reserved.
      </footer>
    </div>
  );
}
