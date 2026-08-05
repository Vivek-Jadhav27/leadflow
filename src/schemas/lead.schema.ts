import { z } from 'zod';

export const leadSchema = z.object({
  firstName: z.string().min(1, 'First Name is required').trim(),
  lastName: z.string().trim(),
  company: z.string().trim(),
  designation: z.string().trim(),
  email: z
    .string()
    .trim()
    .refine((val) => val === '' || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    }),
  phone: z.string().trim(),
  linkedin: z.string().trim(),
  notes: z.string(),
  sequenceType: z.enum(['linkedin', 'email']),
});

export type LeadFormData = z.infer<typeof leadSchema>;
