'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Phone, Building2, Eye, Edit2 } from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { Lead } from '@/types/lead';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date';
import { ROUTES } from '@/constants/routes';

interface LeadCardProps {
  lead: Lead;
  onDelete?: (id: string) => void;
}

export function LeadCard({ lead }: LeadCardProps) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const isLinkedin = lead.sequenceType === 'linkedin';

  return (
    <Card className="flex flex-col justify-between transition-all hover:shadow-md border-slate-200/80 dark:border-slate-800">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={ROUTES.LEAD_DETAIL(lead.id)}
              className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:underline"
            >
              {fullName}
            </Link>
            {lead.designation && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{lead.designation}</p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isLinkedin
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900'
            }`}
          >
            {isLinkedin ? <Linkedin className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
            {isLinkedin ? 'LinkedIn' : 'Email'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{lead.company}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400 py-2">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <a href={`mailto:${lead.email}`} className="hover:underline truncate">
            {lead.email}
          </a>
        </div>

        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span>Added {formatDate(lead.createdAt)}</span>
        <div className="flex items-center gap-1">
          <Link href={ROUTES.LEAD_DETAIL(lead.id)}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Eye className="h-3.5 w-3.5 text-slate-500" />
            </Button>
          </Link>
          <Link href={ROUTES.EDIT_LEAD(lead.id)}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
