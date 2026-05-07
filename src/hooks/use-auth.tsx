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

  const fetchUserProfile = useCallback(async (supabaseUser: User): Promise<UserProfile | null> => {
    if (!supabaseUser) return null;
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
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: fullName,
        first_name: firstName,
        last_name: lastName,
        role: profile?.role || 'collaborator',
        permissions: profile?.permissions || {},
      };
    } catch (error) {
      console.error("Auth Error (Fallback ativado):", error);
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
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
      if (error || !supabaseUser) {
        setUser(null);
      } else {
        const profile = await fetchUserProfile(supabaseUser);
        setUser(profile);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Usa getUser() que valida o token no servidor, evitando sessões expiradas
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

        if (mounted) {
          if (!error && supabaseUser) {
            const profile = await fetchUserProfile(supabaseUser);
            setUser(profile);
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Erro na inicializacao:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Ignora eventos durante signOut manual (evita loops)
        if (signingOut.current) return;

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (mounted) setUser(profile);
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          const profile = await fetchUserProfile(session.user);
          if (mounted) setUser(profile);
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
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
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
