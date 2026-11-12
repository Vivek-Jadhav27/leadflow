import type { WorkspaceSettings } from '@/types/crm';

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  name: 'LeadFlow B2B Outbound',
  domain: 'leadflow.io',
  timezone: 'America/New_York (UTC-5)',
  currency: 'USD ($)',
  defaultAssignmentRule: 'round_robin',
  defaultFollowupDays: 3,
  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  skipWeekends: true,
  stopSequenceOnReply: true,
  dailyLinkedInConnectLimit: 25,
  dailyLinkedInMessageLimit: 50,
};
