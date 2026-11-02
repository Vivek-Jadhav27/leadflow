'use client';

import React, { useState } from 'react';
import {
  Settings,
  Building2,
  User,
  Sliders,
  Shield,
  RotateCcw,
  Download,
  Save,
  Check,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { Button } from '@/components/ui/button';
import { WorkspaceSettings } from '@/types/crm';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { settings, updateSettings, resetToDefaults, syncToFirestore, leads, sequences } = useCRM();
  const { user, role } = useAuthContext();
  const [isSyncing, setIsSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<'workspace' | 'outreach' | 'limits' | 'storage'>('workspace');

  // Local form state
  const [name, setName] = useState(settings.name);
  const [domain, setDomain] = useState(settings.domain);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [currency, setCurrency] = useState(settings.currency);
  const [assignmentRule, setAssignmentRule] = useState(settings.defaultAssignmentRule);
  const [defaultFollowupDays, setDefaultFollowupDays] = useState(settings.defaultFollowupDays);
  const [workStart, setWorkStart] = useState(settings.workHoursStart);
  const [workEnd, setWorkEnd] = useState(settings.workHoursEnd);
  const [skipWeekends, setSkipWeekends] = useState(settings.skipWeekends);
  const [stopOnReply, setStopOnReply] = useState(settings.stopSequenceOnReply);
  const [liConnectLimit, setLiConnectLimit] = useState(settings.dailyLinkedInConnectLimit);
  const [liMsgLimit, setLiMsgLimit] = useState(settings.dailyLinkedInMessageLimit);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      name,
      domain,
      timezone,
      currency,
      defaultAssignmentRule: assignmentRule,
      defaultFollowupDays,
      workHoursStart: workStart,
      workHoursEnd: workEnd,
      skipWeekends,
      stopSequenceOnReply: stopOnReply,
      dailyLinkedInConnectLimit: liConnectLimit,
      dailyLinkedInMessageLimit: liMsgLimit,
    });
    toast.success('Workspace settings saved');
  };

  const handleExportJSON = () => {
    const data = localStorage.getItem('leadflow_prototype_db_v3') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leadflow_crm_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Backup exported as JSON');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#33475b]">
            Workspace Settings &amp; LinkedIn Quotas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational preferences, LinkedIn safe sending limits, and prototype persistence controls.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleSaveAll}
          className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-semibold shadow-xs"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save Preferences</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#dfe3eb] text-xs">
        {[
          { key: 'workspace', label: 'Workspace & Profile', icon: Building2 },
          { key: 'outreach', label: 'Cadence & Schedule', icon: Sliders },
          { key: 'limits', label: 'LinkedIn Quotas', icon: Shield },
          { key: 'storage', label: 'Data Management', icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#ff7a59] text-[#ff7a59]'
                  : 'border-transparent text-slate-500 hover:text-[#33475b]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <form onSubmit={handleSaveAll} className="space-y-6 text-xs">
        {/* TAB 1: Workspace & Profile */}
        {activeTab === 'workspace' && (
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#33475b] pb-2 border-b border-[#dfe3eb]">
              Workspace Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Workspace Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Company Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Default Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  <option value="America/New_York (UTC-5)">America/New_York (UTC-5)</option>
                  <option value="America/Los_Angeles (UTC-8)">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London (UTC+0)">Europe/London (UTC+0)</option>
                  <option value="Asia/Tokyo (UTC+9)">Asia/Tokyo (UTC+9)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  <option value="USD ($)">USD ($)</option>
                  <option value="EUR (€)">EUR (€)</option>
                  <option value="GBP (£)">GBP (£)</option>
                </select>
              </div>
            </div>

            <h3 className="font-bold text-sm text-[#33475b] pt-4 pb-2 border-b border-[#dfe3eb]">
              Active User Account
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Signed In As</span>
                <p className="font-bold text-[#33475b] mt-0.5">
                  {user?.displayName || 'Sarah Chen'}
                </p>
                <p className="text-[11px] text-slate-500">{user?.email || 'admin@leadflow.io'}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Current Active Role</span>
                <p className={`font-bold uppercase mt-0.5 ${
                  role === 'admin' ? 'text-[#ff7a59]' : (role === 'ae' ? 'text-[#7c3aed]' : 'text-[#0091ae]')
                }`}>
                  {role} ({role === 'admin' ? 'Lane 1: Workspace Owner' : (role === 'ae' ? 'Lane 3: Account Executive (AE)' : 'Lane 2: Team Member SDR')})
                </p>
                <p className="text-[11px] text-slate-500">Switch role anytime using the top nav pill</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Cadence & Schedule */}
        {activeTab === 'outreach' && (
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#33475b] pb-2 border-b border-[#dfe3eb]">
              LinkedIn Cadence Timing &amp; Lead Assignment
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Default Delay Between Steps
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={defaultFollowupDays}
                    onChange={(e) => setDefaultFollowupDays(parseInt(e.target.value) || 3)}
                    className="w-20 rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-center text-[#33475b]"
                  />
                  <span className="text-slate-500">business days</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Lead Assignment Strategy
                </label>
                <select
                  value={assignmentRule}
                  onChange={(e) => setAssignmentRule(e.target.value as any)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  <option value="round_robin">Round-Robin (Balanced across available SDRs)</option>
                  <option value="manual">Manual Assignment Only</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#dfe3eb]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={(e) => setSkipWeekends(e.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd6e2] text-[#ff7a59] focus:ring-[#ff7a59]"
                />
                <span className="font-semibold text-[#33475b]">
                  Auto-skip weekends on follow-up delays
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stopOnReply}
                  onChange={(e) => setStopOnReply(e.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd6e2] text-[#ff7a59] focus:ring-[#ff7a59]"
                />
                <span className="font-semibold text-[#33475b]">
                  Halt remaining sequence follow-ups immediately upon prospect reply (Decision tree rule)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* TAB 3: Sending Quotas */}
        {activeTab === 'limits' && (
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#33475b] pb-2 border-b border-[#dfe3eb]">
              Daily LinkedIn Safety Quotas
            </h3>
            <p className="text-slate-500 text-[11px]">
              Protects SDR LinkedIn profiles from rate limits and prevents account restrictions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Daily LinkedIn Connect Limit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={liConnectLimit}
                    onChange={(e) => setLiConnectLimit(parseInt(e.target.value) || 25)}
                    className="w-24 rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-center text-[#33475b]"
                  />
                  <span className="text-slate-500">invitations / day</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">
                  Daily LinkedIn Message Limit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={liMsgLimit}
                    onChange={(e) => setLiMsgLimit(parseInt(e.target.value) || 50)}
                    className="w-24 rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-center text-[#33475b]"
                  />
                  <span className="text-slate-500">messages / day</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Data Management & Reset */}
        {activeTab === 'storage' && (
          <div className="rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[#33475b] pb-2 border-b border-[#dfe3eb]">
              Cloud Database &amp; Local Persistence Controls
            </h3>

            {/* Cloud Firestore Sync Card */}
            <div className="rounded-md border border-[#dfe3eb] bg-[#f5f8fa] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#33475b] flex items-center gap-1.5">
                    <CloudUpload className="h-4 w-4 text-[#ff7a59]" />
                    Firebase Firestore Sync
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sync your leads ({leads.length}) and sequences ({sequences.length}) directly into your Firebase Firestore cloud database.
                  </p>
                </div>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  Cloud Live
                </span>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await syncToFirestore();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="h-8 gap-1.5 bg-white text-[#ff7a59] border-[#ff7a59]/30 hover:bg-[#fff6f4] font-medium"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing to Firestore...' : 'Push All to Firestore Now'}</span>
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-[#dfe3eb] bg-[#f5f8fa] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#33475b]">
                    Local Storage Database
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    LeadFlow prototype persists all leads, tasks, and state machine changes locally in your browser.
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                  Browser Cache
                </span>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  className="h-8 gap-1.5 bg-white text-[#33475b] border-[#cbd6e2] hover:bg-[#f5f8fa]"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  <span>Export Database JSON</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Restore initial realistic seed data? Any new leads created will be reset.')) {
                      resetToDefaults();
                    }
                  }}
                  className="h-8 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset to Seed Data</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="flex justify-end pt-3 border-t border-[#dfe3eb]">
          <Button type="submit" size="sm" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold text-xs shadow-xs px-4">
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
}
