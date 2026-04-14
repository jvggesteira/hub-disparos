'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Send, Loader2, BarChart3, TrendingUp, Users, ShoppingCart, DollarSign, Mail, CheckCircle, Eye, MessageSquare, MousePointerClick, Target, ArrowRight } from 'lucide-react';
import { getClientPortalData, getClientMonthlyTrends } from '@/hooks/use-disparos';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, ComposedChart, Area, Line,
} from 'recharts';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtN(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v);
}
function fmtPct(v: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + '%';
}
function fmtDate(dateStr: string) {
  const dt = new Date(dateStr);
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  const [y, m, d] = local.toISOString().split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatMonth(monthKey: string) {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES[m] || m}/${y.slice(2)}`;
}

type PortalData = Awaited<ReturnType<typeof getClientPortalData>>;
type TrendData = Awaited<ReturnType<typeof getClientMonthlyTrends>>;

export default function AcompanhamentoPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [data, setData] = useState<PortalData>(null);
  const [trends, setTrends] = useState<TrendData>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!clientId || isNaN(clientId)) {
      setError(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [portalData, trendData] = await Promise.all([
          getClientPortalData(clientId),
          getClientMonthlyTrends(clientId),
        ]);
        if (!portalData) {
          setError(true);
        } else {
          setData(portalData);
          setTrends(trendData);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0a1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 text-lg">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Cliente nao encontrado</h1>
          <p className="text-slate-500 dark:text-slate-400">O link de acompanhamento e invalido ou o cliente nao existe.</p>
        </div>
      </div>
    );
  }

  const { client, summary, dispatches } = data;

  const funnelSteps = [
    { label: 'Enviadas', value: summary.totalSent, color: 'bg-purple-500', barColor: 'bg-purple-500/20 dark:bg-purple-500/10', textColor: 'text-purple-700 dark:text-purple-300', icon: Send },
    { label: 'Entregues', value: summary.totalDelivered, color: 'bg-indigo-500', barColor: 'bg-indigo-500/20 dark:bg-indigo-500/10', textColor: 'text-indigo-700 dark:text-indigo-300', icon: CheckCircle },
    { label: 'Lidas', value: summary.totalRead, color: 'bg-blue-500', barColor: 'bg-blue-500/20 dark:bg-blue-500/10', textColor: 'text-blue-700 dark:text-blue-300', icon: Eye },
    { label: 'Respondidas', value: summary.totalReplied, color: 'bg-cyan-500', barColor: 'bg-cyan-500/20 dark:bg-cyan-500/10', textColor: 'text-cyan-700 dark:text-cyan-300', icon: MessageSquare },
    { label: 'Cliques', value: summary.totalClicked, color: 'bg-emerald-500', barColor: 'bg-emerald-500/20 dark:bg-emerald-500/10', textColor: 'text-emerald-700 dark:text-emerald-300', icon: MousePointerClick },
    { label: 'Leads', value: summary.totalLeads, color: 'bg-green-500', barColor: 'bg-green-500/20 dark:bg-green-500/10', textColor: 'text-green-700 dark:text-green-300', icon: Target },
    { label: 'Vendas', value: summary.totalSales, color: 'bg-green-600', barColor: 'bg-green-600/20 dark:bg-green-600/10', textColor: 'text-green-700 dark:text-green-300', icon: ShoppingCart },
  ];

  const leadToSaleRate = summary.totalLeads > 0
    ? (summary.totalSales / summary.totalLeads) * 100
    : 0;

  const chartData = trends.map(t => ({
    ...t,
    monthLabel: formatMonth(t.month),
  }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0a1a]">
      {/* Top Bar */}
      <div className="bg-white dark:bg-[#141028] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white">Hub Disparos</span>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{client.name}</p>
            {client.company && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{client.company}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Acompanhamento de Disparos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Resultados das suas campanhas de WhatsApp</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Saldo Restante"
            value={fmtN(summary.totalBalance)}
            subtitle="mensagens"
            icon={<Mail className="w-5 h-5 text-purple-600" />}
            accent="purple"
          />
          <SummaryCard
            label="Total Enviadas"
            value={fmtN(summary.totalSent)}
            subtitle="mensagens"
            icon={<Send className="w-5 h-5 text-indigo-600" />}
            accent="indigo"
          />
          <SummaryCard
            label="Total Entregues"
            value={fmtN(summary.totalDelivered)}
            subtitle="mensagens"
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
            accent="emerald"
          />
          <SummaryCard
            label="Taxa de Entrega"
            value={fmtPct(summary.deliveryRate)}
            subtitle="entregues / enviadas"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            accent="blue"
          />
        </div>

        {/* Funnel Visualization */}
        <div className="bg-white dark:bg-[#141028] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Funil de Resultados
          </h2>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => {
              const maxVal = funnelSteps[0].value || 1;
              const widthPct = Math.max((step.value / maxVal) * 100, 8);
              const prevValue = i > 0 ? funnelSteps[i - 1].value : null;
              const conversionRate = prevValue && prevValue > 0
                ? (step.value / prevValue) * 100
                : null;
              const Icon = step.icon;

              return (
                <div key={step.label} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${step.textColor}`} />
                    <span className={`text-sm font-medium ${step.textColor}`}>{step.label}</span>
                  </div>
                  <div className="flex-1 relative">
                    <div
                      className={`h-10 rounded-lg ${step.color} flex items-center px-3 transition-all duration-500`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-white font-semibold text-sm whitespace-nowrap">
                        {fmtN(step.value)}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    {conversionRate !== null ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {fmtPct(conversionRate)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">--</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              As porcentagens representam a taxa de conversao entre cada etapa do funil.
            </p>
          </div>
        </div>

        {/* ROI / Results Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Leads"
            value={fmtN(summary.totalLeads)}
            subtitle="contatos qualificados"
            icon={<Target className="w-5 h-5 text-emerald-600" />}
            accent="emerald"
          />
          <SummaryCard
            label="Total Vendas"
            value={fmtN(summary.totalSales)}
            subtitle="conversoes"
            icon={<ShoppingCart className="w-5 h-5 text-green-600" />}
            accent="green"
          />
          <SummaryCard
            label="Faturamento Gerado"
            value={fmt(summary.totalRevenue)}
            subtitle="receita total"
            icon={<DollarSign className="w-5 h-5 text-purple-600" />}
            accent="purple"
          />
          <SummaryCard
            label="Taxa Lead → Venda"
            value={fmtPct(leadToSaleRate)}
            subtitle="conversao de leads em vendas"
            icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
            accent="indigo"
          />
        </div>

        {/* Monthly Trends Chart */}
        {chartData.length > 0 && (
          <div className="bg-white dark:bg-[#141028] rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Tendencia Mensal
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1e1b3a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        delivered: 'Entregues',
                        leads: 'Leads',
                        sales: 'Vendas',
                      };
                      return [fmtN(value), labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        delivered: 'Entregues',
                        leads: 'Leads',
                        sales: 'Vendas',
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="delivered"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="leads"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sales"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Dispatches History Table */}
        <div className="bg-white dark:bg-[#141028] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Historico de Disparos
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0a1a]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enviadas</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Entregues</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Taxa</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leads</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vendas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      Nenhum disparo registrado ainda.
                    </td>
                  </tr>
                ) : (
                  dispatches.map((d) => {
                    const rate = d.sent > 0 ? (d.delivered / d.sent) * 100 : 0;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDate(d.date)}</td>
                        <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-white">{d.name}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 text-right">{fmtN(d.sent)}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 text-right">{fmtN(d.delivered)}</td>
                        <td className="px-6 py-3 text-sm text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            rate >= 90
                              ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : rate >= 70
                                ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                                : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'
                          }`}>
                            {fmtPct(rate)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 text-right">{fmtN(d.leads)}</td>
                        <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 text-right">{fmtN(d.sales)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141028]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center gap-2">
          <span className="text-sm text-slate-400 dark:text-slate-500">Powered by</span>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Send className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">Hub Disparos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SummaryCard({ label, value, subtitle, icon, accent }: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const borderColors: Record<string, string> = {
    purple: 'border-purple-200 dark:border-purple-500/20',
    indigo: 'border-indigo-200 dark:border-indigo-500/20',
    emerald: 'border-emerald-200 dark:border-emerald-500/20',
    green: 'border-green-200 dark:border-green-500/20',
    blue: 'border-blue-200 dark:border-blue-500/20',
  };
  const bgAccents: Record<string, string> = {
    purple: 'bg-purple-50 dark:bg-purple-500/10',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10',
    green: 'bg-green-50 dark:bg-green-500/10',
    blue: 'bg-blue-50 dark:bg-blue-500/10',
  };

  return (
    <div className={`bg-white dark:bg-[#141028] rounded-xl border ${borderColors[accent] || 'border-slate-200 dark:border-slate-800'} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${bgAccents[accent] || 'bg-slate-100 dark:bg-slate-800'} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}
