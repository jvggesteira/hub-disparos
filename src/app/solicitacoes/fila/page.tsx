'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import {
  Clock, CheckCircle, XCircle, Loader2, Send, Users,
  Calendar, Eye, Play, AlertTriangle, Inbox, Hash,
} from 'lucide-react';
import {
  getAllRequests, startProcessing, completeRequest, failRequest,
  type DispatchRequest, type DispatchRequestStatus,
} from '@/hooks/use-dispatch-requests';

const STATUS_CONFIG: Record<DispatchRequestStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/15 text-gray-400', icon: Clock },
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

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function FilaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<'queue' | 'processing' | 'done'>('queue');

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllRequests();
      setRequests(data);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await startProcessing(id, user?.email || '');
      loadData();
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: string) => {
    setActionLoading(id);
    try {
      await completeRequest(id, user?.email || '', 0);
      loadData();
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFail = async (id: string) => {
    const reason = prompt('Motivo do erro:');
    if (!reason) return;
    setActionLoading(id);
    try {
      await failRequest(id, user?.email || '', reason);
      loadData();
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Não-admin redirect
  if (user && !isAdmin) {
    router.push('/solicitacoes');
    return null;
  }

  const queueItems = requests
    .filter((r) => r.status === 'submitted' || r.status === 'queued')
    .sort((a, b) => new Date(a.submitted_at || a.created_at).getTime() - new Date(b.submitted_at || b.created_at).getTime());

  const processingItems = requests.filter((r) => r.status === 'processing');

  const doneItems = requests
    .filter((r) => r.status === 'completed' || r.status === 'failed')
    .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
    .slice(0, 20);

  const tabs = [
    { key: 'queue' as const, label: 'Fila', count: queueItems.length, color: 'text-yellow-400' },
    { key: 'processing' as const, label: 'Processando', count: processingItems.length, color: 'text-purple-400' },
    { key: 'done' as const, label: 'Finalizados', count: doneItems.length, color: 'text-emerald-400' },
  ];

  const currentItems = tab === 'queue' ? queueItems : tab === 'processing' ? processingItems : doneItems;

  return (
    <div className="flex h-screen bg-[#0a0118]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">Fila de Disparos</h1>
            <p className="text-sm text-white/40 mt-1">
              Gerencie a fila FIFO de solicitações de disparo
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Na Fila</span>
                <div className="p-1.5 rounded-lg bg-yellow-500/10"><Clock className="h-4 w-4 text-yellow-400" /></div>
              </div>
              <p className="text-2xl font-bold text-white">{queueItems.length}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Processando</span>
                <div className="p-1.5 rounded-lg bg-purple-500/10"><Loader2 className="h-4 w-4 text-purple-400" /></div>
              </div>
              <p className="text-2xl font-bold text-white">{processingItems.length}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Finalizados (recentes)</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10"><CheckCircle className="h-4 w-4 text-emerald-400" /></div>
              </div>
              <p className="text-2xl font-bold text-white">{doneItems.length}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t.label}
                <span className={`ml-2 text-xs ${tab === t.key ? t.color : 'text-white/30'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30">
              <Inbox className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">Nenhuma solicitação nesta aba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentItems.map((req, index) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {tab === 'queue' && (
                          <span className="flex items-center gap-1 text-xs font-mono text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md">
                            <Hash className="h-3 w-3" />
                            {index + 1}
                          </span>
                        )}
                        <span className="text-sm font-medium text-white truncate">
                          {req.disparo_clients?.name || `Cliente #${req.client_id}`}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-white/50 truncate mb-2">
                        {req.offer_text ? req.offer_text.substring(0, 120) + (req.offer_text.length > 120 ? '...' : '') : 'Sem oferta'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
                        {req.preferred_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(req.preferred_date).toLocaleDateString('pt-BR')} {req.preferred_time?.substring(0, 5) || ''}
                          </span>
                        )}
                        {req.contact_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {req.contact_count.toLocaleString('pt-BR')} contatos
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Enviado: {formatDateTime(req.submitted_at || req.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(req.status === 'submitted' || req.status === 'queued') && (
                        <button
                          onClick={() => handleStart(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Iniciar
                        </button>
                      )}
                      {req.status === 'processing' && (
                        <>
                          <button
                            onClick={() => handleComplete(req.id)}
                            disabled={actionLoading === req.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Concluir
                          </button>
                          <button
                            onClick={() => handleFail(req.id)}
                            disabled={actionLoading === req.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Erro
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => router.push(`/solicitacoes/${req.id}`)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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
