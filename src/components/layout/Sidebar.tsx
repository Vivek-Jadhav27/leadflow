'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  CheckSquare,
  Users2,
  Settings,
  Compass,
  Plus,
  Search,
  RotateCcw,
  LogOut,
  ChevronDown,
  UserCheck,
  X,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuthContext } from '@/context/AuthProvider';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { GlobalSearchModal } from '@/components/common/GlobalSearchModal';
import { JourneyDecisionTree } from '@/components/walkthrough/JourneyDecisionTree';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, switchRole } = useAuthContext();
  const { stats, tasks, resetToDefaults } = useCRM();

  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'overdue').length;

  const navItems = [
    {
      label: 'Dashboard',
      href: ROUTES.DASHBOARD,
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Leads',
      href: ROUTES.LEADS,
      icon: Users,
      badge: stats.totalLeads > 0 ? stats.totalLeads : null,
    },
    {
      label: 'Sequences',
      href: ROUTES.SEQUENCES,
      icon: GitBranch,
      badge: null,
    },
    {
      label: 'Tasks',
      href: ROUTES.TASKS,
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: 'bg-[#ff7a59] text-white',
    },
    {
      label: 'Team',
      href: ROUTES.TEAM,
      icon: Users2,
      badge: null,
    },
    // {
    //   label: 'Settings',
    //   href: ROUTES.SETTINGS,
    //   icon: Settings,
    //   badge: null,
    // },
  ];

  const handleRoleToggle = (newRole: 'admin' | 'sdr') => {
    switchRole(newRole);
  };

  const handleResetData = () => {
    if (confirm('Reset all demo data back to default sample state?')) {
      resetToDefaults();
      setProfileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Main Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#2d3e50] text-[#cbd9f4] flex flex-col border-r border-[#3d5066] transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header / Brand */}
        <div className="p-4 border-b border-[#3d5066] flex items-center justify-between">
          <Link
            href={ROUTES.DASHBOARD}
            onClick={onClose}
            className="flex items-center gap-2.5 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff7a59] text-white font-black text-sm shadow-sm group-hover:bg-[#e06545] transition-colors">
              L
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tracking-tight leading-tight">
                  LeadFlow
                </span>
                <span className="text-[9px] font-bold bg-[#1f2a37] text-[#ff7a59] px-1.5 py-0.2 rounded border border-[#ff7a59]/30">
                  CRM
                </span>
              </div>
              <p className="text-[10px] text-[#8fa2c0] font-medium leading-none mt-0.5">
                Outbound B2B Pipeline
              </p>
            </div>
          </Link>

          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded text-[#cbd9f4] hover:text-white hover:bg-[#3d5066]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Actions (Search + Add Lead) */}
        <div className="p-3 border-b border-[#3d5066] space-y-2">
          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between rounded-md bg-[#1f2a37] hover:bg-[#38495d] border border-[#3d5066] px-2.5 py-1.5 text-xs text-[#cbd9f4] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#8fa2c0]" />
              <span className="text-[11px]">Search pipeline...</span>
            </div>
            <kbd className="text-[9px] font-mono bg-[#2d3e50] px-1 py-0.5 rounded text-[#8fa2c0] border border-[#3d5066]">
              ⌘K
            </kbd>
          </button>

          {/* Quick Add Lead */}
          <Link href="/leads?action=new" onClick={onClose} className="block">
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-[#ff7a59] hover:bg-[#e06545] text-white font-bold gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Capture New Lead</span>
            </Button>
          </Link>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Section: Main Pages */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8fa2c0]">
              Workspace
            </div>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === ROUTES.DASHBOARD
                    ? pathname === ROUTES.DASHBOARD
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#1f2a37] text-white border-l-2 border-[#ff7a59]'
                        : 'text-[#cbd9f4] hover:text-white hover:bg-[#38495d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-[#ff7a59]' : 'text-[#8fa2c0]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== null && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                          item.badgeColor || 'bg-[#1f2a37] text-[#cbd9f4] border border-[#3d5066]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Section: Interactive Walkthrough Canvas */}
          <div>
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8fa2c0]">
              Interactive Architecture
            </div>
            <Link
              href={ROUTES.WALKTHROUGH}
              onClick={onClose}
              className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold transition-all border ${
                pathname === ROUTES.WALKTHROUGH
                  ? 'bg-[#1b345b] text-white border-[#ff7a59]'
                  : 'bg-[#1b3258]/80 text-[#dce7ff] border-[#34517f] hover:bg-[#1f3b68] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Compass className="h-4 w-4 text-[#ff7a59] shrink-0" />
                <span className="truncate">Journey Canvas</span>
              </div>
              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-[#ff7a59] text-white">
                Live
              </span>
            </Link>
          </div>

          {/* Active Role Switcher Pill */}
          <div className="pt-2">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8fa2c0] flex items-center justify-between">
              <span>Persona Mode</span>
              <span className="text-[9px] text-[#ff7a59] font-bold uppercase">
                {user?.role === 'admin' ? 'Owner' : 'SDR'}
              </span>
            </div>
            <div className="bg-[#1f2a37] p-1 rounded-lg border border-[#3d5066] grid grid-cols-2 gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleRoleToggle('admin')}
                className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer ${
                  user?.role === 'admin'
                    ? 'bg-[#ff7a59] text-white shadow-xs'
                    : 'text-[#8fa2c0] hover:text-white hover:bg-[#2d3e50]'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('sdr')}
                className={`py-1.5 px-2 rounded-md font-bold text-center transition-all cursor-pointer ${
                  user?.role === 'sdr'
                    ? 'bg-[#0091ae] text-white shadow-xs'
                    : 'text-[#8fa2c0] hover:text-white hover:bg-[#2d3e50]'
                }`}
              >
                SDR
              </button>
            </div>
          </div>
        </div>

        {/* User Footer Profile & Session Menu */}
        <div className="p-3 border-t border-[#3d5066] relative bg-[#243343]">
          <div
            onClick={() => setProfileMenuOpen((v) => !v)}
            className="flex items-center justify-between p-2 rounded-md hover:bg-[#2d3e50] cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                  user?.role === 'admin' ? 'bg-[#ff7a59]' : 'bg-[#0091ae]'
                }`}
              >
                {user?.displayName ? user.displayName.charAt(0) : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.displayName || 'Alex Rivera'}
                </p>
                <p className="text-[10px] text-[#8fa2c0] truncate mt-0.5">
                  {user?.role === 'admin' ? 'Workspace Admin' : 'Outbound SDR'}
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-[#8fa2c0] transition-transform ${
                profileMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Profile Menu Popover */}
          {profileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-[#3d5066] bg-[#1f2a37] p-1.5 shadow-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-[#38495d]">
                <p className="font-bold text-white truncate">{user?.displayName || 'Alex Rivera'}</p>
                <p className="text-[10px] text-[#8fa2c0] truncate">{user?.email}</p>
              </div>

              <div className="py-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    handleRoleToggle(user?.role === 'admin' ? 'sdr' : 'admin');
                    setProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2d3e50] flex items-center gap-2 text-xs font-semibold text-[#0091ae]"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Switch to {user?.role === 'admin' ? 'SDR Mode' : 'Admin Mode'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowWalkthroughModal(true);
                    setProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2d3e50] flex items-center gap-2 text-xs font-semibold text-[#cbd9f4]"
                >
                  <Compass className="h-3.5 w-3.5 text-[#ff7a59]" />
                  <span>Open Decision Tree Modal</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetData}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-[#2d3e50] flex items-center gap-2 text-xs text-[#8fa2c0] hover:text-[#cbd9f4]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Sample CRM Data</span>
                </button>

                <div className="my-1 border-t border-[#38495d]" />

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push(ROUTES.LOGIN);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 flex items-center gap-2 text-xs font-semibold"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Decision Tree Modal */}
      {showWalkthroughModal && (
        <JourneyDecisionTree onClose={() => setShowWalkthroughModal(false)} isModal={true} />
      )}
    </>
  );
};
