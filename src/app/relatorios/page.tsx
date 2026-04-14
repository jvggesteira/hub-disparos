'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import {
  getDisparoClients,
  getAllClientsOverview,
  getDispatchesByClient,
  getResultByDispatch,
  getClientROIMetrics,
  getActivityLogs,
} from '@/hooks/use-disparos';
import type {
  DisparoClient,
  DisparoDispatch,
  DisparoResult,
  DisparoActivityLog,
} from '@/hooks/use-disparos';
import {
  FileDown,
  FileText,
  Users,
  Activity,
  Calendar,
  Search,
  ChevronDown,
  Loader2,
  ExternalLink,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

type ClientOverview = Awaited<ReturnType<typeof getAllClientsOverview>>[number];
type ROIMetrics = Awaited<ReturnType<typeof getClientROIMetrics>>;

type ReportTab = 'overview' | 'client' | 'activity';

type PeriodKey = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: 'Todo o periodo',
  this_week: 'Esta semana',
  last_week: 'Semana passada',
  this_month: 'Este mes',
  last_month: 'Mes passado',
  custom: 'Periodo personalizado',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function getPeriodDates(period: PeriodKey, customStart?: string, customEnd?: string): { start?: string; end?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (period === 'all') return {};

  if (period === 'custom') {
    return { start: customStart, end: customEnd };
  }

  if (period === 'this_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return { start: fmt(start), end: fmt(now) };
  }

  if (period === 'last_week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - diff);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return { start: fmt(lastMonday), end: fmt(lastSunday) };
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(start), end: fmt(now) };
  }

  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(start), end: fmt(end) };
  }

  return {};
}

function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

const ACTION_LABELS: Record<string, string> = {
  client_created: 'Criou cliente',
  package_created: 'Criou pacote',
  dispatch_created: 'Registrou disparo',
  result_updated: 'Atualizou resultado',
  client_updated: 'Editou cliente',
  package_updated: 'Editou pacote',
  dispatch_updated: 'Editou disparo',
  package_deleted: 'Removeu pacote',
  dispatch_deleted: 'Removeu disparo',
  package_refunded: 'Estornou mensagens',
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

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // ─── Overview state ───
  const [overviewData, setOverviewData] = useState<ClientOverview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);

  // ─── Client report state ───
  const [clients, setClients] = useState<DisparoClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientDispatches, setClientDispatches] = useState<DisparoDispatch[]>([]);
  const [clientResults, setClientResults] = useState<Record<number, DisparoResult | null>>({});
  const [clientROI, setClientROI] = useState<ROIMetrics | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);

  // ─── Activity log state ───
  const [activityLogs, setActivityLogs] = useState<DisparoActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLimit, setActivityLimit] = useState(50);

  // ─── Fetch clients list (for dropdown) ───
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const data = await getDisparoClients();
        setClients(data);
      } catch {
        // silent
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  // ─── Fetch overview data ───
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await getAllClientsOverview();
      setOverviewData(data);
    } catch {
      // silent
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview();
    }
  }, [activeTab, fetchOverview]);

  // ─── Filter overview by period ───
  const filteredOverview = useMemo(() => {
    // Overview from getAllClientsOverview doesn't have date-level filtering built-in,
    // so we show the full data. Period filter is applied at the display level for context.
    return overviewData;
  }, [overviewData]);

  // ─── Overview totals ───
  const overviewTotals = useMemo(() => {
    return filteredOverview.reduce(
      (acc, c) => ({
        totalContracted: acc.totalContracted + c.totalContracted,
        totalDelivered: acc.totalDelivered + c.totalDelivered,
        totalBalance: acc.totalBalance + c.totalBalance,
        totalDispatches: acc.totalDispatches + c.totalDispatches,
        grossRevenue: acc.grossRevenue + c.grossRevenue,
        companyRevenue: acc.companyRevenue + c.companyRevenue,
        partnerRevenue: acc.partnerRevenue + c.partnerRevenue,
      }),
      {
        totalContracted: 0,
        totalDelivered: 0,
        totalBalance: 0,
        totalDispatches: 0,
        grossRevenue: 0,
        companyRevenue: 0,
        partnerRevenue: 0,
      }
    );
  }, [filteredOverview]);

  // ─── Fetch client report ───
  const fetchClientReport = useCallback(async (clientId: number) => {
    setClientLoading(true);
    try {
      const [dispatches, roi] = await Promise.all([
        getDispatchesByClient(clientId),
        getClientROIMetrics(clientId),
      ]);
      setClientDispatches(dispatches);
      setClientROI(roi);

      // Fetch results for each dispatch
      const results: Record<number, DisparoResult | null> = {};
      await Promise.all(
        dispatches.map(async (d) => {
          results[d.id] = await getResultByDispatch(d.id);
        })
      );
      setClientResults(results);
    } catch {
      // silent
    } finally {
      setClientLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'client' && selectedClientId) {
      fetchClientReport(selectedClientId);
    }
  }, [activeTab, selectedClientId, fetchClientReport]);

  // ─── Fetch activity logs ───
  const fetchActivityLogs = useCallback(async (limit: number) => {
    setActivityLoading(true);
    try {
      const data = await getActivityLogs({ limit });
      setActivityLogs(data);
    } catch {
      // silent
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs(activityLimit);
    }
  }, [activeTab, activityLimit, fetchActivityLogs]);

  // ─── Export handlers ───
  const handleExportOverview = () => {
    const headers = [
      'Nome', 'Empresa', 'Status', 'Contratadas', 'Entregues', 'Saldo',
      'Disparos', 'Rec. Bruta', 'Rec. Empresa', 'Rec. Parceiro',
    ];
    const rows = filteredOverview.map((c) => [
      c.clientName,
      c.clientCompany || '-',
      STATUS_LABELS[c.status] || c.status,
      c.totalContracted,
      c.totalDelivered,
      c.totalBalance,
      c.totalDispatches,
      formatCurrency(c.grossRevenue),
      formatCurrency(c.companyRevenue),
      formatCurrency(c.partnerRevenue),
    ]);
    // Totals row
    rows.push([
      'TOTAL', '', '',
      overviewTotals.totalContracted,
      overviewTotals.totalDelivered,
      overviewTotals.totalBalance,
      overviewTotals.totalDispatches,
      formatCurrency(overviewTotals.grossRevenue),
      formatCurrency(overviewTotals.companyRevenue),
      formatCurrency(overviewTotals.partnerRevenue),
    ]);
    const date = new Date().toISOString().split('T')[0];
    exportToCSV(`relatorio-visao-geral-${date}.csv`, headers, rows);
  };

  const handleExportClient = () => {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    const headers = [
      'Disparo', 'Data', 'Enviadas', 'Entregues', 'Lidas', 'Respondidas',
      'Clicadas', 'Leads', 'Vendas', 'Receita',
    ];
    const rows = clientDispatches.map((d) => {
      const result = clientResults[d.id];
      return [
        d.name,
        new Date(d.dispatch_date).toLocaleDateString('pt-BR'),
        d.sent_messages,
        d.delivered_messages,
        d.read_messages || 0,
        d.replied_messages || 0,
        d.clicked_messages || 0,
        result?.leads_count || 0,
        result?.sales_count || 0,
        result?.revenue ? formatCurrency(Number(result.revenue)) : 'R$ 0,00',
      ];
    });
    const date = new Date().toISOString().split('T')[0];
    const slug = (client?.name || 'cliente').toLowerCase().replace(/\s+/g, '-');
    exportToCSV(`relatorio-${slug}-${date}.csv`, headers, rows);
  };

  const handleExportActivity = () => {
    const headers = ['Data/Hora', 'Usuario', 'Acao', 'Entidade', 'Detalhes'];
    const rows = activityLogs.map((log) => [
      new Date(log.created_at).toLocaleString('pt-BR'),
      log.user_email,
      ACTION_LABELS[log.action] || log.action,
      log.entity_name || `${log.entity_type} #${log.entity_id}`,
      JSON.stringify(log.details || {}),
    ]);
    const date = new Date().toISOString().split('T')[0];
    exportToCSV(`log-atividades-${date}.csv`, headers, rows);
  };

  // ─── Selected client info ───
  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // ─── Tab definitions ───
  const tabs: { key: ReportTab; label: string; icon: typeof FileText }[] = [
    { key: 'overview', label: 'Visao Geral', icon: FileText },
    { key: 'client', label: 'Por Cliente', icon: Users },
    { key: 'activity', label: 'Log de Atividades', icon: Activity },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────

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
                Relatorios
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Exporte e analise os dados do sistema de disparos
              </p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex gap-2 mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                      : 'bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-500/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              VISAO GERAL
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div>
              {/* Period filter + Export */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                {/* Period selector */}
                <div className="relative">
                  <button
                    onClick={() => setPeriodOpen(!periodOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-purple-500" />
                    {PERIOD_LABELS[period]}
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  {periodOpen && (
                    <div className="absolute top-full left-0 mt-1 z-20 w-56 bg-white dark:bg-[#1a1230] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                      {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
                        <button
                          key={key}
                          onClick={() => {
                            setPeriod(key);
                            setPeriodOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            period === key
                              ? 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                          }`}
                        >
                          {PERIOD_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Custom date inputs */}
                {period === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                    <span className="text-slate-400 text-sm">ate</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                )}

                <div className="sm:ml-auto">
                  <button
                    onClick={handleExportOverview}
                    disabled={overviewLoading || filteredOverview.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
                  >
                    <FileDown className="w-4 h-4" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Loading */}
              {overviewLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              )}

              {/* Empty */}
              {!overviewLoading && filteredOverview.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Nenhum dado disponivel para o relatorio.
                  </p>
                </div>
              )}

              {/* Overview table */}
              {!overviewLoading && filteredOverview.length > 0 && (
                <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/[0.06]">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Nome</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Empresa</th>
                          <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Contratadas</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Entregues</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Saldo</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Disparos</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Rec. Bruta</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Rec. Empresa</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Rec. Parceiro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOverview.map((c) => (
                          <tr
                            key={c.clientId}
                            className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                            onClick={() => router.push(`/clientes/${c.clientId}`)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.clientName}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.clientCompany || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status] || ''}`}>
                                {STATUS_LABELS[c.status] || c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(c.totalContracted)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(c.totalDelivered)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(c.totalBalance)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{c.totalDispatches}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(c.grossRevenue)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(c.companyRevenue)}</td>
                            <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400 font-medium">{formatCurrency(c.partnerRevenue)}</td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="bg-slate-50 dark:bg-white/[0.03] font-semibold">
                          <td className="px-4 py-3 text-slate-900 dark:text-white">TOTAL</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatNumber(overviewTotals.totalContracted)}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatNumber(overviewTotals.totalDelivered)}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatNumber(overviewTotals.totalBalance)}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{overviewTotals.totalDispatches}</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(overviewTotals.grossRevenue)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(overviewTotals.companyRevenue)}</td>
                          <td className="px-4 py-3 text-right text-purple-600 dark:text-purple-400">{formatCurrency(overviewTotals.partnerRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              POR CLIENTE
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'client' && (
            <div>
              {/* Client selector + Export */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                <div className="relative w-full sm:w-80">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                  <select
                    value={selectedClientId || ''}
                    onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {selectedClientId && (
                  <button
                    onClick={handleExportClient}
                    disabled={clientLoading || clientDispatches.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20 sm:ml-auto"
                  >
                    <FileDown className="w-4 h-4" />
                    Exportar CSV
                  </button>
                )}
              </div>

              {/* No client selected */}
              {!selectedClientId && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Selecione um cliente para gerar o relatorio.
                  </p>
                </div>
              )}

              {/* Loading */}
              {selectedClientId && clientLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              )}

              {/* Client report */}
              {selectedClientId && !clientLoading && clientROI && (
                <div className="space-y-6">
                  {/* Stats summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { label: 'Enviadas', value: formatNumber(clientROI.totalSent), color: 'text-blue-600 dark:text-blue-400' },
                      { label: 'Entregues', value: formatNumber(clientROI.totalDelivered), color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Taxa Entrega', value: `${clientROI.deliveryRate.toFixed(1)}%`, color: 'text-purple-600 dark:text-purple-400' },
                      { label: 'Leads', value: formatNumber(clientROI.totalLeads), color: 'text-amber-600 dark:text-amber-400' },
                      { label: 'Vendas', value: formatNumber(clientROI.totalSales), color: 'text-pink-600 dark:text-pink-400' },
                      { label: 'Receita (cliente)', value: formatCurrency(clientROI.totalRevenue), color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Investimento', value: formatCurrency(clientROI.totalInvestment), color: 'text-slate-600 dark:text-slate-300' },
                      { label: 'ROI', value: `${clientROI.roi.toFixed(1)}%`, color: clientROI.roi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
                      { label: 'Custo/Lead', value: formatCurrency(clientROI.costPerLead), color: 'text-orange-600 dark:text-orange-400' },
                      { label: 'Custo/Venda', value: formatCurrency(clientROI.costPerSale), color: 'text-rose-600 dark:text-rose-400' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4"
                      >
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
                        <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Dispatches table */}
                  {clientDispatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <p className="text-slate-600 dark:text-slate-400">
                        Este cliente ainda nao possui disparos registrados.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.06]">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Disparos ({clientDispatches.length})
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200/80 dark:border-white/[0.06]">
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Disparo</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Data</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Enviadas</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Entregues</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Lidas</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Respondidas</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Clicadas</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Leads</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Vendas</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Receita</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientDispatches.map((d) => {
                              const result = clientResults[d.id];
                              return (
                                <tr
                                  key={d.id}
                                  className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                                >
                                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.name}</td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                    {new Date(d.dispatch_date).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(d.sent_messages)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(d.delivered_messages)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(d.read_messages || 0)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(d.replied_messages || 0)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatNumber(d.clicked_messages || 0)}</td>
                                  <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">{result?.leads_count || 0}</td>
                                  <td className="px-4 py-3 text-right text-pink-600 dark:text-pink-400">{result?.sales_count || 0}</td>
                                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                    {result?.revenue ? formatCurrency(Number(result.revenue)) : 'R$ 0,00'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              LOG DE ATIVIDADES
          ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'activity' && (
            <div>
              {/* Export button */}
              <div className="flex justify-end mb-6">
                <button
                  onClick={handleExportActivity}
                  disabled={activityLoading || activityLogs.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>

              {/* Loading */}
              {activityLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              )}

              {/* Empty */}
              {!activityLoading && activityLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center mb-4">
                    <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    Nenhuma atividade registrada ainda.
                  </p>
                </div>
              )}

              {/* Activity table */}
              {!activityLoading && activityLogs.length > 0 && (
                <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-white/[0.06]">
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Data/Hora</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Usuario</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Acao</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Entidade</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              {log.user_email}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300">
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.entity_type === 'client' || log.entity_type === 'package' || log.entity_type === 'dispatch' ? (
                                <button
                                  onClick={() => {
                                    // Navigate to the client page. For packages/dispatches, entity details may contain client_id.
                                    const clientId =
                                      log.entity_type === 'client'
                                        ? log.entity_id
                                        : (log.details as any)?.client_id || null;
                                    if (clientId) {
                                      router.push(`/clientes/${clientId}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                                >
                                  {log.entity_name || `${log.entity_type} #${log.entity_id}`}
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-300">
                                  {log.entity_name || `${log.entity_type} #${log.entity_id}`}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                              {log.details && Object.keys(log.details).length > 0
                                ? Object.entries(log.details)
                                    .filter(([k]) => k !== 'client_id')
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ')
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Load more */}
                  <div className="flex justify-center py-4 border-t border-slate-200/80 dark:border-white/[0.06]">
                    <button
                      onClick={() => setActivityLimit((prev) => prev + 50)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                    >
                      Carregar mais atividades
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
