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
  FileSpreadsheet, Phone, Upload, X, Download, Users, Target,
} from 'lucide-react';
import {
  getDisparoClientById, getPackagesByClient, getClientStats, getDispatchesByClient,
  getDispatchesByClientFiltered, getPackageBalance, createPackage, updatePackage,
  deletePackage, refundPackageMessages, createDispatch, updateDispatch, deleteDispatch,
  getResultByDispatch, upsertDispatchResult, getDispatchResultsForChartEnhanced,
  uploadDispatchFile, getClientROIMetrics, getClientMonthlyTrends,
  getClientRefunds, getClientRefundTotals, createClientRefund, deleteClientRefund,
} from '@/hooks/use-disparos';
import type { DisparoClient, DisparoPackage, DisparoDispatch, DisparoResult, DisparoClientRefund } from '@/hooks/use-disparos';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function fmtN(v: number) { return new Intl.NumberFormat('pt-BR').format(v); }
/** Extract YYYY-MM-DD from a timestamptz string, interpreting as Brazil timezone */
function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
}
function fmtDate(isoStr: string): string {
  const parts = toLocalDate(isoStr).split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

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
  const [activeTab, setActiveTab] = useState<'pacotes' | 'disparos' | 'resultados' | 'estornos' | 'roi' | 'tendencias'>('pacotes');
  const [roiMetrics, setRoiMetrics] = useState<any>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);

  // Package form
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgEditId, setPkgEditId] = useState<number | null>(null);
  const [pkgDeleteId, setPkgDeleteId] = useState<number | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', contractedMessages: '', pricePerMessage: '', platformCost: '0.20', notes: '', purchaseDate: '' });
  const [pkgSaving, setPkgSaving] = useState(false);
  const [pkgBalances, setPkgBalances] = useState<Record<number, any>>({});

  // Refund (package level)
  const [refundPkgId, setRefundPkgId] = useState<number | null>(null);
  const [refundAmount, setRefundAmount] = useState('');

  // Refund (client level)
  const [clientRefundOpen, setClientRefundOpen] = useState(false);
  const [clientRefundAmount, setClientRefundAmount] = useState('');
  const [clientRefundReason, setClientRefundReason] = useState('');
  const [clientRefundSaving, setClientRefundSaving] = useState(false);
  const [clientRefunds, setClientRefunds] = useState<DisparoClientRefund[]>([]);
  const [clientRefundTotals, setClientRefundTotals] = useState<{ totalRefundedMessages: number; totalRefundGross: number; totalRefundPlatform: number; totalRefundCompany: number; totalRefundPartner: number }>({ totalRefundedMessages: 0, totalRefundGross: 0, totalRefundPlatform: 0, totalRefundCompany: 0, totalRefundPartner: 0 });
  const [deleteRefundId, setDeleteRefundId] = useState<number | null>(null);
  const [refundMode, setRefundMode] = useState<'package' | 'manual'>('manual');
  const [refundSelectedPkgId, setRefundSelectedPkgId] = useState<string>('');
  const [refundManualPrice, setRefundManualPrice] = useState('');
  const [refundManualPlatform, setRefundManualPlatform] = useState('0.20');

  // Dispatch form
  const [dispOpen, setDispOpen] = useState(false);
  const [dispEditId, setDispEditId] = useState<number | null>(null);
  const [dispDeleteId, setDispDeleteId] = useState<number | null>(null);
  const [dispForm, setDispForm] = useState({ packageId: '', name: '', dispatchDate: '', sentMessages: '', deliveredMessages: '', readMessages: '', repliedMessages: '', clickedMessages: '', redirectionCost: '', notes: '', contactFileUrl: '', contactFileName: '', contactCount: '', redirectNumbers: '' });
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
      // Core data - must succeed
      const [c, p, s, d, chart, roi, trends] = await Promise.all([
        getDisparoClientById(clientId), getPackagesByClient(clientId),
        getClientStats(clientId), getDispatchesByClient(clientId),
        getDispatchResultsForChartEnhanced(clientId),
        getClientROIMetrics(clientId),
        getClientMonthlyTrends(clientId),
      ]);
      setClient(c); setPackages(p.filter(pk => pk.is_active)); setStats(s); setDispatches(d); setChartData(chart);
      setRoiMetrics(roi); setMonthlyTrends(trends);

      // Refunds - fail gracefully if table not yet available
      try {
        const [refunds, refTotals] = await Promise.all([
          getClientRefunds(clientId),
          getClientRefundTotals(clientId),
        ]);
        setClientRefunds(refunds); setClientRefundTotals(refTotals);
      } catch { /* table may not exist yet */ }

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
  const resetPkgForm = () => setPkgForm({ name: '', contractedMessages: '', pricePerMessage: '', platformCost: '0.20', notes: '', purchaseDate: '' });

  async function handlePkgSubmit() {
    setPkgSaving(true);
    try {
      if (pkgEditId) {
        await updatePackage(pkgEditId, {
          name: pkgForm.name, contracted_messages: parseInt(pkgForm.contractedMessages),
          price_per_message: parseFloat(pkgForm.pricePerMessage), platform_cost_per_message: parseFloat(pkgForm.platformCost),
          notes: pkgForm.notes || null,
          purchase_date: pkgForm.purchaseDate ? `${pkgForm.purchaseDate}T12:00:00` : null,
        } as any);
        toast({ title: 'Pacote atualizado!', className: 'bg-green-600 text-white border-none' });
      } else {
        await createPackage({
          client_id: clientId, name: pkgForm.name, contracted_messages: parseInt(pkgForm.contractedMessages),
          price_per_message: parseFloat(pkgForm.pricePerMessage), platform_cost_per_message: parseFloat(pkgForm.platformCost),
          notes: pkgForm.notes, purchase_date: pkgForm.purchaseDate || undefined,
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

  // ─── Client Refund Handlers ─────────────────────────────────────────────────

  const clientRefundPreview = useMemo(() => {
    if (!client || !clientRefundAmount) return null;
    const msgs = parseInt(clientRefundAmount) || 0;
    if (msgs <= 0) return null;
    let price = 0;
    let platform = 0;
    if (refundMode === 'package') {
      const pkg = packages.find(p => String(p.id) === refundSelectedPkgId);
      if (!pkg) return null;
      price = Number(pkg.price_per_message);
      platform = Number(pkg.platform_cost_per_message);
    } else {
      price = parseFloat(refundManualPrice) || 0;
      platform = parseFloat(refundManualPlatform) || 0;
      if (price <= 0) return null;
    }
    const gross = price * msgs;
    const platformTotal = platform * msgs;
    const net = (price - platform) * msgs;
    return { msgs, price, platform, gross, platformTotal, net, company: net / 2, partner: net / 2 };
  }, [clientRefundAmount, packages, client, refundMode, refundSelectedPkgId, refundManualPrice, refundManualPlatform]);

  async function handleClientRefund() {
    if (!client || !clientRefundAmount) return;
    const msgs = parseInt(clientRefundAmount);
    if (!msgs || msgs <= 0) return;
    setClientRefundSaving(true);
    try {
      let price = 0;
      let platform = 0;
      if (refundMode === 'package') {
        const pkg = packages.find(p => String(p.id) === refundSelectedPkgId);
        if (!pkg) throw new Error('Selecione um pacote');
        price = Number(pkg.price_per_message);
        platform = Number(pkg.platform_cost_per_message);
      } else {
        price = parseFloat(refundManualPrice) || 0;
        platform = parseFloat(refundManualPlatform) || 0;
        if (price <= 0) throw new Error('Informe o valor por mensagem');
      }
      await createClientRefund({
        client_id: clientId, refunded_messages: msgs,
        price_per_message: price, platform_cost_per_message: platform,
        reason: clientRefundReason || undefined,
      });
      toast({ title: 'Estorno aplicado!', description: `${fmtN(msgs)} mensagens estornadas do cliente.`, className: 'bg-green-600 text-white border-none' });
      setClientRefundOpen(false); setClientRefundAmount(''); setClientRefundReason('');
      setRefundMode('manual'); setRefundSelectedPkgId(''); setRefundManualPrice(''); setRefundManualPlatform('0.20');
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro no estorno', description: err.message, variant: 'destructive' });
    }
    setClientRefundSaving(false);
  }

  async function handleDeleteClientRefund() {
    if (!deleteRefundId) return;
    try {
      await deleteClientRefund(deleteRefundId);
      toast({ title: 'Estorno removido', className: 'bg-green-600 text-white border-none' });
      setDeleteRefundId(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  // ─── Dispatch Handlers ───────────────────────────────────────────────────────
  const resetDispForm = () => { setDispForm({ packageId: '', name: '', dispatchDate: '', sentMessages: '', deliveredMessages: '', readMessages: '', repliedMessages: '', clickedMessages: '', redirectionCost: '', notes: '', contactFileUrl: '', contactFileName: '', contactCount: '', redirectNumbers: '' }); setDispFile(null); };

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
          read_messages: dispForm.readMessages ? parseInt(dispForm.readMessages) : 0,
          replied_messages: dispForm.repliedMessages ? parseInt(dispForm.repliedMessages) : 0,
          clicked_messages: dispForm.clickedMessages ? parseInt(dispForm.clickedMessages) : 0,
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
          read_messages: dispForm.readMessages ? parseInt(dispForm.readMessages) : undefined,
          replied_messages: dispForm.repliedMessages ? parseInt(dispForm.repliedMessages) : undefined,
          clicked_messages: dispForm.clickedMessages ? parseInt(dispForm.clickedMessages) : undefined,
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
                {clientRefundTotals.totalRefundedMessages > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                      {fmtN(clientRefundTotals.totalRefundedMessages)} msgs estornadas
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 text-xs border-yellow-300 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10"
                  onClick={() => { setClientRefundAmount(''); setClientRefundReason(''); setClientRefundOpen(true); }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Estornar
                </Button>
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
            <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.06] overflow-x-auto">
              {([
                { key: 'pacotes', label: 'Pacotes' },
                { key: 'disparos', label: 'Disparos' },
                { key: 'estornos', label: `Estornos${clientRefundTotals.totalRefundedMessages > 0 ? ` (${clientRefunds.length})` : ''}` },
                { key: 'resultados', label: 'Resultados' },
                { key: 'roi', label: 'ROI & Funil' },
                { key: 'tendencias', label: 'Tendencias' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}>
                  {tab.label}
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
                                <p className="text-xs text-slate-500 dark:text-white/40">{fmtN(pkg.contracted_messages)} msgs contratadas · {fmt(Number(pkg.price_per_message))}/msg{pkg.purchase_date ? ` · Compra: ${fmtDate(pkg.purchase_date)}` : ''}</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setRefundPkgId(pkg.id); setRefundAmount(''); }}
                                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-yellow-500" title="Estorno">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { setPkgEditId(pkg.id); setPkgForm({ name: pkg.name, contractedMessages: String(pkg.contracted_messages), pricePerMessage: String(pkg.price_per_message), platformCost: String(pkg.platform_cost_per_message), notes: pkg.notes || '', purchaseDate: pkg.purchase_date ? toLocalDate(pkg.purchase_date) : '' }); setPkgOpen(true); }}
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
                                  {fmtDate(d.dispatch_date)} · {pkg?.name || 'Pacote removido'}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => openResultForm(d.id)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-purple-500" title="Resultados">
                                  <BarChart3 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => { setDispEditId(d.id); setDispForm({ packageId: String(d.package_id), name: d.name, dispatchDate: toLocalDate(d.dispatch_date), sentMessages: String(d.sent_messages), deliveredMessages: String(d.delivered_messages), readMessages: d.read_messages ? String(d.read_messages) : '', repliedMessages: d.replied_messages ? String(d.replied_messages) : '', clickedMessages: d.clicked_messages ? String(d.clicked_messages) : '', redirectionCost: d.redirection_cost ? String(d.redirection_cost) : '', notes: d.notes || '', contactFileUrl: d.contact_file_url || '', contactFileName: d.contact_file_name || '', contactCount: d.contact_count ? String(d.contact_count) : '', redirectNumbers: (d.redirect_numbers || []).join('\n') }); setDispFile(null); setDispOpen(true); }}
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
                            {(d.read_messages > 0 || d.replied_messages > 0 || d.clicked_messages > 0) && (
                              <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                                <div><span className="text-slate-500 dark:text-white/40">Lidas</span><p className="font-semibold text-blue-500">{fmtN(d.read_messages || 0)}</p></div>
                                <div><span className="text-slate-500 dark:text-white/40">Respondidas</span><p className="font-semibold text-cyan-500">{fmtN(d.replied_messages || 0)}</p></div>
                                <div><span className="text-slate-500 dark:text-white/40">Cliques</span><p className="font-semibold text-teal-500">{fmtN(d.clicked_messages || 0)}</p></div>
                              </div>
                            )}
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
                          <Bar dataKey="read" name="Lidas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="replied" name="Respondidas" fill="#06b6d4" radius={[4, 4, 0, 0]} />
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

            {/* ═══ TAB: ESTORNOS ═══ */}
            {activeTab === 'estornos' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Estornos</h2>
                  <Button onClick={() => { setClientRefundAmount(''); setClientRefundReason(''); setRefundMode('manual'); setRefundSelectedPkgId(''); setRefundManualPrice(''); setRefundManualPlatform('0.20'); setClientRefundOpen(true); }} className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl gap-2" size="sm">
                    <RotateCcw className="h-4 w-4" /> Novo Estorno
                  </Button>
                </div>

                {/* Totals cards */}
                {clientRefundTotals.totalRefundedMessages > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                      { title: 'Msgs Estornadas', value: fmtN(clientRefundTotals.totalRefundedMessages), color: 'text-yellow-500' },
                      { title: 'Estorno Bruto', value: `- ${fmt(clientRefundTotals.totalRefundGross)}`, color: 'text-red-500' },
                      { title: 'Estorno Plataforma', value: `- ${fmt(clientRefundTotals.totalRefundPlatform)}`, color: 'text-orange-500' },
                      { title: 'Estorno Empresa', value: `- ${fmt(clientRefundTotals.totalRefundCompany)}`, color: 'text-red-500' },
                      { title: 'Estorno Parceiro', value: `- ${fmt(clientRefundTotals.totalRefundPartner)}`, color: 'text-red-500' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider">{s.title}</p>
                        <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refund history */}
                {clientRefunds.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-white/40">
                    <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhum estorno registrado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientRefunds.map(r => {
                      const platformTotal = Number(r.platform_cost_per_message) * r.refunded_messages;
                      return (
                        <Card key={r.id} className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{fmtN(r.refunded_messages)} mensagens estornadas</h3>
                                <p className="text-xs text-slate-500 dark:text-white/40">
                                  {new Date(r.created_at).toLocaleDateString('pt-BR')} · {fmt(Number(r.price_per_message))}/msg · Plataforma: {fmt(Number(r.platform_cost_per_message))}/msg
                                </p>
                                {r.reason && <p className="text-xs text-slate-400 dark:text-white/30 mt-1">Motivo: {r.reason}</p>}
                              </div>
                              <button onClick={() => setDeleteRefundId(r.id)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500" title="Remover estorno">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div><span className="text-slate-500 dark:text-white/40">Estorno Bruto</span><p className="font-semibold text-red-500">- {fmt(Number(r.refund_gross))}</p></div>
                              <div><span className="text-slate-500 dark:text-white/40">Estorno Plataforma</span><p className="font-semibold text-orange-500">- {fmt(platformTotal)}</p></div>
                              <div><span className="text-slate-500 dark:text-white/40">Estorno Empresa</span><p className="font-semibold text-red-500">- {fmt(Number(r.refund_company))}</p></div>
                              <div><span className="text-slate-500 dark:text-white/40">Estorno Parceiro</span><p className="font-semibold text-red-500">- {fmt(Number(r.refund_partner))}</p></div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ TAB: ROI & FUNIL ═══ */}
            {activeTab === 'roi' && roiMetrics && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Metricas de ROI</h2>

                {/* Funnel visualization */}
                <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-white/60 mb-4">Funil de Conversao</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Enviadas', value: roiMetrics.totalSent, color: 'bg-purple-500', rate: null as number | null },
                        { label: 'Entregues', value: roiMetrics.totalDelivered, color: 'bg-indigo-500', rate: roiMetrics.deliveryRate },
                        { label: 'Lidas', value: roiMetrics.totalRead, color: 'bg-blue-500', rate: roiMetrics.readRate },
                        { label: 'Respondidas', value: roiMetrics.totalReplied, color: 'bg-cyan-500', rate: roiMetrics.replyRate },
                        { label: 'Cliques', value: roiMetrics.totalClicked, color: 'bg-teal-500', rate: roiMetrics.clickRate },
                        { label: 'Leads', value: roiMetrics.totalLeads, color: 'bg-emerald-500', rate: roiMetrics.leadConversionRate },
                        { label: 'Vendas', value: roiMetrics.totalSales, color: 'bg-green-500', rate: roiMetrics.saleConversionRate },
                      ].map((step, i) => {
                        const maxVal = roiMetrics.totalSent || 1;
                        const widthPct = Math.max((step.value / maxVal) * 100, 3);
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 dark:text-white/40 w-24 text-right">{step.label}</span>
                            <div className="flex-1 relative">
                              <div className={`${step.color} rounded-md h-7 flex items-center px-2 transition-all`} style={{ width: `${widthPct}%` }}>
                                <span className="text-white text-xs font-semibold whitespace-nowrap">{fmtN(step.value)}</span>
                              </div>
                            </div>
                            {step.rate !== null && (
                              <span className="text-xs text-slate-400 dark:text-white/30 w-16 text-right">{step.rate.toFixed(1)}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ROI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Total Leads', value: fmtN(roiMetrics.totalLeads), icon: Users, color: 'text-emerald-500' },
                    { title: 'Total Vendas', value: fmtN(roiMetrics.totalSales), icon: TrendingUp, color: 'text-green-500' },
                    { title: 'Faturamento', value: fmt(roiMetrics.totalRevenue), icon: DollarSign, color: 'text-yellow-500' },
                    { title: 'Investimento', value: fmt(roiMetrics.totalInvestment), icon: Wallet, color: 'text-red-500' },
                    { title: 'ROI', value: `${roiMetrics.roi.toFixed(1)}%`, icon: TrendingUp, color: roiMetrics.roi >= 0 ? 'text-green-500' : 'text-red-500' },
                    { title: 'Custo por Lead', value: fmt(roiMetrics.costPerLead), icon: Target, color: 'text-blue-500' },
                    { title: 'Custo por Venda', value: fmt(roiMetrics.costPerSale), icon: DollarSign, color: 'text-indigo-500' },
                    { title: 'Lead → Venda', value: `${roiMetrics.saleConversionRate.toFixed(1)}%`, icon: BarChart3, color: 'text-purple-500' },
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
              </div>
            )}

            {/* ═══ TAB: TENDENCIAS ═══ */}
            {activeTab === 'tendencias' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Historico e Tendencias</h2>

                {monthlyTrends.length > 0 ? (
                  <>
                    {/* Monthly messages chart */}
                    <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-white/60 mb-4">Mensagens por Mes</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyTrends.map(t => ({ ...t, monthLabel: (() => { const [y, m] = t.month.split('-'); const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${mNames[parseInt(m)-1]}/${y.slice(2)}`; })() }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: 12, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="sent" name="Enviadas" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="delivered" name="Entregues" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Monthly conversions chart */}
                    <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-white/60 mb-4">Conversoes por Mes</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyTrends.map(t => ({ ...t, monthLabel: (() => { const [y, m] = t.month.split('-'); const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${mNames[parseInt(m)-1]}/${y.slice(2)}`; })() }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: 12, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="leads" name="Leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sales" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Monthly revenue chart */}
                    <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-white/60 mb-4">Faturamento por Mes</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyTrends.map(t => ({ ...t, monthLabel: (() => { const [y, m] = t.month.split('-'); const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${mNames[parseInt(m)-1]}/${y.slice(2)}`; })() }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: 12, fontSize: 12 }} formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']} />
                            <Bar dataKey="revenue" name="Faturamento" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Monthly summary table */}
                    <Card className="bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06] rounded-2xl">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-white/60 mb-4">Resumo Mensal</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-white/[0.06]">
                                <th className="text-left py-2 px-2 text-slate-500 dark:text-white/40">Mes</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Disparos</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Enviadas</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Entregues</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Taxa</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Leads</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Vendas</th>
                                <th className="text-right py-2 px-2 text-slate-500 dark:text-white/40">Faturamento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyTrends.map((t: any) => {
                                const [y, m] = t.month.split('-');
                                const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                                const label = `${mNames[parseInt(m)-1]}/${y}`;
                                const rate = t.sent > 0 ? ((t.delivered / t.sent) * 100).toFixed(1) : '0';
                                return (
                                  <tr key={t.month} className="border-b border-slate-100 dark:border-white/[0.04]">
                                    <td className="py-2 px-2 font-medium text-slate-900 dark:text-white">{label}</td>
                                    <td className="py-2 px-2 text-right text-slate-700 dark:text-white/70">{t.dispatches}</td>
                                    <td className="py-2 px-2 text-right text-slate-700 dark:text-white/70">{fmtN(t.sent)}</td>
                                    <td className="py-2 px-2 text-right text-slate-700 dark:text-white/70">{fmtN(t.delivered)}</td>
                                    <td className="py-2 px-2 text-right text-emerald-600">{rate}%</td>
                                    <td className="py-2 px-2 text-right text-slate-700 dark:text-white/70">{fmtN(t.leads)}</td>
                                    <td className="py-2 px-2 text-right text-slate-700 dark:text-white/70">{fmtN(t.sales)}</td>
                                    <td className="py-2 px-2 text-right font-medium text-slate-900 dark:text-white">{fmt(t.revenue)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500 dark:text-white/40">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Dados insuficientes para exibir tendencias.</p>
                  </div>
                )}
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Custo Plataforma/Msg (R$)</Label><Input type="number" step="0.01" value={pkgForm.platformCost} onChange={e => setPkgForm(f => ({ ...f, platformCost: e.target.value }))} /></div>
              <div><Label>Data de Compra</Label><Input type="date" value={pkgForm.purchaseDate} onChange={e => setPkgForm(f => ({ ...f, purchaseDate: e.target.value }))} /></div>
            </div>
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
            {/* Métricas do Funil */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-white/60 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Metricas do Funil (opcional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Lidas</Label><Input type="number" value={dispForm.readMessages} onChange={e => setDispForm(f => ({ ...f, readMessages: e.target.value }))} placeholder="0" /></div>
                <div><Label>Respondidas</Label><Input type="number" value={dispForm.repliedMessages} onChange={e => setDispForm(f => ({ ...f, repliedMessages: e.target.value }))} placeholder="0" /></div>
                <div><Label>Cliques</Label><Input type="number" value={dispForm.clickedMessages} onChange={e => setDispForm(f => ({ ...f, clickedMessages: e.target.value }))} placeholder="0" /></div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!dispForm.redirectionCost && dispForm.redirectionCost !== '0'} onChange={e => setDispForm(f => ({ ...f, redirectionCost: e.target.checked ? (client?.redirection_cost_per_message ? String(client.redirection_cost_per_message) : '') : '' }))} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">Cobrar redirecionamento neste disparo</span>
              </label>
              {dispForm.redirectionCost && dispForm.redirectionCost !== '0' && (
                <div><Label>Valor do Redirecionamento (R$)</Label><Input type="number" step="0.01" value={dispForm.redirectionCost} onChange={e => setDispForm(f => ({ ...f, redirectionCost: e.target.value }))} placeholder="Ex: 50.00" /></div>
              )}
              {!dispForm.redirectionCost && <p className="text-xs text-amber-600 dark:text-amber-400">Sem custo de redirecionamento (ex: disparo de teste/validação).</p>}
            </div>

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

      {/* ═══ DIALOG: Estorno de Cliente ═══ */}
      <Dialog open={clientRefundOpen} onOpenChange={o => { if (!o) { setClientRefundOpen(false); setClientRefundAmount(''); setClientRefundReason(''); setRefundMode('manual'); setRefundSelectedPkgId(''); setRefundManualPrice(''); setRefundManualPlatform('0.20'); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Estornar Mensagens do Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Mode selector */}
            <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
              <button type="button" onClick={() => setRefundMode('manual')} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${refundMode === 'manual' ? 'bg-yellow-600 text-white' : 'bg-transparent text-slate-600 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                Valor Manual
              </button>
              <button type="button" onClick={() => setRefundMode('package')} className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${refundMode === 'package' ? 'bg-yellow-600 text-white' : 'bg-transparent text-slate-600 dark:text-white/50 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                Por Pacote
              </button>
            </div>

            {refundMode === 'package' ? (
              <div>
                <Label>Pacote *</Label>
                <select value={refundSelectedPkgId} onChange={e => setRefundSelectedPkgId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione um pacote</option>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={String(pkg.id)}>
                      {pkg.name} — {fmt(Number(pkg.price_per_message))}/msg
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor por mensagem (R$) *</Label>
                  <Input type="number" step="0.01" value={refundManualPrice} onChange={e => setRefundManualPrice(e.target.value)} placeholder="Ex: 0.30" />
                </div>
                <div>
                  <Label>Custo plataforma/msg (R$)</Label>
                  <Input type="number" step="0.01" value={refundManualPlatform} onChange={e => setRefundManualPlatform(e.target.value)} placeholder="0.20" />
                </div>
              </div>
            )}

            <div>
              <Label>Quantidade de Mensagens *</Label>
              <Input type="number" value={clientRefundAmount} onChange={e => setClientRefundAmount(e.target.value)} placeholder="Ex: 1000" />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Textarea value={clientRefundReason} onChange={e => setClientRefundReason(e.target.value)} rows={2} placeholder="Ex: Base com contatos invalidos" />
            </div>
            {/* Preview */}
            {clientRefundPreview && (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/15 space-y-1.5 text-xs">
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Impacto do Estorno</p>
                <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Mensagens</span><span className="font-medium text-yellow-800 dark:text-yellow-300">{fmtN(clientRefundPreview.msgs)}</span></div>
                <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Valor/msg</span><span>{fmt(clientRefundPreview.price)}</span></div>
                <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Custo plataforma/msg</span><span>{fmt(clientRefundPreview.platform)}</span></div>
                <div className="border-t border-yellow-200 dark:border-yellow-500/15 pt-1.5 mt-1.5 space-y-1">
                  <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Estorno bruto</span><span className="text-red-600 font-semibold">- {fmt(clientRefundPreview.gross)}</span></div>
                  <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Estorno plataforma</span><span className="text-orange-500 font-semibold">- {fmt(clientRefundPreview.platformTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Estorno empresa</span><span className="text-red-600 font-semibold">- {fmt(clientRefundPreview.company)}</span></div>
                  <div className="flex justify-between"><span className="text-yellow-700/70 dark:text-yellow-400/60">Estorno parceiro</span><span className="text-red-600 font-semibold">- {fmt(clientRefundPreview.partner)}</span></div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setClientRefundOpen(false); setClientRefundAmount(''); setClientRefundReason(''); setRefundMode('manual'); setRefundSelectedPkgId(''); setRefundManualPrice(''); setRefundManualPlatform('0.20'); }}>Cancelar</Button>
              <Button onClick={handleClientRefund} disabled={clientRefundSaving || !clientRefundAmount || parseInt(clientRefundAmount) <= 0} className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2">
                {clientRefundSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Aplicar Estorno
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ AlertDialog: Delete Client Refund ═══ */}
      <AlertDialog open={deleteRefundId !== null} onOpenChange={() => setDeleteRefundId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover estorno?</AlertDialogTitle>
            <AlertDialogDescription>O estorno sera removido e os valores serao restaurados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClientRefund} className="bg-red-600 hover:bg-red-700 text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
