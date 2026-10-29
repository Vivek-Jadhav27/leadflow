'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  GitBranch,
  Clock,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Send,
  Eye,
  Plus,
  Compass,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Award,
  X,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { leads, tasks, activities, stats, advanceLeadStep, updateTaskStatus } = useCRM();
  const [previewMessage, setPreviewMessage] = useState<{ leadName: string; title: string; content: string } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Active leads with pending action today or overdue
  const pendingFollowUpLeads = leads
    .filter(
      (l) =>
        l.disposition === 'active' &&
        l.nextFollowUpDate &&
        (l.outreachStatus === 'followup_due' || l.outreachStatus === 'in_sequence')
    )
    .sort((a, b) => (a.nextFollowUpDate || '').localeCompare(b.nextFollowUpDate || ''));

  // Pending tasks
  const todayTasks = tasks
    .filter((t) => t.status === 'pending' || t.status === 'overdue')
    .slice(0, 6);

  // Recent leads
  const recentLeads = [...leads]
    .filter((l) => l.disposition !== 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const recentActivities = [...activities].slice(0, 6);

  return (
    <div className="space-y-6">
      {/* HubSpot Top Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#dfe3eb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#2d3e50]">
              Sales Hub Dashboard
            </h1>
            <span className="rounded-full bg-[#f2eefd] text-[#7d5bd6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {user?.role === 'admin' ? 'Admin / Owner View' : 'SDR Representative View'}
            </span>
          </div>
          <p className="text-xs text-[#516f90] mt-0.5">
            Operational pipeline tracking for LinkedIn connection gates, manual message cadences, and reply conversions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick link to decision canvas */}
          <Link href={ROUTES.WALKTHROUGH}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1.5 border-[#3b5998] text-[#142b55] hover:bg-[#e8efff]"
            >
              <Compass className="h-3.5 w-3.5 text-[#ff7a59]" />
              <span>Interactive Decision Canvas</span>
            </Button>
          </Link>

          <Link href="/leads?action=new">
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06646] text-white text-xs font-bold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Capture Lead</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 5 HubSpot Operational Metric Cards (Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Metric 1: Leads Captured */}
        <div
          onClick={() => router.push(ROUTES.LEADS)}
          className="group cursor-pointer rounded-lg border border-[#dfe3eb] bg-white p-3.5 shadow-xs hover:border-[#ff7a59] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#516f90]">Leads Captured</span>
            <div className="h-6 w-6 rounded bg-[#f5f8fa] text-[#516f90] flex items-center justify-center group-hover:bg-[#ff7a59] group-hover:text-white transition-colors">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-[#2d3e50] tabular-nums">
              {stats.totalLeads}
            </span>
            <span className="text-[10px] text-[#7c98b6]">in pipeline</span>
          </div>
        </div>

        {/* Metric 2: In Active Sequences */}
        <div
          onClick={() => router.push('/leads?filter=in_sequence')}
          className="group cursor-pointer rounded-lg border border-[#dfe3eb] bg-white p-3.5 shadow-xs hover:border-[#0091ae] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#516f90]">Active Sequences</span>
            <div className="h-6 w-6 rounded bg-[#f5f8fa] text-[#516f90] flex items-center justify-center group-hover:bg-[#0091ae] group-hover:text-white transition-colors">
              <GitBranch className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-[#2d3e50] tabular-nums">
              {stats.inActiveSequences}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">LinkedIn flow</span>
          </div>
        </div>

        {/* Metric 3: Follow-ups Due */}
        <div
          onClick={() => router.push('/tasks?filter=today')}
          className="group cursor-pointer rounded-lg border border-[#dfe3eb] bg-white p-3.5 shadow-xs hover:border-[#f5a623] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#516f90]">Follow-ups Due</span>
            <div className="h-6 w-6 rounded bg-[#fef4e8] text-[#d49a19] flex items-center justify-center">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-[#2d3e50] tabular-nums">
              {stats.followupsDueToday}
            </span>
            <span className="text-[10px] text-[#d49a19] font-bold">due today</span>
          </div>
        </div>

        {/* Metric 4: Replies Received */}
        <div
          onClick={() => router.push('/leads?filter=replied')}
          className="group cursor-pointer rounded-lg border border-[#dfe3eb] bg-white p-3.5 shadow-xs hover:border-[#00a389] transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#516f90]">Replies Received</span>
            <div className="h-6 w-6 rounded bg-[#def3e9] text-[#00a389] flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-[#2d3e50] tabular-nums">
              {stats.repliesReceived}
            </span>
            <span className="text-[10px] text-[#00a389] font-bold">high intent</span>
          </div>
        </div>

        {/* Metric 5: Meetings Booked */}
        <div
          onClick={() => router.push('/leads?filter=meeting_booked')}
          className="group cursor-pointer rounded-lg border border-[#dfe3eb] bg-white p-3.5 shadow-xs hover:border-[#ff7a59] transition-all col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#516f90]">Meetings Booked</span>
            <div className="h-6 w-6 rounded bg-[#fef4e8] text-[#ff7a59] flex items-center justify-center">
              <Award className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight text-[#ff7a59] tabular-nums">
              {stats.meetingsBooked}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">conversion</span>
          </div>
        </div>
      </div>

      {/* Two-Column Operational Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (2 spans): Follow-ups Queue & Recent Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Follow-ups Due Today */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#eaf0f6] bg-[#f5f8fa]">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#d49a19]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2d3e50]">
                  LinkedIn Outreach Tasks Due Today
                </h3>
              </div>
              <span className="text-[11px] text-[#7c98b6] font-medium">
                {pendingFollowUpLeads.length} pending
              </span>
            </div>

            {pendingFollowUpLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7c98b6]">
                <CheckCircle2 className="h-6 w-6 text-[#00a389] mx-auto mb-2" />
                <p className="font-bold text-[#2d3e50]">All caught up!</p>
                <p className="text-[11px] mt-0.5">No overdue or pending LinkedIn outreach actions right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#eaf0f6] text-xs">
                {pendingFollowUpLeads.map((lead) => {
                  const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < todayStr;
                  const isToday = lead.nextFollowUpDate === todayStr;

                  return (
                    <div
                      key={lead.id}
                      className="p-3 sm:px-4 hover:bg-[#f9fbff] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={ROUTES.LEAD_DETAIL(lead.id)}
                            className="font-bold text-[#2d3e50] hover:text-[#ff7a59] hover:underline"
                          >
                            {lead.firstName} {lead.lastName}
                          </Link>
                          <span className="text-slate-300">·</span>
                          <span className="text-[#516f90] font-semibold">{lead.company}</span>
                          <span className="text-[#7c98b6] hidden md:inline">({lead.jobTitle})</span>

                          <span className="inline-flex items-center gap-1 rounded bg-[#e7f7fa] px-1.5 py-0.2 text-[10px] font-bold text-[#0091ae]">
                            <Linkedin className="h-2.5 w-2.5" />
                            LinkedIn
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[#7c98b6]">
                          <span className="font-semibold text-[#2d3e50]">
                            {lead.nextActionTitle || `Step ${lead.currentStepNumber} Action`}
                          </span>
                          <span>·</span>
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-600 font-bold'
                                : isToday
                                ? 'text-[#d49a19] font-bold'
                                : 'text-[#7c98b6]'
                            }
                          >
                            {isOverdue ? `Overdue (${lead.nextFollowUpDate})` : isToday ? 'Due Today' : `Due ${lead.nextFollowUpDate}`}
                          </span>
                          <span>·</span>
                          <span>Rep: {lead.assignedToName}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPreviewMessage({
                              leadName: `${lead.firstName} ${lead.lastName}`,
                              title: lead.nextActionTitle || 'LinkedIn Message',
                              content: lead.notes || 'Hi ' + lead.firstName + ', following up on my previous note.',
                            })
                          }
                          className="h-7 px-2 text-[11px] text-[#516f90]"
                        >
                          <Eye className="h-3 w-3 mr-1 text-[#7c98b6]" />
                          <span>Preview</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => advanceLeadStep(lead.id)}
                          className="h-7 px-2.5 text-[11px] bg-[#0091ae] hover:bg-[#007a8c] text-white font-bold shadow-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          <span>Mark Sent</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Recently Added Leads */}
          {/* <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#eaf0f6]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2d3e50]">
                Recently Captured Prospects
              </h3>
              <Link
                href={ROUTES.LEADS}
                className="text-xs font-bold text-[#ff7a59] hover:underline flex items-center gap-1"
              >
                <span>View all leads</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#33475b]">
                <thead className="bg-[#f5f8fa] text-[10px] uppercase font-bold text-[#516f90] border-b border-[#dfe3eb]">
                  <tr>
                    <th className="px-4 py-2.5">Lead Name</th>
                    <th className="px-4 py-2.5">Company</th>
                    <th className="px-4 py-2.5">Connection Gate</th>
                    <th className="px-4 py-2.5">Outcome</th>
                    <th className="px-4 py-2.5">Owner</th>
                    <th className="px-4 py-2.5 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaf0f6]">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#f9fbff] transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          href={ROUTES.LEAD_DETAIL(lead.id)}
                          className="font-bold text-[#2d3e50] hover:text-[#ff7a59] hover:underline"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                        <p className="text-[10px] text-[#7c98b6]">{lead.jobTitle}</p>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#2d3e50]">
                        {lead.company}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded bg-[#e7f7fa] px-1.5 py-0.2 text-[10px] font-bold text-[#0091ae] capitalize">
                          <Linkedin className="h-2.5 w-2.5" />
                          {lead.connectionStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-[#f5f8fa] border border-[#dfe3eb] text-[#33475b]">
                          {lead.outcome || lead.outreachStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#516f90]">
                        {lead.assignedToName}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={ROUTES.LEAD_DETAIL(lead.id)}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-[#ff7a59] font-bold">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div> */}
        </div>

        {/* Right Column (1 span): Upcoming Tasks & Live Activity Feed */}
        <div className="space-y-6">
          {/* Upcoming Tasks checklist */}
          <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#eaf0f6] bg-[#f5f8fa]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2d3e50]">
                Pending Actions ({todayTasks.length})
              </h3>
              <Link href={ROUTES.TASKS} className="text-xs font-bold text-[#ff7a59] hover:underline">
                All tasks
              </Link>
            </div>

            <div className="divide-y divide-[#eaf0f6] text-xs p-1">
              {todayTasks.length === 0 ? (
                <div className="p-4 text-center text-[#7c98b6] text-xs">No pending tasks</div>
              ) : (
                todayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 flex items-start gap-2.5 hover:bg-[#f9fbff] rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={t.status === 'completed'}
                      onChange={() => updateTaskStatus(t.id, 'completed')}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#ff7a59] focus:ring-[#ff7a59] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#2d3e50] leading-snug">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#7c98b6]">
                        <span>{t.leadName}</span>
                        <span>·</span>
                        <span className={t.status === 'overdue' ? 'text-rose-600 font-bold' : ''}>
                          Due {t.dueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Real-time Activity Stream */}
          {/* <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaf0f6] bg-[#f5f8fa]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2d3e50]">
                Recent Pipeline Activity
              </h3>
            </div>

            <div className="p-3 divide-y divide-[#eaf0f6] text-xs space-y-2.5">
              {recentActivities.map((act) => (
                <div key={act.id} className="pt-2 first:pt-0">
                  <div className="flex items-baseline justify-between text-[11px] mb-0.5">
                    <span className="font-bold text-[#2d3e50] truncate pr-2">
                      {act.title}
                    </span>
                    <span className="text-[10px] text-[#7c98b6] shrink-0">
                      {formatDate(act.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#516f90] leading-tight">
                    {act.description}
                  </p>
                  <p className="text-[10px] text-[#7c98b6] mt-0.5">
                    Actor: <span className="font-semibold text-[#2d3e50]">{act.actorName}</span>
                  </p>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      </div>

      {/* Message Preview Modal */}
      {previewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#142b55]/40">
          <div className="w-full max-w-md rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <div>
                <h4 className="font-bold text-sm text-[#2d3e50]">
                  {previewMessage.title}
                </h4>
                <p className="text-[11px] text-[#7c98b6]">To: {previewMessage.leadName}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMessage(null)}
                className="h-6 w-6 p-0 text-[#7c98b6]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="py-4 whitespace-pre-wrap rounded bg-[#f5f8fa] p-3 text-[#33475b] font-mono text-[11px] my-3 border border-[#dfe3eb]">
              {previewMessage.content}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewMessage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
