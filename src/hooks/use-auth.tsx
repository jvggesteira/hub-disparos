'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js'; 
import { useRouter } from 'next/navigation';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

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
  
  const [supabase] = useState(() => 
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    )
  );

  const fetchUserProfile = async (supabaseUser: User): Promise<UserProfile | null> => {
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
        // CORREÇÃO DE SEGURANÇA: Fallback é 'collaborator', nunca 'admin'
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
          role: 'collaborator', // Fallback seguro
          permissions: {}
      };
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            const profile = await fetchUserProfile(session.user);
            setUser(profile);
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Erro na inicialização:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        
        if (session?.user) {
           if (!user || user.id !== session.user.id) {
             const profile = await fetchUserProfile(session.user);
             setUser(profile);
           }
        } else {
           setUser(null);
        }

        setIsLoading(false);

        if (event === 'SIGNED_OUT') {
           router.refresh();
           router.push('/login');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  const signOut = async () => {
    setIsLoading(true);
    try {
        await supabase.auth.signOut();
        setUser(null);
        router.push('/login');
        router.refresh();
    } catch (error) {
        console.error("SignOut Error:", error);
    } finally {
        setIsLoading(false);
    }
  };

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