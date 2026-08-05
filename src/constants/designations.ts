export const DESIGNATION_OPTIONS = [
  'VP of Engineering',
  'Engineering Manager',
  'QA Lead',
  'QA Manager',
  'Director of Engineering',
  'Director of QA',
] as const;

export type DesignationOption = (typeof DESIGNATION_OPTIONS)[number];
