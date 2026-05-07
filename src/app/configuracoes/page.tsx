'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Users, UserPlus, Settings, Shield, Mail, Loader2, Trash2,
  ChevronDown, Eye, EyeOff, Key,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: string;
  client_id: number | null;
  created_at: string;
}

interface InviteForm {
  email: string;
  name: string;
  role: 'admin' | 'collaborator' | 'client';
  clientId: string;
}

type SettingsTab = 'usuarios' | 'geral';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  collaborator: 'Colaborador',
  client: 'Cliente',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
  collaborator: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
  client: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const isClientUser = user?.role === 'client';

  // Tab state — clients always see 'geral' only
  const [activeTab, setActiveTab] = useState<SettingsTab>('usuarios');

  // Force client users to 'geral' tab
  useEffect(() => {
    if (isClientUser) setActiveTab('geral');
  }, [isClientUser]);

  // Users state
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '', name: '', role: 'collaborator', clientId: '',
  });
  const [inviting, setInviting] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Clients for dropdown
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);

  // ---------------------------------------------------------------------------
  // Fetch users
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, client_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar usuarios:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'ativo')
        .order('name');
      setClients(data || []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Invite user
  // ---------------------------------------------------------------------------

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) {
      toast({ title: 'Email obrigatorio', variant: 'destructive' });
      return;
    }

    setInviting(true);
    try {
      const body: any = {
        email: inviteForm.email.trim(),
        clientName: inviteForm.name.trim() || undefined,
      };

      // For client role, require clientId
      if (inviteForm.role === 'client') {
        if (!inviteForm.clientId) {
          toast({ title: 'Selecione um cliente para vincular', variant: 'destructive' });
          setInviting(false);
          return;
        }
        body.clientId = parseInt(inviteForm.clientId);
      } else {
        // For admin/collaborator, use clientId 0 (no client link)
        body.clientId = 0;
      }

      const res = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Erro ao convidar');
      }

      toast({ title: result.alreadyExists ? 'Usuario vinculado com sucesso' : 'Convite enviado com sucesso' });
      setShowInviteForm(false);
      setInviteForm({ email: '', name: '', role: 'collaborator', clientId: '' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update user role
  // ---------------------------------------------------------------------------

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ title: 'Funcao atualizada' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Delete user profile
  // ---------------------------------------------------------------------------

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'Perfil removido' });
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Change password
  // ---------------------------------------------------------------------------

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas nao conferem', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: 'Senha alterada com sucesso' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const allTabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'usuarios', label: 'Usuarios', icon: Users },
    { key: 'geral', label: 'Geral', icon: Settings },
  ];
  const tabs = isClientUser ? allTabs.filter(t => t.key === 'geral') : allTabs;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0c0a1a] transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuracoes</h1>
            <p className="text-sm text-slate-500 dark:text-white/40 mt-1">
              Gerencie usuarios, permissoes e configuracoes do sistema
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-xl p-1 w-fit">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ================================================================ */}
          {/* TAB: Usuarios                                                    */}
          {/* ================================================================ */}
          {activeTab === 'usuarios' && (
            <div className="space-y-6">
              {/* Invite button (admin only) */}
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Convidar Usuario
                  </button>
                </div>
              )}

              {/* Invite form */}
              {showInviteForm && isAdmin && (
                <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                    Novo Convite
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Email *</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="usuario@email.com"
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Nome</label>
                      <input
                        type="text"
                        value={inviteForm.name}
                        onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome do usuario"
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Funcao</label>
                      <select
                        value={inviteForm.role}
                        onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as InviteForm['role'] }))}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white"
                      >
                        <option value="admin">Administrador</option>
                        <option value="collaborator">Colaborador</option>
                        <option value="client">Cliente</option>
                      </select>
                    </div>
                    {inviteForm.role === 'client' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Vincular a Cliente *</label>
                        <select
                          value={inviteForm.clientId}
                          onChange={e => setInviteForm(f => ({ ...f, clientId: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white"
                        >
                          <option value="">Selecione...</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => setShowInviteForm(false)}
                      className="px-4 py-2 text-sm text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={inviting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar Convite
                    </button>
                  </div>
                </div>
              )}

              {/* Users list */}
              <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Usuarios do Sistema ({users.length})
                  </h3>
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 text-slate-300 dark:text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-white/40">Nenhum usuario encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/[0.06]">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">Usuario</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">Funcao</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">Cadastro</th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider w-20">Acoes</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-3">
                              <p className="font-medium text-slate-900 dark:text-white">{u.name || 'Sem nome'}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-white/60">{u.email}</td>
                            <td className="px-4 py-3">
                              {isAdmin && u.id !== user?.id ? (
                                <select
                                  value={u.role}
                                  onChange={e => handleRoleChange(u.id, e.target.value)}
                                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROLE_BADGE[u.role] || ROLE_BADGE.collaborator}`}
                                >
                                  <option value="admin">Administrador</option>
                                  <option value="collaborator">Colaborador</option>
                                  <option value="client">Cliente</option>
                                </select>
                              ) : (
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role] || ROLE_BADGE.collaborator}`}>
                                  {ROLE_LABELS[u.role] || u.role}
                                  {u.id === user?.id && ' (voce)'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-white/40 text-xs">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                {u.id !== user?.id && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    title="Remover perfil"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB: Geral                                                       */}
          {/* ================================================================ */}
          {activeTab === 'geral' && (
            <div className="space-y-6">
              {/* Profile info */}
              <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-600" />
                  Meu Perfil
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-white/40 mb-1">Nome</label>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">{user?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-white/40 mb-1">Email</label>
                    <p className="text-sm text-slate-900 dark:text-white">{user?.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-white/40 mb-1">Funcao</label>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[user?.role || 'collaborator']}`}>
                      {ROLE_LABELS[user?.role || 'collaborator']}
                    </span>
                  </div>
                </div>
              </div>

              {/* Change password */}
              <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-600" />
                  Alterar Senha
                </h3>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimo 6 caracteres"
                        className="w-full px-3 py-2 pr-10 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.1] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                    Alterar Senha
                  </button>
                </div>
              </div>

              {/* System info */}
              <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-purple-600" />
                  Informacoes do Sistema
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-white/[0.04]">
                    <span className="text-slate-500 dark:text-white/40">Versao</span>
                    <span className="text-slate-900 dark:text-white font-medium">4.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-white/[0.04]">
                    <span className="text-slate-500 dark:text-white/40">Ambiente</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'Desenvolvimento' : 'Producao'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 dark:text-white/40">Plataforma</span>
                    <span className="text-slate-900 dark:text-white font-medium">Hub de Disparos</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
