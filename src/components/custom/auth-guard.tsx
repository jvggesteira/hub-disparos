'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/verify',
  '/update-password',
  '/auth/callback',
  '/acompanhamento',
];

function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white" />
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  useEffect(() => {
    if (isLoading) return;

    if (!isPublicRoute && !isAuthenticated) {
      router.replace('/login');
    }

    if (isAuthenticated && pathname === '/login') {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, pathname, router, isPublicRoute]);

  // Carregando auth — mostra spinner
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Rota publica — sempre renderiza
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Rota privada autenticada — renderiza
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Rota privada sem auth — spinner enquanto redireciona
  return <LoadingSpinner />;
}
