import { z } from 'zod';
import {
  validateCompanyName,
  validateCompanyLinkedinUrl,
  checkPasswordRequirements,
  normalizeEmail,
} from '@/utils/validation';

export const adminSignupSchema = z
  .object({
    companyName: z
      .string()
      .min(1, 'Company name is required')
      .superRefine((val, ctx) => {
        const result = validateCompanyName(val);
        if (!result.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error || 'Invalid company name',
          });
        }
      }),
    companyLinkedinUrl: z
      .string()
      .min(1, 'Company LinkedIn URL is required')
      .superRefine((val, ctx) => {
        const result = validateCompanyLinkedinUrl(val);
        if (!result.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error || 'Invalid company LinkedIn URL',
          });
        }
      }),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email address')
      .transform(normalizeEmail),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .superRefine((val, ctx) => {
        const reqs = checkPasswordRequirements(val);
        if (!reqs.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
          });
        }
      }),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type AdminSignupInput = z.infer<typeof adminSignupSchema>;

export const sdrSignupSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(80, 'Full name cannot exceed 80 characters')
      .refine((val) => val.trim().length >= 2, {
        message: 'Full name cannot be whitespace only',
      }),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email address')
      .transform(normalizeEmail),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .superRefine((val, ctx) => {
        const reqs = checkPasswordRequirements(val);
        if (!reqs.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
          });
        }
      }),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    token: z.string().min(1, 'Invitation token is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SDRSignupInput = z.infer<typeof sdrSignupSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address').transform(normalizeEmail),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const inviteSDRSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address').transform(normalizeEmail),
});

export type InviteSDRInput = z.infer<typeof inviteSDRSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .superRefine((val, ctx) => {
        const reqs = checkPasswordRequirements(val);
        if (!reqs.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
          });
        }
      }),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

