'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Mail, Lock, LogIn } from 'lucide-react';

import { loginSchema, LoginFormData } from '@/schemas/login.schema';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success('Successfully logged in!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log in';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Work Email"
        type="email"
        placeholder="alex@company.com"
        icon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        icon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900"
            {...register('rememberMe')}
          />
          Remember me
        </label>
        <button
          type="button"
          onClick={() => toast.info('Password reset is not enabled in MVP mode.')}
          className="text-xs font-medium text-slate-900 hover:underline dark:text-slate-200"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-2"
        isLoading={isSubmitting}
      >
        <LogIn className="mr-2 h-4 w-4" />
        Sign in to LeadFlow
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link
            href={ROUTES.SIGNUP}
            className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
          >
            Create SDR Account
          </Link>
        </p>
      </div>
    </form>
  );
};
