// src/context/theme-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

// 1. Definição do Tipo do Contexto
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  // Opcional: Adicionar a função de toggle para alternar facilmente
  toggleTheme: () => void; 
}

// 2. Criação do Contexto (Valor inicial é undefined)
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 3. Criação do Provedor (Componente que irá envolver a aplicação)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inicializa o estado lendo do LocalStorage ou usando 'light' como padrão
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light';
    }
    return 'light';
  });

  // Função que atualiza o tema no estado e no LocalStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };
  
  // Função para alternar entre light e dark
  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
  };

  // 4. Efeito para aplicar a classe 'dark' no elemento HTML
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  // O useMemo é opcional, mas evita re-renderizações desnecessárias
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// 5. Hook Customizado para uso fácil
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};