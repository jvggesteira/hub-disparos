'use client';

import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// --- INTERFACES ---
interface UserProfile {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions: Record<string, any>;
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
  const initialized = useRef(false);

  const buildProfile = useCallback(async (supabaseUser: User): Promise<UserProfile> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao buscar perfil:", error.message);
      }

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
        permissions: {}
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
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildProfile]);

  useEffect(() => {
    // Previne dupla inicializacao (React StrictMode)
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    // Usa onAuthStateChange com INITIAL_SESSION como unica fonte de verdade
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (signingOut.current) return;

        if (event === 'INITIAL_SESSION') {
          // Primeira verificacao — usa a sessao local (rapido, sem rede)
          if (session?.user) {
            const profile = await buildProfile(session.user);
            if (mounted) setUser(profile);
          } else {
            if (mounted) setUser(null);
          }
          if (mounted) setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await buildProfile(session.user);
          if (mounted) setUser(profile);
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token renovado — nao precisa re-buscar perfil, so atualiza se necessario
          // Nao faz nada agressivo aqui para evitar loops
        }

        if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [buildProfile]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      setUser(null);
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error("SignOut Error:", error);
    } finally {
      signingOut.current = false;
      setIsLoading(false);
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
