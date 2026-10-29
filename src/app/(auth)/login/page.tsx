'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  Shield,
  User,
  Lock,
  Mail,
  Check,
} from 'lucide-react';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { JourneyDecisionTree } from '@/components/walkthrough/JourneyDecisionTree';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsAdmin, loginAsSDR } = useAuthContext();

  const [selectedRole, setSelectedRole] = useState<'admin' | 'sdr'>('admin');
  const [email, setEmail] = useState('admin@leadflow.io');
  const [password, setPassword] = useState('admin123');
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectRole = (role: 'admin' | 'sdr') => {
    setSelectedRole(role);
    if (role === 'admin') {
      setEmail('admin@leadflow.io');
      setPassword('admin123');
    } else {
      setEmail('sdr@leadflow.io');
      setPassword('sdr123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Please enter an email address.');
      return;
    }

    if (selectedRole === 'admin' && email === 'admin@leadflow.io') {
      loginAsAdmin();
    } else if (selectedRole === 'sdr' && email === 'sdr@leadflow.io') {
      loginAsSDR();
    } else {
      await login(email.trim(), password.trim());
    }
    router.push(ROUTES.DASHBOARD);
  };

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex flex-col justify-between text-[#33475b]">
      {/* HubSpot Top Header */}
      <header className="h-14 px-6 border-b border-[#dfe3eb] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            L
          </div>
          <span className="font-bold text-base tracking-tight text-[#2d3e50]">
            LeadFlow
          </span>
        </div>

        <Link
          href={ROUTES.WALKTHROUGH}
          className="text-xs font-semibold text-[#0091ae] hover:text-[#007a93] flex items-center gap-1.5 transition-colors"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Explore Decision Canvas</span>
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg border border-[#dfe3eb] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-[#2d3e50]">
              Sign in to LeadFlow
            </h1>
            <p className="text-xs text-[#516f90]">
              Select a role or sign in with your credentials
            </p>
          </div>

          {/* Quick Demo Role Selectors */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => selectRole('admin')}
              className={`p-3 rounded-md border text-left transition-all ${
                selectedRole === 'admin'
                  ? 'border-[#ff7a59] bg-[#fff5f2] ring-1 ring-[#ff7a59]'
                  : 'border-[#dfe3eb] hover:border-[#cbd6e2] bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2d3e50]">Admin</span>
                <span className="text-[10px] font-semibold text-[#ff7a59] bg-white px-1.5 py-0.5 rounded border border-[#ffd5cb]">
                  Owner
                </span>
              </div>
              <p className="text-[11px] text-[#516f90] mt-1 truncate">
                admin@leadflow.io
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectRole('sdr')}
              className={`p-3 rounded-md border text-left transition-all ${
                selectedRole === 'sdr'
                  ? 'border-[#0091ae] bg-[#f0f9fb] ring-1 ring-[#0091ae]'
                  : 'border-[#dfe3eb] hover:border-[#cbd6e2] bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2d3e50]">SDR</span>
                <span className="text-[10px] font-semibold text-[#0091ae] bg-white px-1.5 py-0.5 rounded border border-[#b2e2ec]">
                  Sales Rep
                </span>
              </div>
              <p className="text-[11px] text-[#516f90] mt-1 truncate">
                sdr@leadflow.io
              </p>
            </button>
          </div>

          {errorMsg && (
            <div className="rounded bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#33475b]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c98b6]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-[#cbd6e2] pl-9 pr-3 py-2 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59] focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#33475b]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c98b6]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-[#cbd6e2] pl-9 pr-3 py-2 text-xs bg-white text-[#33475b] focus:outline-none focus:border-[#ff7a59] focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold text-xs h-9 rounded-md shadow-xs mt-2"
            >
              Sign In
            </Button>
          </form>

          {/* Divider & Walkthrough Link */}
          <div className="pt-3 border-t border-[#dfe3eb] space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowWalkthroughModal(true)}
              className="w-full h-8 text-xs font-semibold text-[#2d3e50] border-[#cbd6e2] hover:bg-[#f5f8fa] gap-1.5"
            >
              <Compass className="h-3.5 w-3.5 text-[#0091ae]" />
              <span>Explore Interactive Decision Tree</span>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 px-6 border-t border-[#dfe3eb] bg-white flex items-center justify-between text-[11px] text-[#7c98b6]">
        <span>LeadFlow Outbound CRM</span>
        <Link href={ROUTES.WALKTHROUGH} className="hover:underline">
          Journey Architecture
        </Link>
      </footer>

      {/* Decision Tree Modal */}
      {showWalkthroughModal && (
        <JourneyDecisionTree onClose={() => setShowWalkthroughModal(false)} isModal={true} />
      )}
    </div>
  );
}
