'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Compass,
  Building2,
  ChevronDown,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuthContext } from '@/context/AuthProvider';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, switchRole, isAdmin, role } = useAuthContext();
  const { stats /*, tasks */ } = useCRM();

  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const isOwnerOrAdmin = isAdmin || user?.role === 'admin' || role === 'admin';
  // const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue').length;

  const firstTabHref = isOwnerOrAdmin ? ROUTES.DASHBOARD : ROUTES.SDR_DASHBOARD;

  const navLinks = [
    { label: isOwnerOrAdmin ? 'Overview' : 'Dashboard', href: firstTabHref },
    { label: 'Leads', href: ROUTES.LEADS, badge: stats.totalLeads },
    { label: 'Sequences', href: ROUTES.SEQUENCES },
    // Tasks tab temporarily disabled
    // { label: 'Tasks', href: ROUTES.TASKS, badge: pendingTasksCount > 0 ? pendingTasksCount : null },
    ...(isOwnerOrAdmin ? [{ label: 'Team', href: ROUTES.TEAM }] : []),
    {
      label: 'Journey Canvas',
      href: ROUTES.WALKTHROUGH,
      isSpecial: true,
    },
    // { label: 'Settings', href: ROUTES.SETTINGS },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#2d3e50] text-white border-b border-[#1f2a37] shadow-xs select-none">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-4">
          {/* Brand + Main Navigation Links */}
          <div className="flex items-center gap-6 min-w-0">
            {/* Logo */}
            <Link href={firstTabHref} className="flex items-center gap-2.5 shrink-0 group">
              <div className="h-7 w-7 rounded-md bg-[#ff7a59] text-white flex items-center justify-center font-black text-sm shadow-xs group-hover:bg-[#e06646] transition-colors">
                L
              </div>
              <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
                LeadFlow
              </span>
            </Link>

            {/* HubSpot horizontal navigation items */}
            <nav className="flex items-center gap-1 overflow-x-auto text-xs font-semibold py-1 scrollbar-none">
              {navLinks.map((item) => {
                const isFirstItem = item.href === ROUTES.DASHBOARD || item.href === ROUTES.SDR_DASHBOARD;
                const isActive = isFirstItem
                  ? pathname === ROUTES.DASHBOARD ||
                    pathname === ROUTES.SDR_DASHBOARD ||
                    pathname === '/sdr/dashboard' ||
                    pathname === '/workspace/dashboard' ||
                    pathname === '/workspace/onboarding'
                  : pathname.startsWith(item.href);

                if (item.isSpecial) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[#cbd9f4] hover:text-white bg-[#142b55] hover:bg-[#1f3b73] border border-[#3b5998] transition-colors ml-1"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#ff7a59]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#1f2a37] text-white font-bold border-b-2 border-[#ff7a59]'
                        : 'text-[#cbd9f4] hover:text-white hover:bg-[#3d5066]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge !== null && (
                      <span className="rounded-full bg-[#1f2a37] text-[#cbd9f4] px-1.5 py-0.2 text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Controls: Search, Add Lead, Role Switcher, Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 rounded bg-[#1f2a37] hover:bg-[#3d5066] border border-[#3d5066] px-2.5 py-1 text-xs text-[#cbd9f4] transition-colors"
            >
              <Search className="h-3 w-3" />
              <span className="text-[11px]">Search pipeline...</span>
              <kbd className="text-[9px] font-mono bg-[#2d3e50] px-1 rounded text-[#8fa2c0]">
                ⌘K
              </kbd>
            </button>

            {/* Quick Action: Add Lead */}
            <Link href="/leads?action=new">
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs bg-[#ff7a59] hover:bg-[#e06646] text-white font-bold gap-1 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Lead</span>
              </Button>
            </Link>

            {/* Role Switcher Pill (Admin vs SDR) */}
            <div className="hidden lg:flex items-center bg-[#1f2a37] rounded-md p-0.5 border border-[#3d5066] text-[10px]">
              <button
                type="button"
                onClick={() => {
                  switchRole('admin');
                  router.push(ROUTES.DASHBOARD);
                }}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  user?.role === 'admin'
                    ? 'bg-[#ff7a59] text-white shadow-xs'
                    : 'text-[#cbd9f4] hover:text-white'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  switchRole('sdr');
                  router.push(ROUTES.SDR_DASHBOARD);
                }}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  user?.role === 'sdr'
                    ? 'bg-[#0091ae] text-white shadow-xs'
                    : 'text-[#cbd9f4] hover:text-white'
                }`}
              >
                SDR
              </button>
              <button
                type="button"
                onClick={() => {
                  switchRole('ae');
                  router.push(ROUTES.DASHBOARD);
                }}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  user?.role === 'ae'
                    ? 'bg-[#7c3aed] text-white shadow-xs'
                    : 'text-[#cbd9f4] hover:text-white'
                }`}
              >
                AE
              </button>
            </div>

            {/* Profile Menu Trigger */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 p-1 rounded hover:bg-[#3d5066] transition-colors"
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                  user?.role === 'admin' ? 'bg-[#ff7a59]' : (user?.role === 'ae' ? 'bg-[#7c3aed]' : 'bg-[#0091ae]')
                }`}>
                  {user?.displayName ? user.displayName.charAt(0) : 'U'}
                </div>
                <ChevronDown className="h-3 w-3 text-[#cbd9f4]" />
              </button>

              {/* Profile Popover */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-lg border border-[#dfe3eb] bg-white p-1 text-[#33475b] shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 border-b border-[#eaf0f6]">
                    <p className="font-bold text-[#2d3e50] truncate">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] text-[#7c98b6] truncate">{user?.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-[#f5f8fa] text-[#516f90] border border-[#dfe3eb]">
                      Role: {user?.role === 'admin' ? 'Workspace Owner' : (user?.role === 'ae' ? 'Account Executive (AE)' : 'Outbound SDR')}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        switchRole('admin');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] flex items-center justify-between text-xs font-semibold text-[#ff7a59]"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Switch to Admin Mode</span>
                      </span>
                      {user?.role === 'admin' && <span className="text-[10px] font-bold">✓ Active</span>}
                    </button>

                    <button
                      onClick={() => {
                        switchRole('sdr');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] flex items-center justify-between text-xs font-semibold text-[#0091ae]"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Switch to SDR Mode</span>
                      </span>
                      {user?.role === 'sdr' && <span className="text-[10px] font-bold">✓ Active</span>}
                    </button>

                    <button
                      onClick={() => {
                        switchRole('ae');
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] flex items-center justify-between text-xs font-semibold text-[#7c3aed]"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Switch to AE Mode</span>
                      </span>
                      {user?.role === 'ae' && <span className="text-[10px] font-bold">✓ Active</span>}
                    </button>

                    <Link
                      href={ROUTES.WALKTHROUGH}
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f5f8fa] flex items-center gap-2 text-xs text-[#33475b]"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#ff7a59]" />
                      <span>Explore Journey Canvas</span>
                    </Link>

                  </div>

                  <div className="border-t border-[#eaf0f6] pt-1">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                        router.push(ROUTES.LOGIN);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-rose-50 text-rose-600 flex items-center gap-2 text-xs font-semibold"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};
