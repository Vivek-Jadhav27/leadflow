'use client';

import React from 'react';
import { DashboardStats } from '@/types/lead';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Mail, Clock } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';

interface DashboardCardsProps {
  stats: DashboardStats;
  loading?: boolean;
}

export function DashboardCards({ stats, loading = false }: DashboardCardsProps) {
  const cards = [
    {
      title: 'Total Leads',
      value: stats.totalLeads,
      icon: Users,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
    },
    {
      title: 'LinkedIn Sequences',
      value: stats.linkedinSequences,
      icon: Linkedin,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    },
    {
      title: 'Email Sequences',
      value: stats.emailSequences,
      icon: Mail,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    },
    {
      title: "Today's Pending Follow-ups",
      value: stats.todayPendingFollowups,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>
                {loading ? (
                  <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {card.value}
                  </h3>
                )}
              </div>
              <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
