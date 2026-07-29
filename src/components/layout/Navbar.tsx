'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname === ROUTES.DASHBOARD) return 'Dashboard Overview';
    if (pathname === ROUTES.LEADS) return 'Lead Management';
    if (pathname === ROUTES.NEW_LEAD) return 'Create New Lead';
    if (pathname.includes('/edit')) return 'Edit Lead';
    if (pathname.startsWith('/leads/')) return 'Lead Details';
    return 'LeadFlow';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Open sidebar menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {getTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <Link href={ROUTES.NEW_LEAD}>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </Button>
        </Link>
      </div>
    </header>
  );
};
