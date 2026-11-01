'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Layers,
  GitBranch,
  CheckSquare,
  Users2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuthContext } from '@/context/AuthProvider';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const pathname = usePathname();
  const { user, isAdmin } = useAuthContext();
  const isOwnerOrAdmin = isAdmin || user?.role === 'admin';

  const isDashboardActive =
    pathname === ROUTES.DASHBOARD ||
    pathname === '/workspace/onboarding' ||
    pathname === '/workspace/dashboard';

  const navItems = [
    {
      label: 'Overview',
      href: ROUTES.DASHBOARD,
      icon: Sparkles,
      isActive: isDashboardActive,
    },
    {
      label: 'Leads',
      href: ROUTES.LEADS,
      icon: Layers,
      isActive: pathname === ROUTES.LEADS || pathname.startsWith('/leads/'),
    },
    {
      label: 'Sequences',
      href: ROUTES.SEQUENCES,
      icon: GitBranch,
      isActive: pathname === ROUTES.SEQUENCES || pathname.startsWith('/sequences/'),
    },
    {
      label: 'Tasks',
      href: ROUTES.TASKS,
      icon: CheckSquare,
      isActive: pathname === ROUTES.TASKS || pathname.startsWith('/tasks/'),
    },
    ...(isOwnerOrAdmin
      ? [
          {
            label: 'Team Members',
            href: ROUTES.WORKSPACE_TEAM,
            icon: Users2,
            isActive: pathname === ROUTES.WORKSPACE_TEAM || pathname === ROUTES.TEAM,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 border-r border-[#dfe3eb] bg-white p-4 flex flex-col justify-between shrink-0 transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Mobile Header with close button */}
          <div className="flex items-center justify-between md:hidden pb-2 border-b border-[#dfe3eb]">
            <span className="font-bold text-sm text-[#2d3e50]">Menu</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-[#516f90] hover:text-[#2d3e50] hover:bg-[#f8fafc]"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c98b6] block mb-2 px-2">
              Workspace Menu
            </span>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      item.isActive
                        ? 'bg-[#fff5f2] text-[#ff7a59]'
                        : 'text-[#516f90] hover:bg-[#f8fafc] hover:text-[#2d3e50]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-1.5">
            <span className="font-semibold text-[#2d3e50] block">
              {isOwnerOrAdmin ? 'Provisioning Status' : 'SDR Workspace'}
            </span>
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Workspace Active</span>
            </div>
            <div className="text-[11px] text-[#7c98b6]">
              {isOwnerOrAdmin ? 'Ready for team invites' : 'Outreach Ready'}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[#7c98b6] px-2 pt-4 border-t border-[#f0f4f8]">
          LeadFlow CRM v1.0
        </div>
      </aside>
    </>
  );
};
