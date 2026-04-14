'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

// 1. LISTA ATUALIZADA (Incluindo a raiz '/')
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
  
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return; 

    // Verifica rotas públicas
    // Nota: Para a raiz '/', a verificação é exata. Para as outras, é startsWith.
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

    if (isPublicRoute) {
        setIsChecking(false);

        if (isAuthenticated && pathname === '/login') {
            router.replace('/');
        }
    } else {
        // Rota Privada
        if (!isAuthenticated) {
            router.replace('/login');
        } else {
            setIsChecking(false);
        }
    }
    
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading || isChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  return <>{children}</>;
}