'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Plus, Package, Send, BarChart3, Wallet, DollarSign, Pencil,
  Trash2, TrendingUp, Loader2, Calendar, ChevronDown, AlertTriangle, RotateCcw, ExternalLink, Copy,
  FileSpreadsheet, Phone, Upload, X, Download, Users,
} from 'lucide-react';
import {
  getDisparoClientById, getPackagesByClient, getClientStats, getDispatchesByClient,
  getDispatchesByClientFiltered, getPackageBalance, createPackage, updatePackage,
  deletePackage, refundPackageMessages, createDispatch, updateDispatch, deleteDispatch,
  getResultByDispatch, upsertDispatchResult, getDispatchResultsForChart,
  uploadDispatchFile,
} from '@/hooks/use-disparos';
import type { DisparoClient, DisparoPackage, DisparoDispatch, DisparoResult } from '@/hooks/use-disparos';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function fmtN(v: number) { return new Intl.NumberFormat('pt-BR').format(v); }

const STATUS_BADGE: Record<string, string> = {
  ativo: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  pausado: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  encerrado: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
};

type PeriodKey = 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
const PERIOD_LABELS: Record<PeriodKey, string> = {
  all: 'Todo o período', this_week: 'Esta semana', last_week: 'Semana passada',
  this_month: 'Este mês', last_month: 'Mês passado', custom: 'Personalizado',
};

function getPeriodDates(key: PeriodKey) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  if (key === 'this_month') {
    return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)) };
  }
  if (key === 'last_month') {
    return { startDate: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), endDate: iso(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)) };
  }
  if (key === 'this_week') {
    const d = now.getDay(); const s = new Date(now); s.setDate(now.getDate() - d); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59);
    return { startDate: iso(s), endDate: iso(e) };
  }
  if (key === 'last_week') {
    const d = now.getDay(); const e = new Date(now); e.setDate(now.getDate() - d - 1); e.setHours(23, 59, 59);
    const s = new Date(e); s.setDate(e.getDate() - 6); s.setHours(0, 0, 0, 0);
    return { startDate: iso(s), endDate: iso(e) };
  }
  return {};
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const router = useRouter();
  const { toast } = useToast();

  const [client, setClient] = useState<DisparoClient | null>(null);
  const [packages, setPackages] = useState<DisparoPackage[]>([]);
  const [dispatches, setDispatches] = useState<DisparoDispatch[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pacotes' | 'disparos' | 'resultados'>('pacotes');

  // Package form
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgEditId, setPkgEditId] = useState<number | null>(null);
  const [pkgDeleteId, setPkgDeleteId] = useState<number | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', contractedMessages: '', pricePerMessage: '', platformCost: '0.20', notes: '' });
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgBalances, setPkgBalances] = useState<Record<number, any>>({});

  // Refund
  const [refundPkgId, setRefundPkgId] = useState<number | null>(null);
  const [refundAmount, setRefundAmount] = useState('');

  // Dispatch form
  const [dispOpen, setDispOpen] = useState(false);
  const [dispEditId, setDispEditId] = useState<number | null>(null);
  const [dispDeleteId, setDispDeleteId] = useState<number | null>(null);
  const [dispForm, setDispForm] = useState({ packageId: '', name: '', dispatchDate: '', sentMessages: '', deliveredMessages: '', redirectionCost: '', notes: '', contactFileUrl: '', contactFileName: '', contactCount: '', redirectNumbers: '' });
  const [dispSaving, setDispSaving] = useState(false);
  const [dispFile, setDispFile] = useState<File | null>(null);
  const [dispFileUploading, setDispFileUploading] = useState(false);

  // Period filter
  const [periodKey, setPeriodKey] = useState<PeriodKey>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Results
  const [resultOpen, setResultOpen] = useState(false);
  const [resultDispId, setResultDispId] = useState<number | null>(null);
  const [resultForm, setResultForm] = useState({ leads: '', sales: '', revenue: '', notes: '' });
  const [resultSaving, setResultSaving] = useState(false);

  async function loadData() {
    try {
      const [c, p, s, d, chart] = await Promise.all([
        getDisparoClientById(clientId), getPackagesByClient(clientId),
        getClientStats(clientId), getDispatchesByClient(clientId),
        getDispatchResultsForChart(clientId),
      ]);
      setClient(c); setPackages(p.filter(pk => pk.is_active)); setStats(s); setDispatches(d); setChartData(chart);
      // Load balances
      const bals: Record<number, any> = {};
      for (const pk of p.filter(pk => pk.is_active)) {
        bals[pk.id] = await getPackageBalance(pk.id);
      }
      setPkgBalances(bals);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { if (clientId) loadData(); }, [clientId]);

  // Filter dispatches by period
  useEffect(() => {
    async function filterDisps() {
      if (periodKey === 'all') {
        const d = await getDispatchesByClient(clientId);
        setDispatches(d);
      } else {
        const dates = periodKey === 'custom'
          ? { startDate: customStart ? new Date(customStart).toISOString() : undefined, endDate: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : undefined }
          : getPeriodDates(periodKey);
        const d = await getDispatchesByClientFiltered(clientId, dates.startDate, dates.endDate);
        setDispatches(d);
      }
    }
    if (clientId) filterDisps();
  }, [clientId, periodKey, customStart, customEnd]);

  // ─── Package Handlers ────────────────────────────────────────────────────────
  const resetPkgForm = () => setPkgForm({ name: '', contractedMessages: '', pricePerMessage: '', platformCost: '0.20', notes: '' });

  async function handlePkgSubmit() {
    setPkgSaving(true);
    try {
      if (pkgEditId) {
        await updatePackage(pkgEditId, {
          name: pkgForm.name, contracted_messages: parseInt(pkgForm.contractedMessages),
          price_per_message: parseFloat(pkgForm.pricePerMessage), platform_cost_per_message: parseFloat(pkgForm.platformCost),
          notes: pkgForm.notes || null,
        } as any);
        toast({ title: 'Pacote atualizado!', className: 'bg-green-600 text-white border-none' });
      } else {
        await createPackage({
          client_id: clientId, name: pkgForm.name, contracted_messages: parseInt(pkgForm.contractedMessages),
          price_per_message: parseFloat(pkgForm.pricePerMessage), platform_cost_per_message: parseFloat(pkgForm.platformCost),
          notes: pkgForm.notes,
        });
        toast({ title: 'Pacote criado!', className: 'bg-green-600 text-white border-none' });
      }
      setPkgOpen(false); setPkgEditId(null); resetPkgForm(); loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setPkgSaving(false);
  }

  async function handlePkgDelete() {
    if (!pkgDeleteId) return;
    try {
      await deletePackage(pkgDeleteId);
      toast({ title: 'Pacote removido', className: 'bg-green-600 text-white border-none' });
      setPkgDeleteId(null); loadData();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  }

  async function handleRefund() {
    if (!refundPkgId || !refundAmount) return;
    try {
      await refundPackageMessages(refundPkgId, parseInt(refundAmount));
      toast({ title: 'Estorno aplicado!', className: 'bg-green-600 text-white border-none' });
      setRefundPkgId(null); setRefundAmount(''); loadData();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  }

  // ─── Dispatch Handlers ───────────────────────────────────────────────────────
  const resetDispForm = () => { setDispForm({ packageId: '', name: '', dispatchDate: '', sentMessages: '', deliveredMessages: '', redirectionCost: '', notes: '', contactFileUrl: '', contactFileName: '', contactCount: '', redirectNumbers: '' }); setDispFile(null); };

  async function handleDispSubmit() {
    setDispSaving(true);
    try {
      // Upload file if selected
      let fileUrl = dispForm.contactFileUrl || undefined;
      let fileName = dispForm.contactFileName || undefined;
      if (dispFile) {
        setDispFileUploading(true);
        const uploaded = await uploadDispatchFile(dispFile, clientId);
        fileUrl = uploaded.url;
        fileName = uploaded.fileName;
        setDispFileUploading(false);
      }

      // Parse redirect numbers (one per line)
      const redirectNumbers = dispForm.redirectNumbers
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (dispEditId) {
        await updateDispatch(dispEditId, {
          name: dispForm.name, dispatch_date: dispForm.dispatchDate,
          sent_messages: parseInt(dispForm.sentMessages), delivered_messages: parseInt(dispForm.deliveredMessages),
          redirection_cost: dispForm.redirectionCost ? parseFloat(dispForm.redirectionCost) : null,
          notes: dispForm.notes || null,
          contact_file_url: fileUrl || null, contact_file_name: fileName || null,
          contact_count: dispForm.contactCount ? parseInt(dispForm.contactCount) : null,
          redirect_numbers: redirectNumbers,
        } as any);
        toast({ title: 'Disparo atualizado!', className: 'bg-green-600 text-white border-none' });
      } else {
        await createDispatch({
          package_id: parseInt(dispForm.packageId), client_id: clientId, name: dispForm.name,
          dispatch_date: dispForm.dispatchDate,
          sent_messages: parseInt(dispForm.sentMessages), delivered_messages: parseInt(dispForm.deliveredMessages),
          redirection_cost: dispForm.redirectionCost ? parseFloat(dispForm.redirectionCost) : undefined,
          notes: dispForm.notes,
          contact_file_url: fileUrl, contact_file_name: fileName,
          contact_count: dispForm.contactCount ? parseInt(dispForm.contactCount) : undefined,
          redirect_numbers: redirectNumbers,
        });
        toast({ title: 'Disparo registrado!', className: 'bg-green-600 text-white border-none' });
      }
      setDispOpen(false); setDispEditId(null); resetDispForm(); loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setDispFileUploading(false);
    }
    setDispSaving(false);
  }

  async function handleDispDelete() {
    if (!dispDeleteId) return;
    try {
      await deleteDispatch(dispDeleteId);
      toast({ title: 'Disparo removido', className: 'bg-green-600 text-white border-none' });
      setDispDeleteId(null); loadData();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  }

  // ─── Result Handlers ─────────────────────────────────────────────────────────
  async function openResultForm(dispatchId: number) {
    setResultDispId(dispatchId);
    const existing = await getResultByDispatch(dispatchId);
    if (existing) {
      setResultForm({
        leads: String(existing.leads_count || ''), sales: String(existing.sales_count || ''),
        revenue: String(existing.revenue || ''), notes: existing.notes || '',
      });
    } else {
      setResultForm({ leads: '', sales: '', revenue: '', notes: '' });
    }
    setResultOpen(true);
  }

  async function handleResultSubmit() {
    if (!resultDispId) return;
    setResultSaving(true);
    try {
      await upsertDispatchResult({
        dispatch_id: resultDispId, leads_count: resultForm.leads ? parseInt(resultForm.leads) : null,
        sales_count: resultForm.sales ? parseInt(resultForm.sales) : null,
        revenue: resultForm.revenue ? parseFloat(resultForm.revenue) : null,
        notes: resultForm.notes || null,
      });
      toast({ title: 'Resultados salvos!', className: 'bg-green-600 text-white border-none' });
      setResultOpen(false); setResultDispId(null); loadData();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    setResultSaving(false);
  }

  // ─── Revenue Preview ─────────────────────────────────────────────────────────
  const revenuePreview = useMemo(() => {
    const price = parseFloat(pkgForm.pricePerMessage) || 0;
    const platform = parseFloat(pkgForm.platformCost) || 0;
    const contracted = parseInt(pkgForm.contractedMessages) || 0;
    if (price <= 0 || contracted <= 0) return null;
    const gross = price * contracted;
    const net = (price - platform) * contracted;
    return { gross, platformCost: platform * contracted, net, company: net / 2, partner: net / 2 };
  }, [pkgForm.pricePerMessage, pkgForm.platformCost, pkgForm.contractedMessages]);

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-[#0c0a1a]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </main>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-[#0c0a1a]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-slate-500">Cliente não encontrado.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0c0a1a] transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/clientes')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[client.status]}`}>
                    {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                  </span>
                </div>
                {client.company && <p className="text-sm text-slate-500 dark:text-white/40">{client.company}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 text-xs"
                  onClick={() => {
                    const url = `${window.location.origin}/acompanhamento/${clientId}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado!', description: 'Cole e envie para o cliente.', className: 'bg-green-600 text-white border-none' });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 text-xs"
                  onClick={() => window.open(`/acompanhamento/${clientId}`, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Visualizar
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: 'Msgs Contratadas', value: fmtN(stats.totalContracted), icon: Package, color: 'text-yellow-500' },
                  { title: 'Msgs Entregues', value: fmtN(stats.totalDelivered), icon: Send, color: 'text-blue-500' },
                  { title: 'Saldo', value: fmtN(stats.totalBalance), icon: Wallet, color: stats.totalBalance < 5000 ? 'text-red-500' : 'text-emerald-500' },
                  { title: 'Disparos', value: fmtN(stats.totalDispatches), icon: BarChart3, color: 'text-purple-500' },
                  { title: 'Receita Bruta', value: fmt(stats.totalGrossRevenue), icon: DollarSign, color: 'text-yellow-500' },
                  { title: 'Custo Plataforma', value: fmt(stats.totalPlatformCost), icon: TrendingUp, color: 'text-red-500' },
                  { title: 'Receita Empresa', value: fmt(stats.totalCompanyRevenue), icon: BarChart3, color: 'text-emerald-500' },
                  { title: 'Receita Parceiro', value: fmt(stats.totalPartnerRevenue), icon: BarChart3, color: 'text-blue-500' },
                ].map((s, i) => (
                  <div key={i} className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider">{s.title}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{s.value}</p>
                      </div>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.06]">
              {(['pacotes', 'disparos', 'resultados'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ═══ TAB: PACOTES ═══ */}
            {activeTab === 'pacotes' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pacotes</h2>
                  <Button onClick={() => { resetPkgForm(); setPkgEditId(null); setPkgOpen(true); }} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Novo Pacote
                  </Button>
                </div>

                {packages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-white/40">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhum pacote cadastrado.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {packages.map(pkg => {
                      const bal = pkgBalances[pkg.id];
                      return (
                        <Card key={pkg.id} className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">{pkg.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-white/40">{fmtN(pkg.contracted_messages)} msgs contratadas · {fmt(Number(pkg.price_per_message))}/msg</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setRefundPkgId(pkg.id); setRefundAmount(''); }}
                                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-yellow-500" title="Estorno">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { setPkgEditId(pkg.id); setPkgForm({ name: pkg.name, contractedMessages: String(pkg.contracted_messages), pricePerMessage: String(pkg.price_per_message), platformCost: String(pkg.platform_cost_per_message), notes: pkg.notes || '' }); setPkgOpen(true); }}
                                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setPkgDeleteId(pkg.id)}
                                  className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            {bal && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><span className="text-slate-500 dark:text-white/40">Entregues</span><p className="font-semibold text-slate-900 dark:text-white">{fmtN(bal.totalDelivered)}</p></div>
                                <div><span className="text-slate-500 dark:text-white/40">Saldo</span><p className={`font-semibold ${bal.balance < 5000 ? 'text-red-500' : 'text-emerald-500'}`}>{fmtN(bal.balance)}</p></div>
                                <div><span className="text-slate-500 dark:text-white/40">Receita Empresa</span><p className="font-semibold text-emerald-600">{fmt(bal.companyRevenue)}</p></div>
                                <div><span className="text-slate-500 dark:text-white/40">Receita Parceiro</span><p className="font-semibold text-blue-500">{fmt(bal.partnerRevenue)}</p></div>
                                {bal.refundedMessages > 0 && <div className="col-span-full"><span className="text-yellow-500 text-[10px]">⚠ {fmtN(bal.refundedMessages)} msgs estornadas</span></div>}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ TAB: DISPAROS ═══ */}
            {activeTab === 'disparos' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Disparos</h2>
                  <div className="flex items-center gap-2">
                    {/* Period filter */}
                    <select value={periodKey} onChange={e => setPeriodKey(e.target.value as PeriodKey)}
                      className="text-xs bg-white dark:bg-[#0c0a1a] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white">
                      {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {periodKey === 'custom' && (
                      <>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs bg-white dark:bg-[#0c0a1a] border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white" />
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs bg-white dark:bg-[#0c0a1a] border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white" />
                      </>
                    )}
                    <Button onClick={() => { resetDispForm(); setDispEditId(null); setDispOpen(true); }} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2" size="sm">
                      <Plus className="h-4 w-4" /> Novo Disparo
                    </Button>
                  </div>
                </div>

                {dispatches.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-white/40">
                    <Send className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhum disparo encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dispatches.map(d => {
                      const pkg = packages.find(p => p.id === d.package_id);
                      const rate = d.sent_messages > 0 ? ((d.delivered_messages / d.sent_messages) * 100).toFixed(1) : '0';
                      return (
                        <Card key={d.id} className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{d.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-white/40">
                                  {(() => { const parts = d.dispatch_date.split('T')[0].split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; })()} · {pkg?.name || 'Pacote removido'}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => openResultForm(d.id)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-purple-500" title="Resultados">
                                  <BarChart3 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { setDispEditId(d.id); setDispForm({ packageId: String(d.package_id), name: d.name, dispatchDate: d.dispatch_date.split('T')[0], sentMessages: String(d.sent_messages), deliveredMessages: String(d.delivered_messages), redirectionCost: d.redirection_cost ? String(d.redirection_cost) : '', notes: d.notes || '', contactFileUrl: d.contact_file_url || '', contactFileName: d.contact_file_name || '', contactCount: d.contact_count ? String(d.contact_count) : '', redirectNumbers: (d.redirect_numbers || []).join('\n') }); setDispFile(null); setDispOpen(true); }}
                                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDispDeleteId(d.id)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                              <div><span className="text-slate-500 dark:text-white/40">Enviadas</span><p className="font-semibold text-slate-900 dark:text-white">{fmtN(d.sent_messages)}</p></div>
                              <div><span className="text-slate-500 dark:text-white/40">Entregues</span><p className="font-semibold text-slate-900 dark:text-white">{fmtN(d.delivered_messages)}</p></div>
                              <div><span className="text-slate-500 dark:text-white/40">Taxa</span><p className="font-semibold text-emerald-600">{rate}%</p></div>
                            </div>
                            {/* Contact info */}
                            {(d.contact_file_name || d.contact_count || (d.redirect_numbers && d.redirect_numbers.length > 0)) && (
                              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                                {d.contact_file_name && (
                                  <a href={d.contact_file_url || '#'} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[180px]">{d.contact_file_name}</span>
                                    <Download className="h-3 w-3" />
                                  </a>
                                )}
                                {d.contact_count != null && d.contact_count > 0 && (
                                  <span className="flex items-center gap-1 text-slate-500 dark:text-white/40">
                                    <Users className="h-3.5 w-3.5" />
                                    {fmtN(d.contact_count)} contatos na base
                                  </span>
                                )}
                                {d.redirect_numbers && d.redirect_numbers.length > 0 && (
                                  <span className="flex items-center gap-1 text-slate-500 dark:text-white/40">
                                    <Phone className="h-3.5 w-3.5" />
                                    {d.redirect_numbers.length} número{d.redirect_numbers.length !== 1 ? 's' : ''} de redirecionamento
                                  </span>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ TAB: RESULTADOS ═══ */}
            {activeTab === 'resultados' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resultados de Conversão</h2>
                {chartData.length > 0 && (
                  <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                    <CardContent className="p-5">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                          <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: 12, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="delivered" name="Entregues" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="leads" name="Leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="sales" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <p className="text-xs text-slate-500 dark:text-white/40">Clique no ícone de gráfico em cada disparo (aba Disparos) para preencher os resultados.</p>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ═══ DIALOG: Pacote ═══ */}
      <Dialog open={pkgOpen} onOpenChange={o => { if (!o) { setPkgOpen(false); setPkgEditId(null); resetPkgForm(); } else setPkgOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{pkgEditId ? 'Editar Pacote' : 'Novo Pacote'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Nome *</Label><Input value={pkgForm.name} onChange={e => setPkgForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Pacote 10K" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Msgs Contratadas *</Label><Input type="number" value={pkgForm.contractedMessages} onChange={e => setPkgForm(f => ({ ...f, contractedMessages: e.target.value }))} /></div>
              <div><Label>Preço/Msg (R$) *</Label><Input type="number" step="0.01" value={pkgForm.pricePerMessage} onChange={e => setPkgForm(f => ({ ...f, pricePerMessage: e.target.value }))} /></div>
            </div>
            <div><Label>Custo Plataforma/Msg (R$)</Label><Input type="number" step="0.01" value={pkgForm.platformCost} onChange={e => setPkgForm(f => ({ ...f, platformCost: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={pkgForm.notes} onChange={e => setPkgForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            {revenuePreview && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-1 text-xs">
                <p className="font-medium text-slate-900 dark:text-white mb-2">Previsão de Receita</p>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-white/40">Receita bruta</span><span>{fmt(revenuePreview.gross)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-white/40">Custo plataforma</span><span className="text-red-500">- {fmt(revenuePreview.platformCost)}</span></div>
                <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.06] pt-1"><span className="text-slate-500 dark:text-white/40">Empresa (50%)</span><span className="text-emerald-600 font-semibold">{fmt(revenuePreview.company)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-white/40">Parceiro (50%)</span><span className="text-blue-500 font-semibold">{fmt(revenuePreview.partner)}</span></div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPkgOpen(false); setPkgEditId(null); resetPkgForm(); }}>Cancelar</Button>
              <Button onClick={handlePkgSubmit} disabled={pkgSaving || !pkgForm.name || !pkgForm.contractedMessages || !pkgForm.pricePerMessage} className="bg-purple-600 hover:bg-purple-700 text-white">
                {pkgSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : pkgEditId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG: Disparo ═══ */}
      <Dialog open={dispOpen} onOpenChange={o => { if (!o) { setDispOpen(false); setDispEditId(null); resetDispForm(); } else setDispOpen(o); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dispEditId ? 'Editar Disparo' : 'Novo Disparo'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {!dispEditId && (
              <div><Label>Pacote *</Label>
                <select value={dispForm.packageId} onChange={e => setDispForm(f => ({ ...f, packageId: e.target.value }))}
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0c0a1a] px-3 py-2 text-sm text-slate-900 dark:text-white">
                  <option value="">Selecione...</option>
                  {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div><Label>Nome do Disparo *</Label><Input value={dispForm.name} onChange={e => setDispForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Campanha Black Friday" /></div>
            <div><Label>Data *</Label><Input type="date" value={dispForm.dispatchDate} onChange={e => setDispForm(f => ({ ...f, dispatchDate: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Msgs Enviadas *</Label><Input type="number" value={dispForm.sentMessages} onChange={e => setDispForm(f => ({ ...f, sentMessages: e.target.value }))} /></div>
              <div><Label>Msgs Entregues *</Label><Input type="number" value={dispForm.deliveredMessages} onChange={e => setDispForm(f => ({ ...f, deliveredMessages: e.target.value }))} /></div>
            </div>
            <div><Label>Custo Redirecionamento (R$)</Label><Input type="number" step="0.01" value={dispForm.redirectionCost} onChange={e => setDispForm(f => ({ ...f, redirectionCost: e.target.value }))} /></div>

            {/* ── Seção: Base de Contatos (Excel) ── */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/60 flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Base de Contatos (Planilha)</p>
              <div>
                <Label>Planilha Excel (.xlsx, .xls, .csv)</Label>
                {dispForm.contactFileName && !dispFile ? (
                  <div className="flex items-center gap-2 mt-1 p-2 bg-white dark:bg-white/[0.04] rounded-md border border-slate-200 dark:border-white/[0.06]">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-slate-700 dark:text-white/60 truncate flex-1">{dispForm.contactFileName}</span>
                    <button onClick={() => { setDispForm(f => ({ ...f, contactFileUrl: '', contactFileName: '' })); setDispFile(null); }} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-lg cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-white/40">{dispFile ? dispFile.name : 'Clique para selecionar arquivo'}</span>
                      <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) setDispFile(f); }} />
                    </label>
                  </div>
                )}
              </div>
              <div>
                <Label>Qtd. de Contatos na Base</Label>
                <Input type="number" value={dispForm.contactCount} onChange={e => setDispForm(f => ({ ...f, contactCount: e.target.value }))} placeholder="Ex: 5000" />
              </div>
            </div>

            {/* ── Seção: Números de Redirecionamento ── */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/60 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Números de Redirecionamento</p>
              <div>
                <Label>Lista de Números (um por linha)</Label>
                <Textarea
                  value={dispForm.redirectNumbers}
                  onChange={e => setDispForm(f => ({ ...f, redirectNumbers: e.target.value }))}
                  rows={4}
                  placeholder={"5511999998888\n5511999997777\n5511999996666"}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
                  {dispForm.redirectNumbers.split('\n').filter(n => n.trim()).length} número(s) adicionado(s)
                </p>
              </div>
            </div>

            <div><Label>Observações</Label><Textarea value={dispForm.notes} onChange={e => setDispForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDispOpen(false); setDispEditId(null); resetDispForm(); }}>Cancelar</Button>
              <Button onClick={handleDispSubmit} disabled={dispSaving || dispFileUploading || !dispForm.name || !dispForm.dispatchDate || !dispForm.sentMessages} className="bg-purple-600 hover:bg-purple-700 text-white">
                {dispSaving || dispFileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : dispEditId ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG: Resultado ═══ */}
      <Dialog open={resultOpen} onOpenChange={o => { if (!o) { setResultOpen(false); setResultDispId(null); } else setResultOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Resultados do Disparo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Leads</Label><Input type="number" value={resultForm.leads} onChange={e => setResultForm(f => ({ ...f, leads: e.target.value }))} /></div>
              <div><Label>Vendas</Label><Input type="number" value={resultForm.sales} onChange={e => setResultForm(f => ({ ...f, sales: e.target.value }))} /></div>
            </div>
            <div><Label>Faturamento (R$)</Label><Input type="number" step="0.01" value={resultForm.revenue} onChange={e => setResultForm(f => ({ ...f, revenue: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={resultForm.notes} onChange={e => setResultForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResultOpen(false)}>Cancelar</Button>
              <Button onClick={handleResultSubmit} disabled={resultSaving} className="bg-purple-600 hover:bg-purple-700 text-white">
                {resultSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG: Estorno ═══ */}
      <Dialog open={refundPkgId !== null} onOpenChange={o => { if (!o) { setRefundPkgId(null); setRefundAmount(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Estornar Mensagens</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-500 dark:text-white/40">Quantas mensagens deseja estornar deste pacote?</p>
            <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="Ex: 1000" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRefundPkgId(null); setRefundAmount(''); }}>Cancelar</Button>
              <Button onClick={handleRefund} disabled={!refundAmount} className="bg-yellow-600 hover:bg-yellow-700 text-white">Estornar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ AlertDialog: Delete Package ═══ */}
      <AlertDialog open={pkgDeleteId !== null} onOpenChange={() => setPkgDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover pacote?</AlertDialogTitle>
            <AlertDialogDescription>O pacote será desativado. Os disparos vinculados serão mantidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePkgDelete} className="bg-red-600 hover:bg-red-700 text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ AlertDialog: Delete Dispatch ═══ */}
      <AlertDialog open={dispDeleteId !== null} onOpenChange={() => setDispDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover disparo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDispDelete} className="bg-red-600 hover:bg-red-700 text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
