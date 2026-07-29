'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader } from '@/components/common/Loader';
import { ROUTES } from '@/constants/routes';

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <Loader message="Checking authentication status..." />;
  }

  return (
    <Card className="shadow-lg border-slate-200/80 dark:border-slate-800">
      <CardHeader className="space-y-2 text-center pb-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 shadow-md">
          <Layers className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Welcome to LeadFlow</CardTitle>
        <CardDescription>
          Streamline your sales pipeline and manage leads with speed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
