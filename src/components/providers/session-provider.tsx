'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Este listener fica ativo o tempo todo monitorando a conexão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      
      // Se o token renovar (a cada 50min aprox), atualiza o Next.js para ele não usar cache velho
      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Sessão renovada automaticamente.');
        router.refresh();
      }

      // Se o usuário deslogar ou o token morrer, chuta para o login imediatamente
      if (event === 'SIGNED_OUT') {
        router.push('/login');
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Renderiza os filhos normalmente
  return <>{children}</>;
}