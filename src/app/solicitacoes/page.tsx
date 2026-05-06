'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import {
  Plus, Search, Filter, Clock, CheckCircle, XCircle,
  AlertTriangle, Loader2, Send, FileText, Users,
  Calendar, Eye, RotateCcw, Inbox,
} from 'lucide-react';
import {
  getRequestsByClient, getAllRequests, getRequestStats, cancelRequest,
  resubmitRequest, getClientIdForUser,
  type DispatchRequest, type DispatchRequestStatus,
} from '@/hooks/use-dispatch-requests';
import { getDisparoClients, type DisparoClient } from '@/hooks/use-disparos';

const STATUS_CONFIG: Record<DispatchRequestStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/15 text-gray-400', icon: FileText },
  submitted: { label: 'Enviado', color: 'bg-blue-500/15 text-blue-400', icon: Send },
  queued: { label: 'Na Fila', color: 'bg-yellow-500/15 text-yellow-400', icon: Clock },
  processing: { label: 'Processando', color: 'bg-purple-500/15 text-purple-400', icon: Loader2 },
  completed: { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle },
  failed: { label: 'Erro', color: 'bg-red-500/15 text-red-400', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-500/15 text-gray-500', icon: XCircle },
};

function StatusBadge({ status }: { status: DispatchRequestStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function SolicitacoesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [clients, setClients] = useState<DisparoClient[]>([]);
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, processing: 0, completed: 0, failed: 0, submitted: 0, queued: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Resolver client_id para clientes
  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      setClientId(null); // Admin vê tudo
      return;
    }
    getClientIdForUser(user.id).then((id) => {
      setClientId(id);
      if (!id) console.warn('Nenhum cliente vinculado a este usuário');
    });
  }, [user, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      let reqData: DispatchRequest[];
      if (isAdmin) {
        reqData = await getAllRequests(
          statusFilter !== 'all' ? { status: statusFilter as DispatchRequestStatus } : undefined
        );
      } else if (clientId) {
        reqData = await getRequestsByClient(clientId);
      } else {
        reqData = [];
      }

      const statsData = await getRequestStats(isAdmin ? undefined : clientId || undefined);
      setRequests(reqData);
      setStats(statsData);

      if (isAdmin) {
        const clientsData = await getDisparoClients();
        setClients(clientsData);
      }
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (isAdmin || clientId)) loadData();
  }, [statusFilter, user, clientId, isAdmin]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'all' && !isAdmin && r.status !== statusFilter) return false;
    if (clientFilter !== 'all' && r.client_id !== Number(clientFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = r.disparo_clients?.name?.toLowerCase() || '';
      const offer = r.offer_text?.toLowerCase() || '';
      if (!clientName.includes(q) && !offer.includes(q)) return false;
    }
    return true;
  });

  const handleCancel = async (id: string) => {
    try {
      await cancelRequest(id, user?.email || '');
      setConfirmCancel(null);
      setToast({ type: 'success', message: 'Solicitação cancelada com sucesso.' });
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleResubmit = async (id: string) => {
    try {
      await resubmitRequest(id, user?.email || '');
      setToast({ type: 'success', message: 'Solicitação reenviada com sucesso.' });
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const statCards = [
    { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Processando', value: stats.processing, icon: Loader2, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Concluídos', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Com Erro', value: stats.failed, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  // Cliente sem vínculo
  if (!isAdmin && user && !clientId && !loading) {
    return (
      <div className="flex h-screen bg-[#0a0118]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/40">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Conta não vinculada</p>
              <p className="text-sm mt-1">Entre em contato com o administrador para vincular sua conta a um cliente.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0118]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'}`}>
              {toast.type === 'error' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
              <p className="text-sm">{toast.message}</p>
              <button onClick={() => setToast(null)} className="p-1 hover:opacity-70"><XCircle className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* Confirm Cancel Modal */}
          {confirmCancel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#1a0d2e] border border-white/[0.1] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-lg font-semibold text-white mb-2">Cancelar solicitação?</h3>
                <p className="text-sm text-white/50 mb-6">Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setConfirmCancel(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors">Manter</button>
                  <button onClick={() => handleCancel(confirmCancel)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">Sim, cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">
              {isAdmin ? 'Todas as Solicitações' : 'Minhas Solicitações'}
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {isAdmin ? 'Gerencie todas as solicitações de disparo' : 'Acompanhe suas solicitações de disparo'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40">{s.label}</span>
                  <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-white/[0.04] border-white/[0.06] text-white/50'}`}
                >
                  <Filter className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => router.push('/solicitacoes/nova')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-purple-600/20"
            >
              <Plus className="h-4 w-4" />
              Nova Solicitação
            </button>
          </div>

          {/* Filters (admin only) */}
          {showFilters && isAdmin && (
            <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white focus:outline-none">
                  <option value="all">Todos</option>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (<option key={key} value={key}>{cfg.label}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Cliente</label>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white focus:outline-none">
                  <option value="all">Todos</option>
                  {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-purple-400 animate-spin" /></div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30">
              <Inbox className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Nenhuma solicitação encontrada</p>
              <p className="text-sm mt-1">Crie uma nova solicitação para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div key={req.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 cursor-pointer" onClick={() => router.push(`/solicitacoes/${req.id}`)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {isAdmin && <span className="text-sm font-medium text-white truncate">{req.disparo_clients?.name || `Cliente #${req.client_id}`}</span>}
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-white/50 truncate mb-2">
                        {req.offer_text ? req.offer_text.substring(0, 100) + (req.offer_text.length > 100 ? '...' : '') : 'Sem oferta definida'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
                        {req.preferred_date && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(req.preferred_date)} {req.preferred_time?.substring(0, 5) || ''}</span>
                        )}
                        {req.contact_count > 0 && (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{req.contact_count.toLocaleString('pt-BR')} contatos</span>
                        )}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(req.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(req.status === 'draft' || req.status === 'submitted') && (
                        <button onClick={() => setConfirmCancel(req.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Cancelar"><XCircle className="h-4 w-4" /></button>
                      )}
                      {(req.status === 'failed' || req.status === 'cancelled') && (
                        <button onClick={() => handleResubmit(req.id)} className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Reenviar"><RotateCcw className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => router.push(`/solicitacoes/${req.id}`)} className="p-1.5 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/10 transition-colors" title="Ver detalhes"><Eye className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
