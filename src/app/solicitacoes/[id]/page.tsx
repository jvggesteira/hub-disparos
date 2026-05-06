'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, Send, FileText,
  Loader2, Download, Calendar, Users, MessageSquare,
  Image, Video, FileSpreadsheet, Play, RotateCcw,
  AlertTriangle, History,
} from 'lucide-react';
import {
  getRequestById, getAuditLog, getQueuePosition,
  cancelRequest, startProcessing, completeRequest,
  failRequest, resubmitRequest,
  type DispatchRequest, type DispatchRequestStatus, type DispatchAuditLog,
} from '@/hooks/use-dispatch-requests';

const STATUS_CONFIG: Record<DispatchRequestStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  draft: { label: 'Rascunho', color: 'text-gray-400', bgColor: 'bg-gray-500/15', icon: FileText },
  submitted: { label: 'Enviado', color: 'text-blue-400', bgColor: 'bg-blue-500/15', icon: Send },
  queued: { label: 'Na Fila', color: 'text-yellow-400', bgColor: 'bg-yellow-500/15', icon: Clock },
  processing: { label: 'Processando', color: 'text-purple-400', bgColor: 'bg-purple-500/15', icon: Loader2 },
  completed: { label: 'Concluído', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', icon: CheckCircle },
  failed: { label: 'Erro', color: 'text-red-400', bgColor: 'bg-red-500/15', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'text-gray-500', bgColor: 'bg-gray-500/15', icon: XCircle },
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SolicitacaoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [request, setRequest] = useState<DispatchRequest | null>(null);
  const [auditLog, setAuditLog] = useState<DispatchAuditLog[]>([]);
  const [queuePosition, setQueuePosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [showAdminNotes, setShowAdminNotes] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, logData] = await Promise.all([getRequestById(id), getAuditLog(id)]);
      setRequest(reqData);
      setAuditLog(logData);
      if (reqData.status === 'submitted' || reqData.status === 'queued') {
        const pos = await getQueuePosition(id);
        setQueuePosition(pos);
      }
    } catch (err) { console.error('Erro:', err); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true);
    try { await action(); await loadData(); } catch (err: any) { alert(err.message); } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex h-screen bg-[#0a0118]"><Sidebar /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div></div>;
  if (!request) return <div className="flex h-screen bg-[#0a0118]"><Sidebar /><div className="flex-1 flex items-center justify-center text-white/40">Solicitação não encontrada</div></div>;

  const statusCfg = STATUS_CONFIG[request.status];
  const StatusIcon = statusCfg.icon;
  const profile = request.dispatch_profiles;

  return (
    <div className="flex h-screen bg-[#0a0118]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => router.push(isAdmin ? '/solicitacoes/fila' : '/solicitacoes')} className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 mb-6 transition-colors"><ArrowLeft className="h-4 w-4" />Voltar</button>

            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-white">{request.disparo_clients?.name || `Cliente #${request.client_id}`}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}><StatusIcon className={`h-3.5 w-3.5 ${request.status === 'processing' ? 'animate-spin' : ''}`} />{statusCfg.label}</span>
                </div>
                {request.disparo_clients?.company && <p className="text-sm text-white/40">{request.disparo_clients.company}</p>}
                {queuePosition > 0 && <p className="text-sm text-yellow-400 mt-1">Posição na fila: #{queuePosition}</p>}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && request.status === 'submitted' && <button onClick={() => handleAction(() => startProcessing(id, user?.email || ''))} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Iniciar</button>}
                {isAdmin && request.status === 'processing' && (
                  <>
                    <button onClick={() => handleAction(() => completeRequest(id, user?.email || '', adminNotes))} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"><CheckCircle className="h-4 w-4" />Concluir</button>
                    <button onClick={() => setShowAdminNotes(true)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"><XCircle className="h-4 w-4" />Erro</button>
                  </>
                )}
                {(request.status === 'draft' || request.status === 'submitted') && <button onClick={() => { if (confirm('Cancelar esta solicitação?')) handleAction(() => cancelRequest(id, user?.email || '')); }} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 text-sm rounded-lg disabled:opacity-50"><XCircle className="h-4 w-4" />Cancelar</button>}
                {(request.status === 'failed' || request.status === 'cancelled') && <button onClick={() => handleAction(() => resubmitRequest(id, user?.email || ''))} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"><RotateCcw className="h-4 w-4" />Reenviar</button>}
              </div>
            </div>

            {showAdminNotes && (
              <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <h3 className="text-sm font-medium text-red-400 mb-2">Descreva o erro</h3>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} placeholder="O que deu errado..." className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none resize-none mb-3" />
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (!adminNotes.trim()) { alert('Descreva o erro.'); return; } handleAction(() => failRequest(id, user?.email || '', adminNotes)); setShowAdminNotes(false); }} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg">Confirmar Erro</button>
                  <button onClick={() => setShowAdminNotes(false)} className="px-4 py-2 text-white/50 text-sm">Cancelar</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Perfil */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" />Perfil WhatsApp</h3>
                {profile ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {profile.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-semibold">{profile.whatsapp_name.charAt(0)}</div>}
                      <div><p className="text-sm font-medium text-white">{profile.whatsapp_name}</p><p className="text-xs text-white/40">DDD: {profile.ddd}</p></div>
                    </div>
                    <div><p className="text-xs text-white/30 mb-1">Números de redirecionamento:</p>{profile.redirect_numbers.map((n, i) => <span key={i} className="inline-block mr-2 mb-1 px-2 py-0.5 rounded bg-white/[0.04] text-xs text-white/70">{n}</span>)}</div>
                  </div>
                ) : <p className="text-sm text-white/30">Nenhum perfil</p>}
              </div>

              {/* Agendamento */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Agendamento</h3>
                <div className="space-y-2">
                  <div><p className="text-xs text-white/30">Data</p><p className="text-sm text-white">{request.preferred_date ? new Date(request.preferred_date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</p></div>
                  <div><p className="text-xs text-white/30">Horário</p><p className="text-sm text-white">{request.preferred_time?.substring(0, 5) || '-'}</p></div>
                </div>
              </div>

              {/* Oferta */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Oferta</h3>
                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{request.offer_text || 'Sem oferta'}</p>
                {request.media_url && (
                  <div className="mt-4 p-3 rounded-lg border border-white/[0.06] bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      {request.media_type === 'video' ? <Video className="h-5 w-5 text-purple-400" /> : <Image className="h-5 w-5 text-blue-400" />}
                      <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{request.media_file_name || 'Mídia'}</p><p className="text-xs text-white/40">{request.media_type === 'video' ? 'Vídeo' : 'Imagem'}{request.media_size_bytes && ` · ${(request.media_size_bytes / 1024 / 1024).toFixed(2)} MB`}</p></div>
                      <a href={request.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white transition-colors"><Download className="h-3.5 w-3.5" />Abrir</a>
                    </div>
                    {request.media_type === 'image' && <img src={request.media_url} alt="Mídia" className="mt-3 max-h-60 rounded-lg object-contain" />}
                  </div>
                )}
              </div>

              {/* Base */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" />Base de Contatos</h3>
                {request.contact_list_url ? (
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10"><FileSpreadsheet className="h-5 w-5 text-emerald-400" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{request.contact_file_name || 'Planilha'}</p>{request.contact_count > 0 && <p className="text-xs text-white/40">{request.contact_count.toLocaleString('pt-BR')} contatos</p>}</div>
                    <a href={request.contact_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white transition-colors"><Download className="h-3.5 w-3.5" />Baixar</a>
                  </div>
                ) : <p className="text-sm text-white/30">Nenhuma base</p>}
              </div>

              {/* Timeline */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5" />Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-white/40">Criado</span><span className="text-white">{formatDateTime(request.created_at)}</span></div>
                  {request.submitted_at && <div className="flex justify-between"><span className="text-white/40">Enviado</span><span className="text-white">{formatDateTime(request.submitted_at)}</span></div>}
                  {request.processing_started_at && <div className="flex justify-between"><span className="text-white/40">Processando</span><span className="text-white">{formatDateTime(request.processing_started_at)}</span></div>}
                  {request.completed_at && <div className="flex justify-between"><span className="text-white/40">Concluído</span><span className="text-white">{formatDateTime(request.completed_at)}</span></div>}
                  {request.processed_by && <div className="flex justify-between"><span className="text-white/40">Por</span><span className="text-white">{request.processed_by}</span></div>}
                </div>
              </div>

              {request.admin_notes && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />Notas do Admin</h3>
                  <p className="text-sm text-white whitespace-pre-wrap">{request.admin_notes}</p>
                </div>
              )}

              {auditLog.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 lg:col-span-2">
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2"><History className="h-3.5 w-3.5" />Histórico</h3>
                  <div className="space-y-2">
                    {auditLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                        <div className="mt-0.5 h-2 w-2 rounded-full bg-purple-400 flex-shrink-0" />
                        <div className="flex-1"><p className="text-sm text-white"><span className="font-medium">{log.action}</span><span className="text-white/40"> por {log.changed_by}</span></p><p className="text-xs text-white/30">{formatDateTime(log.created_at)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
