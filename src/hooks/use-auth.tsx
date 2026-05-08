'use client';

import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: Record<string, any>;
  client_id: number | null;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const signingOut = useRef(false);

  const buildProfile = useCallback(async (supabaseUser: User): Promise<UserProfile> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error) console.warn("Erro ao buscar perfil:", error.message);

      const fullName = profile?.name || supabaseUser.email?.split('@')[0] || 'Usuario';
      const nameParts = fullName.split(' ');

      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: fullName,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' ') || '',
        role: profile?.role || 'collaborator',
        permissions: profile?.permissions || {},
        client_id: profile?.client_id || null,
      };
    } catch (error) {
      console.error("Auth Error (Fallback):", error);
      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: 'Usuario',
        first_name: 'Usuario',
        last_name: '',
        role: 'collaborator',
        permissions: {},
        client_id: null,
      };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await buildProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildProfile]);

  useEffect(() => {
    let mounted = true;

    // 1. Busca sessao do cache local IMEDIATAMENTE (sem rede)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = await buildProfile(session.user);
        if (mounted) setUser(profile);
      }
      if (mounted) setIsLoading(false);
    });

    // 2. Escuta mudancas de auth (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || signingOut.current) return;

        // INITIAL_SESSION: ja tratamos acima com getSession(), ignorar
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await buildProfile(session.user);
          if (mounted) {
            setUser(profile);
            setIsLoading(false);
          }
        }

        // TOKEN_REFRESHED: sessao continua valida, nao precisa fazer nada
        // O Supabase ja atualizou o token internamente

        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    );

    // 3. Safety valve: se isLoading nao resolver em 5s, forca resolucao
    const safetyTimeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [buildProfile]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      setUser(null);
      setIsLoading(false);
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      signingOut.current = false;
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
