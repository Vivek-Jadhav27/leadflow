import { z } from 'zod';

export const generateSequenceSchema = z.object({
  sequenceType: z.enum(['linkedin', 'email']),
  numberOfFollowUps: z
    .number()
    .min(1, 'At least 1 follow-up is required')
    .max(10, 'Maximum 10 follow-ups allowed'),
});

export const sequenceStepSchema = z.object({
  stepNumber: z.number().min(1),
  scheduledDate: z.string().min(1, 'Scheduled Date is required'),
  message: z.string().min(1, 'Message/Body is required'),
  subject: z.string().optional(),
});

export type GenerateSequenceFormData = z.infer<typeof generateSequenceSchema>;
export type SequenceStepFormData = z.infer<typeof sequenceStepSchema>;
