'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Apenas renova o cache do Next.js quando o token é atualizado
      if (event === 'TOKEN_REFRESHED') {
        router.refresh();
      }
      // SIGNED_OUT é tratado exclusivamente pelo AuthProvider (use-auth.tsx)
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
