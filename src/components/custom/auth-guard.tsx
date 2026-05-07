'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/verify',
  '/update-password',
  '/auth/callback',
  '/acompanhamento',
];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    if (isPublicRoute) {
      // Rota pública — sempre libera
      setAllowed(true);

      // Se já logado e está no login, manda pro dashboard
      if (isAuthenticated && pathname === '/login') {
        router.replace('/');
      }
    } else if (!isAuthenticated) {
      // Rota privada sem auth — redireciona e libera (para não ficar em spinner eterno)
      setAllowed(false);
      router.replace('/login');
    } else {
      // Rota privada com auth — libera
      setAllowed(true);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  // Se não autenticado em rota privada, mostra loading enquanto redireciona
  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  return <>{children}</>;
}
