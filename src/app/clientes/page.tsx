'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import { getDisparoClients, createDisparoClient, updateDisparoClient, deleteDisparoClient, getAllClientsStats } from '@/hooks/use-disparos';
import type { DisparoClient } from '@/hooks/use-disparos';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, ArrowRight, Building2, Mail, Phone,
  Trash2, Pencil, Loader2, Package, Send, Wallet, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

interface ClientForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  status: 'ativo' | 'pausado' | 'encerrado';
}

const emptyForm: ClientForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  notes: '',
  status: 'ativo',
};

const STATUS_BADGE: Record<string, string> = {
  ativo: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  pausado: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  encerrado: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
};

const FILTER_OPTIONS = [
  { value: undefined, label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'encerrado', label: 'Encerrados' },
] as const;

export default function DisparoClientesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [clients, setClients] = useState<DisparoClient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>({ ...emptyForm });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clientStats, setClientStats] = useState<Record<number, { totalContracted: number; totalDelivered: number; totalBalance: number; totalDispatches: number }>>({});
  const [invitingId, setInvitingId] = useState<number | null>(null);

  // ---------- Invite ----------
  const handleInvite = async (client: DisparoClient) => {
    if (!client.email) {
      toast({ title: 'Cliente sem email', description: 'Cadastre um email para poder convidar.', variant: 'destructive' });
      return;
    }
    setInvitingId(client.id);
    try {
      const res = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: client.email, clientId: client.id, clientName: client.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: data.alreadyExists ? 'Acesso vinculado!' : 'Convite enviado!',
        description: data.message,
        className: 'bg-green-600 text-white border-none',
      });
    } catch (err: any) {
      toast({ title: 'Erro ao convidar', description: err.message, variant: 'destructive' });
    } finally {
      setInvitingId(null);
    }
  };

  // ---------- Fetch ----------
  const fetchClients = async () => {
    setIsLoading(true);
    const data = await getDisparoClients();
    setClients(data);
    try { const s = await getAllClientsStats(); setClientStats(s); } catch {}
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // ---------- Filtered list ----------
  const filtered = useMemo(() => {
    let list = clients;
    if (statusFilter) {
      list = list.filter(c => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, statusFilter, search]);

  // ---------- Handlers ----------
  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await createDisparoClient({
        name: form.name.trim(), company: form.company.trim(), email: form.email.trim(),
        phone: form.phone.trim(), notes: form.notes.trim(), status: form.status,
      });
      toast({ title: 'Cliente criado!', description: `${form.name} adicionado com sucesso.`, className: 'bg-green-600 text-white border-none' });
      setCreateOpen(false);
      setForm({ ...emptyForm });
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Erro ao criar cliente', description: err.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const openEdit = (client: DisparoClient) => {
    setEditId(client.id);
    setForm({
      name: client.name || '', company: client.company || '', email: client.email || '',
      phone: client.phone || '', notes: client.notes || '', status: client.status,
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId || !form.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await updateDisparoClient(editId, {
        name: form.name.trim(), company: form.company.trim(), email: form.email.trim(),
        phone: form.phone.trim(), notes: form.notes.trim(), status: form.status,
      } as any);
      toast({ title: 'Cliente atualizado!', className: 'bg-green-600 text-white border-none' });
      setEditOpen(false); setEditId(null); setForm({ ...emptyForm });
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDisparoClient(deleteId);
      toast({ title: 'Cliente removido', className: 'bg-green-600 text-white border-none' });
      setDeleteId(null);
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  };

  const updateField = (field: keyof ClientForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ---------- Render form fields ----------
  const renderFormFields = () => (
    <div className="space-y-4 mt-4">
      <div>
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder="Nome do cliente"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="company">Empresa</Label>
        <Input
          id="company"
          value={form.company}
          onChange={e => updateField('company', e.target.value)}
          placeholder="Nome da empresa"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={e => updateField('email', e.target.value)}
          placeholder="email@exemplo.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={e => updateField('phone', e.target.value)}
          placeholder="(00) 00000-0000"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          value={form.status}
          onChange={e => updateField('status', e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Anotações sobre o cliente..."
          className="mt-1"
          rows={3}
        />
      </div>
    </div>
  );

  // ---------- Render ----------
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0c0a1a] transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Clientes de Disparo
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'} cadastrado{clients.length === 1 ? '' : 's'}
              </p>
            </div>
            {!isClient && (
              <Button
                onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true); }}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Cliente
              </Button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-500/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, empresa ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Nenhum cliente cadastrado ainda.
              </p>
              {!isClient && (
                <Button
                  onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true); }}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar primeiro cliente
                </Button>
              )}
            </div>
          )}

          {/* Client grid */}
          {!isLoading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(client => (
                <Card
                  key={client.id}
                  className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => router.push(`/clientes/${client.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-700 dark:text-purple-300 font-semibold text-sm shrink-0">
                          {client.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                            {client.name}
                          </h3>
                          {client.company && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              {client.company}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Status badge */}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_BADGE[client.status] || ''}`}>
                        {STATUS_LABELS[client.status] || client.status}
                      </span>
                    </div>

                    {/* Contact info */}
                    <div className="space-y-1.5 mb-3">
                      {client.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {client.email}
                        </p>
                      )}
                      {client.phone && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          {client.phone}
                        </p>
                      )}
                    </div>

                    {/* Stats preview */}
                    {clientStats[client.id] && (
                      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-2 text-center">
                          <p className="text-slate-400 dark:text-white/40">Saldo</p>
                          <p className={`font-bold ${clientStats[client.id].totalBalance < 5000 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {new Intl.NumberFormat('pt-BR').format(clientStats[client.id].totalBalance)}
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-2 text-center">
                          <p className="text-slate-400 dark:text-white/40">Disparos</p>
                          <p className="font-bold text-purple-500">{clientStats[client.id].totalDispatches}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-2 text-center">
                          <p className="text-slate-400 dark:text-white/40">Contratadas</p>
                          <p className="font-bold text-slate-900 dark:text-white">{new Intl.NumberFormat('pt-BR').format(clientStats[client.id].totalContracted)}</p>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                      <span className="text-xs text-slate-400">
                        Criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <div className="flex items-center gap-1">
                        {!isClient && (
                          <button
                            onClick={e => { e.stopPropagation(); handleInvite(client); }}
                            disabled={invitingId === client.id}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                            title="Convidar para plataforma"
                          >
                            {invitingId === client.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        )}
                        {!isClient && (
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(client); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {!isClient && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteId(client.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create dialog */}
          <Dialog open={createOpen} onOpenChange={open => { if (!open) { setCreateOpen(false); setForm({ ...emptyForm }); } else { setCreateOpen(true); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Cliente de Disparo</DialogTitle>
              </DialogHeader>
              {renderFormFields()}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setCreateOpen(false); setForm({ ...emptyForm }); }} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar Cliente
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit dialog */}
          <Dialog open={editOpen} onOpenChange={open => { if (!open) { setEditOpen(false); setEditId(null); setForm({ ...emptyForm }); } else { setEditOpen(true); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Cliente</DialogTitle>
              </DialogHeader>
              {renderFormFields()}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setEditOpen(false); setEditId(null); setForm({ ...emptyForm }); }} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleUpdate} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O cliente e seus dados serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                >
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </main>
      </div>
    </div>
  );
}
