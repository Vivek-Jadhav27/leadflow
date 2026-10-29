'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, LogIn } from 'lucide-react';
import { JourneyDecisionTree } from '@/components/walkthrough/JourneyDecisionTree';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';

export default function WalkthroughPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-[#142b55]">
      {/* Top Escape bar */}
      <div className="h-10 px-4 bg-[#0d1e3d] text-white flex items-center justify-between text-xs z-30 border-b border-[#243a63]">
        <div className="flex items-center gap-2">
          <Link
            href={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN}
            className="flex items-center gap-1.5 text-[#cbd9f4] hover:text-white font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{isAuthenticated ? 'Return to CRM Dashboard' : 'Back to Login Screen'}</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#8fa2c0] hidden sm:inline">
            Interactive Walkthrough Edition · Complete LeadFlow State Engine
          </span>
          <Link href={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN}>
            <Button size="sm" className="h-6 px-2.5 text-[11px] bg-[#ff7a59] hover:bg-[#ff8f73] text-white font-bold">
              {isAuthenticated ? 'Open Dashboard' : 'Sign In as Admin / SDR'}
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <JourneyDecisionTree />
      </div>
    </div>
  );
}
