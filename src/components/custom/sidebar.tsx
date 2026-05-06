'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Users, Settings, LogOut,
  ChevronLeft, ChevronRight, Send, FileText, ClipboardList, ListOrdered,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Solicitações', href: '/solicitacoes', icon: ClipboardList },
  { name: 'Relatorios', href: '/relatorios', icon: FileText },
];

const adminNavigation = [
  { name: 'Fila de Disparos', href: '/solicitacoes/fila', icon: ListOrdered },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`
        relative flex flex-col h-full border-r border-white/5
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
      `}
      style={{
        background: 'linear-gradient(180deg, #0f0720 0%, #150a2e 50%, #0d0618 100%)',
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-7 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500 transition-all duration-200 hover:scale-110"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Logo */}
      <div className={`flex h-16 items-center border-b border-white/5 ${isCollapsed ? 'justify-center px-2' : 'px-5'}`}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 min-w-[2.25rem] rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <Send className="h-5 w-5 text-white" />
          </div>
          <span className={`text-lg font-bold text-white whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
            Hub Disparos
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {navigation.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : ''}
              className={`
                group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200
                ${isCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-purple-600/15 text-white shadow-sm'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }
              `}
            >
              <div className="relative flex items-center justify-center">
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-purple-500/20 blur-md" />
                )}
                <Icon className={`relative h-[18px] w-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-purple-400' : 'text-white/40 group-hover:text-white/70'}`} />
              </div>
              <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                {item.name}
              </span>
              {isActive && !isCollapsed && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
              )}
            </Link>
          );
        })}

        {/* Admin-only items */}
        {user?.role === 'admin' && (
          <>
            {!isCollapsed && (
              <div className="pt-3 pb-1 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/20">Admin</span>
              </div>
            )}
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : ''}
                  className={`
                    group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200
                    ${isCollapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-purple-600/15 text-white shadow-sm'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                    }
                  `}
                >
                  <div className="relative flex items-center justify-center">
                    {isActive && (
                      <div className="absolute inset-0 rounded-lg bg-purple-500/20 blur-md" />
                    )}
                    <Icon className={`relative h-[18px] w-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-purple-400' : 'text-white/40 group-hover:text-white/70'}`} />
                  </div>
                  <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                  {isActive && !isCollapsed && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-white/5 p-3">
        <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="h-9 w-9 min-w-[2.25rem] rounded-xl flex items-center justify-center text-white font-semibold text-xs"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              {user ? getInitials(user.first_name, user.last_name) : 'HD'}
            </div>
            <div className={`flex flex-col min-w-0 transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
              <p className="text-sm font-medium text-white/90 truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'Carregando...'}
              </p>
              <p className="text-[11px] text-white/40 truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>

          {!isCollapsed && (
            <button
              onClick={signOut}
              title="Sair"
              className="p-2 rounded-lg text-white/30 hover:bg-white/5 hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
