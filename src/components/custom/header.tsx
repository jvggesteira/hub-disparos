'use client';

import { Search, Bell, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 px-6 border-b border-slate-200/80 dark:border-white/5 bg-white/80 dark:bg-[#0c0a1a]/80 backdrop-blur-xl flex items-center justify-between transition-colors duration-300 sticky top-0 z-30">

      {/* Search */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/30 transition-colors group-focus-within:text-purple-500" />
          <input
            type="text"
            placeholder="Buscar clientes, tarefas..."
            className="w-full h-10 pl-10 pr-4 rounded-xl text-sm border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all duration-200"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">

        {/* Notification Button */}
        <button className="relative p-2.5 rounded-xl text-slate-500 dark:text-white/40 hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200 hover:text-slate-700 dark:hover:text-white/70">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-purple-500 ring-2 ring-white dark:ring-[#0c0a1a] animate-pulse" />
        </button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold text-xs cursor-pointer hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-200 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
               {user ? getInitials(user.first_name, user.last_name) : 'GM'}
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#1a1230] border-slate-200 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/20 rounded-xl">
            <DropdownMenuLabel className="text-slate-900 dark:text-white font-semibold">Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
            <div className="px-2 py-1.5 text-sm text-slate-500 dark:text-white/40 break-all">
              {user?.email}
            </div>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
            <DropdownMenuItem className="cursor-pointer text-slate-700 dark:text-white/70 focus:bg-slate-50 dark:focus:bg-white/5 rounded-lg mx-1">
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-slate-700 dark:text-white/70 focus:bg-slate-50 dark:focus:bg-white/5 rounded-lg mx-1">
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
            <DropdownMenuItem
              className="cursor-pointer text-red-500 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 rounded-lg mx-1"
              onClick={signOut}
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}