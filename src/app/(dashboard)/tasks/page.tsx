'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  ArrowRight,
  UserCheck,
  Building2,
  Trash2,
  Edit2,
  Send,
  SkipForward,
  PauseCircle,
  ExternalLink,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

import { useCRM } from '@/hooks/useCRM';
import { useAuthContext } from '@/context/AuthProvider';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Task } from '@/types/crm';
import { formatDate, getTodayString } from '@/utils/date';
import { toast } from 'sonner';

export default function TasksPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'today';
  const { user, isAdmin } = useAuthContext();
  const router = useRouter();

  // Not available to SDR / AE: send them to their own dashboard.
  useEffect(() => {
    if (!isAdmin) router.replace(ROUTES.SDR_DASHBOARD);
  }, [isAdmin, router]);

  const {
    tasks,
    leads,
    team,
    createTask,
    updateTaskStatus,
    rescheduleTask,
    deleteTask,
    today,
  } = useCRM();

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [isCreating, setIsCreating] = useState(false);
  const [reschedulingTask, setReschedulingTask] = useState<Task | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  // New task form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskLeadId, setTaskLeadId] = useState(leads[0]?.id || '');
  const [taskType, setTaskType] = useState<Task['type']>('linkedin_message');
  const [taskDueDate, setTaskDueDate] = useState(getTodayString());
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');

  const todayStr = today;

  const filteredTasks = tasks.filter((t) => {
    // Role-based Access Control: SDR can see ONLY their assigned tasks
    if (!isAdmin) {
      const userEmailNorm = (user?.email || '').toLowerCase().trim();
      const isAssigned =
        (user?.uid && t.assignedToId === user.uid) ||
        leads.some(
          (l) =>
            l.id === t.leadId &&
            ((user?.uid && l.assignedToId === user.uid) ||
              (userEmailNorm && l.assignedToEmail && l.assignedToEmail.toLowerCase().trim() === userEmailNorm))
        );
      if (!isAssigned) return false;
    }

    if (activeFilter === 'today') {
      return (t.status === 'pending' || t.status === 'overdue') && t.dueDate === todayStr;
    }
    if (activeFilter === 'overdue') {
      return (t.status === 'overdue' || (t.status === 'pending' && t.dueDate < todayStr));
    }
    if (activeFilter === 'upcoming') {
      return t.status === 'pending' && t.dueDate > todayStr;
    }
    if (activeFilter === 'completed') {
      return t.status === 'completed';
    }
    if (activeFilter === 'skipped') {
      return t.status === 'skipped';
    }
    return true; // 'all'
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskLeadId) return;

    // The server validates the lead, derives its name/company, and only lets admins assign to others.
    const created = await createTask({
      title: taskTitle.trim(),
      leadId: taskLeadId,
      type: taskType,
      dueDate: taskDueDate,
      priority: taskPriority,
      ...(isAdmin && taskAssignedTo ? { assignedToId: taskAssignedTo } : {}),
    });
    if (!created) return;

    setIsCreating(false);
    setTaskTitle('');
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingTask || !newDueDate) return;
    const ok = await rescheduleTask(reschedulingTask.id, newDueDate);
    if (!ok) return;
    setReschedulingTask(null);
    setNewDueDate('');
  };

  // Marking the live step task done also advances the lead's sequence, atomically on the server.
  const handleMarkSent = (task: Task) => {
    void updateTaskStatus(task.id, 'completed');
  };

  const handleSkipTask = (task: Task) => {
    void updateTaskStatus(task.id, 'skipped');
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe3eb]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#33475b]">
            Tasks &amp; Outreach Execution Queue
          </h2>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          className="h-8 gap-1.5 bg-[#ff7a59] hover:bg-[#e06545] text-white text-xs font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Task</span>
        </Button>
      </div>



      {/* Tabs Filter */}
      <div className="flex border-b border-[#dfe3eb] text-xs">
        {[
          { key: 'today', label: 'Due Today' },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'overdue', label: 'Overdue' },
          { key: 'completed', label: 'Completed' },
          { key: 'skipped', label: 'Skipped' },
          { key: 'all', label: 'All Tasks' },
        ].map((tab) => {
          const count = tasks.filter((t) => {
            if (tab.key === 'today') return t.status !== 'completed' && t.status !== 'skipped' && t.dueDate === todayStr;
            if (tab.key === 'overdue') return t.status === 'overdue' || (t.status === 'pending' && t.dueDate < todayStr);
            if (tab.key === 'upcoming') return t.status === 'pending' && t.dueDate > todayStr;
            if (tab.key === 'completed') return t.status === 'completed';
            if (tab.key === 'skipped') return t.status === 'skipped';
            return true;
          }).length;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeFilter === tab.key
                  ? 'border-[#ff7a59] text-[#ff7a59]'
                  : 'border-transparent text-slate-500 hover:text-[#33475b]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded bg-[#f5f8fa] text-slate-600 px-1.5 py-0.2 text-[10px] tabular-nums border border-[#dfe3eb]">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tasks Table */}
      <div className="rounded-lg border border-[#dfe3eb] bg-white shadow-xs overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#f5f8fa] text-[10px] uppercase font-semibold text-slate-500 border-b border-[#dfe3eb]">
              <tr>
                <th className="w-8 px-3 py-3 text-center">Done</th>
                <th className="px-4 py-3">Task Title &amp; Details</th>
                <th className="px-4 py-3">Related Lead</th>
                <th className="px-3 py-3">Channel / Type</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-4 py-3">Assigned SDR</th>
                <th className="px-4 py-3 text-right">Sequence Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#dfe3eb]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-bold text-[#33475b]">No tasks in this view</p>
                    <p className="text-[11px] mt-0.5">All scheduled outreach items are up to date.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  const isSkipped = task.status === 'skipped';
                  const isOverdue = !isCompleted && !isSkipped && (task.status === 'overdue' || task.dueDate < todayStr);

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-[#f5f8fa]/80 transition-colors ${
                        isCompleted || isSkipped ? 'opacity-65 bg-[#f5f8fa]/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() =>
                            updateTaskStatus(task.id, isCompleted ? 'pending' : 'completed')
                          }
                          className="h-3.5 w-3.5 rounded border-[#cbd6e2] text-[#ff7a59] focus:ring-[#ff7a59] cursor-pointer"
                        />
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold text-[#33475b] ${
                            isCompleted ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {isSkipped && (
                          <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Skipped
                          </span>
                        )}
                      </td>

                      {/* Related Lead */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={ROUTES.LEAD_DETAIL(task.leadId)}
                            className="font-bold text-[#0091ae] hover:underline"
                          >
                            {task.leadName}
                          </Link>
                          <span className="text-[10px] text-slate-400">{task.leadCompany}</span>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#33475b] font-medium">
                          <Linkedin className="h-3 w-3 text-[#0077b5]" />
                          <span>{task.type.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={
                            isOverdue
                              ? 'text-rose-600 font-bold'
                              : task.dueDate === todayStr
                              ? 'text-[#ff7a59] font-bold'
                              : 'text-slate-600'
                          }
                        >
                          {isOverdue ? `Overdue (${task.dueDate})` : task.dueDate === todayStr ? 'Today' : task.dueDate}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                            task.priority === 'high'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : task.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* Assigned Owner */}
                      <td className="px-4 py-3 whitespace-nowrap text-[#33475b] font-medium">
                        {task.assignedToName}
                      </td>

                      {/* Row actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Mark Sent action per canvas */}
                          {!isCompleted && !isSkipped && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkSent(task)}
                              className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                              title="Mark message as sent manually"
                            >
                              <Send className="h-2.5 w-2.5" />
                              <span>Mark Sent</span>
                            </Button>
                          )}

                          {/* Skip task action per canvas */}
                          {!isCompleted && !isSkipped && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSkipTask(task)}
                              className="h-6 text-[10px] px-1.5 text-slate-600 border-[#cbd6e2] hover:bg-[#f5f8fa]"
                              title="Skip this task and record in history"
                            >
                              <SkipForward className="h-2.5 w-2.5 mr-0.5" />
                              <span>Skip</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReschedulingTask(task);
                              setNewDueDate(task.dueDate);
                            }}
                            className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-[#33475b]"
                            title="Reschedule task"
                          >
                            Reschedule
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTask(task.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                            title="Delete task"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Modal */}
      {reschedulingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b]">
                Reschedule Follow-up
              </h4>
              <p className="text-slate-500 text-[11px] mt-0.5 truncate">
                {reschedulingTask.title}
              </p>
            </div>

            <form onSubmit={handleReschedule} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">New Due Date</label>
                <input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                    setNewDueDate(tom);
                  }}
                  className="flex-1 text-[11px] border-[#cbd6e2] text-slate-600 hover:bg-[#f5f8fa]"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nextWk = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
                    setNewDueDate(nextWk);
                  }}
                  className="flex-1 text-[11px] border-[#cbd6e2] text-slate-600 hover:bg-[#f5f8fa]"
                >
                  Next Week
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setReschedulingTask(null)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Update Due Date
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d3e50]/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-[#dfe3eb] bg-white p-5 shadow-2xl text-xs space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#33475b]">
                Create Outreach Task
              </h4>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Send personalized LinkedIn note to Elena"
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none focus:ring-1 focus:ring-[#ff7a59]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#33475b]">Related Lead</label>
                <select
                  value={taskLeadId}
                  onChange={(e) => setTaskLeadId(e.target.value)}
                  className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName} ({l.company})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as any)}
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  >
                    <option value="linkedin_message">Send LinkedIn Message</option>
                    <option value="linkedin_connect">Send LinkedIn Connection</option>
                    <option value="followup">Follow-up Check</option>
                    <option value="enrich">Enrich Profile</option>
                    <option value="manual_review">Manual Review</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#33475b]">Assigned Representative</label>
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full rounded border border-[#cbd6e2] px-3 py-1.5 text-xs text-[#33475b] focus:outline-none"
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#dfe3eb]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreating(false)} className="border-[#cbd6e2] text-[#33475b]">
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-[#ff7a59] hover:bg-[#e06545] text-white font-semibold">
                  Create Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
