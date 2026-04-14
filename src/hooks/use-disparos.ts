import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DisparoClient = {
  id: number; name: string; company: string | null; email: string | null;
  phone: string | null; notes: string | null; is_active: boolean;
  status: 'ativo' | 'pausado' | 'encerrado'; segment: string | null;
  created_at: string; updated_at: string;
};

export type DisparoPackage = {
  id: number; client_id: number; name: string; contracted_messages: number;
  price_per_message: number; platform_cost_per_message: number; notes: string | null;
  is_active: boolean; refunded_messages: number; refunded_at: string | null;
  purchase_date: string | null;
  created_at: string; updated_at: string;
};

export type DisparoDispatch = {
  id: number; package_id: number; client_id: number; name: string;
  dispatch_date: string; sent_messages: number; delivered_messages: number;
  read_messages: number; replied_messages: number; clicked_messages: number;
  redirection_cost: number | null; notes: string | null;
  contact_file_url: string | null; contact_file_name: string | null;
  contact_count: number | null; redirect_numbers: string[];
  created_at: string; updated_at: string;
};

export type DisparoResult = {
  id: number; dispatch_id: number; leads_count: number | null;
  sales_count: number | null; revenue: number | null; notes: string | null;
  created_at: string; updated_at: string;
};

export type DisparoActivityLog = {
  id: number; user_email: string; action: string; entity_type: string;
  entity_id: number; entity_name: string | null; details: Record<string, any>;
  created_at: string;
};

// ─── Clients ───────────────────────────────────────────────────────────────────

export async function getDisparoClients(status?: string) {
  let query = supabase.from('disparo_clients').select('*').eq('is_active', true).order('name');
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DisparoClient[];
}

export async function getDisparoClientById(id: number) {
  const { data, error } = await supabase.from('disparo_clients').select('*').eq('id', id).single();
  if (error) throw error;
  return data as DisparoClient;
}

export async function createDisparoClient(input: { name: string; company?: string; email?: string; phone?: string; notes?: string; status?: string; segment?: string }) {
  const { error } = await supabase.from('disparo_clients').insert({
    name: input.name, company: input.company || null, email: input.email || null,
    phone: input.phone || null, notes: input.notes || null, status: input.status || 'ativo',
    segment: input.segment || null,
  });
  if (error) throw error;
}

export async function updateDisparoClient(id: number, input: Partial<{ name: string; company: string | null; email: string | null; phone: string | null; notes: string | null; status: string }>) {
  const { error } = await supabase.from('disparo_clients').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteDisparoClient(id: number) {
  const { error } = await supabase.from('disparo_clients').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// ─── Packages ──────────────────────────────────────────────────────────────────

export async function getPackagesByClient(clientId: number) {
  const { data, error } = await supabase.from('disparo_packages').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DisparoPackage[];
}

export async function createPackage(input: { client_id: number; name: string; contracted_messages: number; price_per_message: number; platform_cost_per_message?: number; notes?: string; purchase_date?: string }) {
  const { error } = await supabase.from('disparo_packages').insert({
    client_id: input.client_id, name: input.name, contracted_messages: input.contracted_messages,
    price_per_message: input.price_per_message, platform_cost_per_message: input.platform_cost_per_message ?? 0.2,
    notes: input.notes || null, purchase_date: input.purchase_date ? `${input.purchase_date}T12:00:00` : null,
  });
  if (error) throw error;
}

export async function updatePackage(id: number, input: Partial<DisparoPackage>) {
  const { error } = await supabase.from('disparo_packages').update(input).eq('id', id);
  if (error) throw error;
}

export async function deletePackage(id: number) {
  const { error } = await supabase.from('disparo_packages').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function refundPackageMessages(packageId: number, messagesToRefund: number) {
  const balance = await getPackageBalance(packageId);
  if (!balance) throw new Error('Pacote não encontrado');
  if (messagesToRefund > balance.balance) throw new Error(`Não é possível estornar ${messagesToRefund}. Saldo: ${balance.balance}`);
  const newRefunded = balance.refundedMessages + messagesToRefund;
  const { error } = await supabase.from('disparo_packages').update({ refunded_messages: newRefunded, refunded_at: new Date().toISOString() }).eq('id', packageId);
  if (error) throw error;
}

export async function getPackageBalance(packageId: number) {
  const { data: pkg } = await supabase.from('disparo_packages').select('*').eq('id', packageId).single();
  if (!pkg) return null;
  const { data: disps } = await supabase.from('disparo_dispatches').select('delivered_messages').eq('package_id', packageId);
  const totalDelivered = (disps || []).reduce((s, d) => s + d.delivered_messages, 0);
  const refunded = pkg.refunded_messages || 0;
  const billable = pkg.contracted_messages - refunded;
  const balance = billable - totalDelivered;
  const price = Number(pkg.price_per_message);
  const platform = Number(pkg.platform_cost_per_message);
  return {
    contractedMessages: pkg.contracted_messages, refundedMessages: refunded, billableMessages: billable,
    totalDelivered, balance, pricePerMessage: price, platformCostPerMessage: platform,
    grossRevenue: price * billable, platformCost: platform * billable,
    netRevenue: (price - platform) * billable, companyRevenue: ((price - platform) * billable) / 2,
    partnerRevenue: ((price - platform) * billable) / 2, refundedAt: pkg.refunded_at,
  };
}

// ─── Dispatches ────────────────────────────────────────────────────────────────

export async function getDispatchesByClient(clientId: number) {
  const { data, error } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId).order('dispatch_date', { ascending: false });
  if (error) throw error;
  return (data || []) as DisparoDispatch[];
}

export async function getDispatchesByPackage(packageId: number) {
  const { data, error } = await supabase.from('disparo_dispatches').select('*').eq('package_id', packageId).order('dispatch_date', { ascending: false });
  if (error) throw error;
  return (data || []) as DisparoDispatch[];
}

export async function getDispatchesByClientFiltered(clientId: number, startDate?: string, endDate?: string) {
  let query = supabase.from('disparo_dispatches').select('*').eq('client_id', clientId);
  if (startDate) query = query.gte('dispatch_date', startDate);
  if (endDate) query = query.lte('dispatch_date', endDate);
  const { data, error } = await query.order('dispatch_date', { ascending: false });
  if (error) throw error;
  return (data || []) as DisparoDispatch[];
}

export async function uploadDispatchFile(file: File, clientId: number): Promise<{ url: string; fileName: string }> {
  const ext = file.name.split('.').pop();
  const path = `client-${clientId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('disparo-files').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('disparo-files').getPublicUrl(path);
  return { url: data.publicUrl, fileName: file.name };
}

export async function deleteDispatchFile(fileUrl: string) {
  const path = fileUrl.split('/disparo-files/')[1];
  if (path) {
    await supabase.storage.from('disparo-files').remove([path]);
  }
}

export async function createDispatch(input: {
  package_id: number; client_id: number; name: string; dispatch_date: string;
  sent_messages: number; delivered_messages: number; redirection_cost?: number; notes?: string;
  contact_file_url?: string; contact_file_name?: string; contact_count?: number; redirect_numbers?: string[];
  read_messages?: number; replied_messages?: number; clicked_messages?: number;
}) {
  const { error } = await supabase.from('disparo_dispatches').insert({
    package_id: input.package_id, client_id: input.client_id, name: input.name,
    dispatch_date: input.dispatch_date.includes('T') ? input.dispatch_date : `${input.dispatch_date}T12:00:00`, sent_messages: input.sent_messages,
    delivered_messages: input.delivered_messages,
    read_messages: input.read_messages ?? 0, replied_messages: input.replied_messages ?? 0, clicked_messages: input.clicked_messages ?? 0,
    redirection_cost: input.redirection_cost ?? null, notes: input.notes || null,
    contact_file_url: input.contact_file_url || null, contact_file_name: input.contact_file_name || null,
    contact_count: input.contact_count ?? null, redirect_numbers: input.redirect_numbers || [],
  });
  if (error) throw error;
}

export async function updateDispatch(id: number, input: Partial<DisparoDispatch>) {
  const data = { ...input };
  if (data.dispatch_date && !data.dispatch_date.includes('T')) {
    data.dispatch_date = `${data.dispatch_date}T12:00:00`;
  }
  const { error } = await supabase.from('disparo_dispatches').update(data).eq('id', id);
  if (error) throw error;
}

export async function deleteDispatch(id: number) {
  const { error } = await supabase.from('disparo_dispatches').delete().eq('id', id);
  if (error) throw error;
}

// ─── Results ───────────────────────────────────────────────────────────────────

export async function getResultByDispatch(dispatchId: number) {
  const { data } = await supabase.from('disparo_results').select('*').eq('dispatch_id', dispatchId).maybeSingle();
  return data as DisparoResult | null;
}

export async function upsertDispatchResult(input: { dispatch_id: number; leads_count?: number | null; sales_count?: number | null; revenue?: number | null; notes?: string | null }) {
  const existing = await getResultByDispatch(input.dispatch_id);
  if (existing) {
    const { error } = await supabase.from('disparo_results').update({
      leads_count: input.leads_count ?? null, sales_count: input.sales_count ?? null,
      revenue: input.revenue ?? null, notes: input.notes ?? null,
    }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('disparo_results').insert({
      dispatch_id: input.dispatch_id, leads_count: input.leads_count ?? null,
      sales_count: input.sales_count ?? null, revenue: input.revenue ?? null, notes: input.notes ?? null,
    });
    if (error) throw error;
  }
}

// ─── Dashboard Stats ───────────────────────────────────────────────────────────

export async function getDashboardStats(startDate?: string, endDate?: string) {
  const { data: clients } = await supabase.from('disparo_clients').select('id').eq('is_active', true);
  const { data: pkgs } = await supabase.from('disparo_packages').select('*').eq('is_active', true);

  let dispQuery = supabase.from('disparo_dispatches').select('*');
  if (startDate) dispQuery = dispQuery.gte('dispatch_date', startDate);
  if (endDate) dispQuery = dispQuery.lte('dispatch_date', endDate);
  const { data: disps } = await dispQuery;

  const allDisps = disps || [];
  const allPkgs = pkgs || [];

  const totalSent = allDisps.reduce((s, d) => s + d.sent_messages, 0);
  const totalDelivered = allDisps.reduce((s, d) => s + d.delivered_messages, 0);

  // Revenue based on packages (prepaid model)
  let totalGross = 0, totalPlatformCost = 0, totalCompany = 0, totalPartner = 0;
  let totalContracted = 0, totalBalance = 0;

  for (const pkg of allPkgs) {
    const price = Number(pkg.price_per_message);
    const platform = Number(pkg.platform_cost_per_message);
    const refunded = pkg.refunded_messages || 0;
    const billable = pkg.contracted_messages - refunded;
    totalGross += price * billable;
    totalPlatformCost += platform * billable;
    const net = (price - platform) * billable;
    totalCompany += net / 2;
    totalPartner += net / 2;
    totalContracted += pkg.contracted_messages;

    const pkgDisps = allDisps.filter(d => d.package_id === pkg.id);
    const pkgDelivered = pkgDisps.reduce((s: number, d: any) => s + d.delivered_messages, 0);
    totalBalance += billable - pkgDelivered;
  }

  return {
    clientsCount: (clients || []).length,
    packagesCount: allPkgs.length,
    totalDispatches: allDisps.length,
    totalSent, totalDelivered, totalContracted, totalBalance,
    totalGrossRevenue: totalGross, totalPlatformCost,
    totalCompanyRevenue: totalCompany, totalPartnerRevenue: totalPartner,
  };
}

export async function getClientStats(clientId: number) {
  const { data: pkgs } = await supabase.from('disparo_packages').select('*').eq('client_id', clientId).eq('is_active', true);
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId);

  const allPkgs = pkgs || [];
  const allDisps = disps || [];

  let totalContracted = 0, totalDelivered = 0;
  let totalGross = 0, totalPlatformCost = 0, totalCompany = 0, totalPartner = 0;

  for (const pkg of allPkgs) {
    const price = Number(pkg.price_per_message);
    const platform = Number(pkg.platform_cost_per_message);
    const refunded = pkg.refunded_messages || 0;
    const billable = pkg.contracted_messages - refunded;
    const pkgDelivered = allDisps.filter(d => d.package_id === pkg.id).reduce((s: number, d: any) => s + d.delivered_messages, 0);
    totalContracted += pkg.contracted_messages;
    totalDelivered += pkgDelivered;
    totalGross += price * billable;
    totalPlatformCost += platform * billable;
    const net = (price - platform) * billable;
    totalCompany += net / 2;
    totalPartner += net / 2;
  }

  return {
    totalContracted, totalDelivered, totalBalance: totalContracted - totalDelivered,
    totalGrossRevenue: totalGross, totalPlatformCost,
    totalCompanyRevenue: totalCompany, totalPartnerRevenue: totalPartner,
    totalDispatches: allDisps.length,
  };
}

export async function getAllClientsOverview() {
  const { data: clients } = await supabase.from('disparo_clients').select('*').eq('is_active', true).order('name');
  const overview: Array<{
    clientId: number; clientName: string; clientCompany: string | null; status: string;
    totalContracted: number; totalRefunded: number; totalBillable: number; totalDelivered: number; totalSent: number;
    totalBalance: number; totalDispatches: number; deliveryRate: number;
    grossRevenue: number; platformCost: number; netRevenue: number; companyRevenue: number; partnerRevenue: number;
  }> = [];

  for (const client of clients || []) {
    const { data: pkgs } = await supabase.from('disparo_packages').select('*').eq('client_id', client.id).eq('is_active', true);
    const { data: disps } = await supabase.from('disparo_dispatches').select('sent_messages, delivered_messages, package_id').eq('client_id', client.id);

    const allPkgs = pkgs || [];
    const allDisps = disps || [];

    let totalContracted = 0, totalRefunded = 0, totalBillable = 0, totalDelivered = 0, totalSent = 0;
    let grossRevenue = 0, platformCost = 0, netRevenue = 0;

    for (const pkg of allPkgs) {
      const price = Number(pkg.price_per_message);
      const platform = Number(pkg.platform_cost_per_message);
      const refunded = pkg.refunded_messages || 0;
      const billable = pkg.contracted_messages - refunded;
      const pkgDisps = allDisps.filter(d => d.package_id === pkg.id);
      const pkgDelivered = pkgDisps.reduce((s: number, d: any) => s + d.delivered_messages, 0);
      const pkgSent = pkgDisps.reduce((s: number, d: any) => s + d.sent_messages, 0);

      totalContracted += pkg.contracted_messages;
      totalRefunded += refunded;
      totalBillable += billable;
      totalDelivered += pkgDelivered;
      totalSent += pkgSent;
      grossRevenue += price * billable;
      platformCost += platform * billable;
      netRevenue += (price - platform) * billable;
    }

    overview.push({
      clientId: client.id, clientName: client.name, clientCompany: client.company, status: client.status,
      totalContracted, totalRefunded, totalBillable, totalDelivered, totalSent,
      totalBalance: totalBillable - totalDelivered, totalDispatches: allDisps.length,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      grossRevenue, platformCost, netRevenue, companyRevenue: netRevenue / 2, partnerRevenue: netRevenue / 2,
    });
  }

  return overview;
}

export async function getClientsWithLowBalance(threshold = 5000) {
  const { data: clients } = await supabase.from('disparo_clients').select('*').eq('is_active', true);
  const alerts: Array<{ clientId: number; clientName: string; clientCompany: string | null; totalBalance: number; totalContracted: number }> = [];

  for (const client of clients || []) {
    const { data: pkgs } = await supabase.from('disparo_packages').select('*').eq('client_id', client.id).eq('is_active', true);
    let totalContracted = 0, totalDelivered = 0;
    for (const pkg of pkgs || []) {
      totalContracted += pkg.contracted_messages;
      const { data: disps } = await supabase.from('disparo_dispatches').select('delivered_messages').eq('package_id', pkg.id);
      totalDelivered += (disps || []).reduce((s: number, d: any) => s + d.delivered_messages, 0);
    }
    const balance = totalContracted - totalDelivered;
    if (totalContracted > 0 && balance < threshold) {
      alerts.push({ clientId: client.id, clientName: client.name, clientCompany: client.company, totalBalance: balance, totalContracted });
    }
  }
  return alerts;
}

export async function getDispatchResultsForChart(clientId: number) {
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId).order('dispatch_date');
  const rows = [];
  for (const d of disps || []) {
    const result = await getResultByDispatch(d.id);
    rows.push({
      dispatchId: d.id, name: d.name, date: d.dispatch_date,
      delivered: d.delivered_messages, leads: result?.leads_count || 0,
      sales: result?.sales_count || 0, revenue: Number(result?.revenue || 0),
    });
  }
  return rows;
}

// ─── Activity Logs ──────────────────────────────────────────────────────────────

export async function logActivity(input: { user_email: string; action: string; entity_type: string; entity_id: number; entity_name?: string; details?: Record<string, any> }) {
  await supabase.from('disparo_activity_logs').insert({
    user_email: input.user_email, action: input.action, entity_type: input.entity_type,
    entity_id: input.entity_id, entity_name: input.entity_name || null,
    details: input.details || {},
  });
}

export async function getActivityLogs(opts?: { entity_type?: string; entity_id?: number; limit?: number }) {
  let query = supabase.from('disparo_activity_logs').select('*').order('created_at', { ascending: false });
  if (opts?.entity_type) query = query.eq('entity_type', opts.entity_type);
  if (opts?.entity_id) query = query.eq('entity_id', opts.entity_id);
  query = query.limit(opts?.limit || 50);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DisparoActivityLog[];
}

// ─── ROI & Analytics ────────────────────────────────────────────────────────────

export async function getClientROIMetrics(clientId: number) {
  const { data: pkgs } = await supabase.from('disparo_packages').select('*').eq('client_id', clientId).eq('is_active', true);
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId);

  const allPkgs = pkgs || [];
  const allDisps = disps || [];

  // Get all results for this client's dispatches
  let totalLeads = 0, totalSales = 0, totalRevenue = 0;
  let totalInvestment = 0;
  let totalRead = 0, totalReplied = 0, totalClicked = 0;
  let totalSent = 0, totalDelivered = 0;

  for (const d of allDisps) {
    const result = await getResultByDispatch(d.id);
    totalLeads += result?.leads_count || 0;
    totalSales += result?.sales_count || 0;
    totalRevenue += Number(result?.revenue || 0);
    totalRead += d.read_messages || 0;
    totalReplied += d.replied_messages || 0;
    totalClicked += d.clicked_messages || 0;
    totalSent += d.sent_messages;
    totalDelivered += d.delivered_messages;
  }

  for (const pkg of allPkgs) {
    const refunded = pkg.refunded_messages || 0;
    const billable = pkg.contracted_messages - refunded;
    totalInvestment += Number(pkg.price_per_message) * billable;
  }

  const costPerLead = totalLeads > 0 ? totalInvestment / totalLeads : 0;
  const costPerSale = totalSales > 0 ? totalInvestment / totalSales : 0;
  const roi = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : 0;

  return {
    totalLeads, totalSales, totalRevenue, totalInvestment,
    costPerLead, costPerSale, roi,
    totalSent, totalDelivered, totalRead, totalReplied, totalClicked,
    deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
    readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
    replyRate: totalDelivered > 0 ? (totalReplied / totalDelivered) * 100 : 0,
    clickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
    leadConversionRate: totalDelivered > 0 ? (totalLeads / totalDelivered) * 100 : 0,
    saleConversionRate: totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0,
  };
}

export async function getClientMonthlyTrends(clientId: number) {
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId).order('dispatch_date');
  const months: Record<string, { month: string; sent: number; delivered: number; read: number; replied: number; clicked: number; leads: number; sales: number; revenue: number; dispatches: number }> = {};

  for (const d of disps || []) {
    const monthKey = d.dispatch_date.substring(0, 7); // YYYY-MM
    if (!months[monthKey]) {
      months[monthKey] = { month: monthKey, sent: 0, delivered: 0, read: 0, replied: 0, clicked: 0, leads: 0, sales: 0, revenue: 0, dispatches: 0 };
    }
    months[monthKey].sent += d.sent_messages;
    months[monthKey].delivered += d.delivered_messages;
    months[monthKey].read += d.read_messages || 0;
    months[monthKey].replied += d.replied_messages || 0;
    months[monthKey].clicked += d.clicked_messages || 0;
    months[monthKey].dispatches += 1;

    const result = await getResultByDispatch(d.id);
    months[monthKey].leads += result?.leads_count || 0;
    months[monthKey].sales += result?.sales_count || 0;
    months[monthKey].revenue += Number(result?.revenue || 0);
  }

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

export async function getSLAAlerts() {
  const { data: pkgs } = await supabase.from('disparo_packages').select('*, disparo_clients(name, company)').eq('is_active', true);
  const alerts: Array<{ type: string; clientName: string; clientId: number; packageName: string; packageId: number; message: string; severity: 'warning' | 'danger'; daysSince: number }> = [];

  for (const pkg of pkgs || []) {
    const { data: disps } = await supabase.from('disparo_dispatches').select('dispatch_date').eq('package_id', pkg.id).order('dispatch_date', { ascending: false }).limit(1);

    const lastDispatch = disps?.[0];
    const clientInfo = (pkg as any).disparo_clients;

    if (!lastDispatch) {
      // Package with no dispatches
      const daysSinceCreation = Math.floor((Date.now() - new Date(pkg.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation > 3) {
        alerts.push({
          type: 'no_dispatch', clientName: clientInfo?.name || 'N/A', clientId: pkg.client_id,
          packageName: pkg.name, packageId: pkg.id,
          message: `Pacote criado há ${daysSinceCreation} dias sem nenhum disparo`,
          severity: daysSinceCreation > 7 ? 'danger' : 'warning', daysSince: daysSinceCreation,
        });
      }
    } else {
      const daysSinceLast = Math.floor((Date.now() - new Date(lastDispatch.dispatch_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLast > 5) {
        alerts.push({
          type: 'inactive_package', clientName: clientInfo?.name || 'N/A', clientId: pkg.client_id,
          packageName: pkg.name, packageId: pkg.id,
          message: `Último disparo há ${daysSinceLast} dias`,
          severity: daysSinceLast > 10 ? 'danger' : 'warning', daysSince: daysSinceLast,
        });
      }
    }
  }

  return alerts.sort((a, b) => b.daysSince - a.daysSince);
}

// ─── Enhanced Charts & Portal ───────────────────────────────────────────────────

export async function getDispatchResultsForChartEnhanced(clientId: number) {
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId).order('dispatch_date');
  const rows = [];
  for (const d of disps || []) {
    const result = await getResultByDispatch(d.id);
    rows.push({
      dispatchId: d.id, name: d.name, date: d.dispatch_date,
      sent: d.sent_messages, delivered: d.delivered_messages,
      read: d.read_messages || 0, replied: d.replied_messages || 0, clicked: d.clicked_messages || 0,
      leads: result?.leads_count || 0, sales: result?.sales_count || 0,
      revenue: Number(result?.revenue || 0),
    });
  }
  return rows;
}

export async function getClientPortalData(clientId: number) {
  const { data: client } = await supabase.from('disparo_clients').select('id, name, company').eq('id', clientId).single();
  if (!client) return null;

  const { data: pkgs } = await supabase.from('disparo_packages').select('id, name, contracted_messages, is_active, refunded_messages, created_at').eq('client_id', clientId).eq('is_active', true);
  const { data: disps } = await supabase.from('disparo_dispatches').select('*').eq('client_id', clientId).order('dispatch_date', { ascending: false });

  let totalContracted = 0, totalDelivered = 0, totalSent = 0;
  let totalRead = 0, totalReplied = 0, totalClicked = 0;
  let totalLeads = 0, totalSales = 0, totalRevenue = 0;

  for (const pkg of pkgs || []) {
    const refunded = pkg.refunded_messages || 0;
    totalContracted += pkg.contracted_messages - refunded;
  }

  const dispatchDetails = [];
  for (const d of disps || []) {
    totalSent += d.sent_messages;
    totalDelivered += d.delivered_messages;
    totalRead += d.read_messages || 0;
    totalReplied += d.replied_messages || 0;
    totalClicked += d.clicked_messages || 0;

    const result = await getResultByDispatch(d.id);
    const leads = result?.leads_count || 0;
    const sales = result?.sales_count || 0;
    const revenue = Number(result?.revenue || 0);
    totalLeads += leads;
    totalSales += sales;
    totalRevenue += revenue;

    dispatchDetails.push({
      id: d.id, name: d.name, date: d.dispatch_date,
      sent: d.sent_messages, delivered: d.delivered_messages,
      read: d.read_messages || 0, replied: d.replied_messages || 0,
      clicked: d.clicked_messages || 0,
      leads, sales, revenue,
    });
  }

  return {
    client: { id: client.id, name: client.name, company: client.company },
    packages: (pkgs || []).map(p => ({ id: p.id, name: p.name, contracted: p.contracted_messages - (p.refunded_messages || 0) })),
    summary: {
      totalContracted, totalSent, totalDelivered, totalBalance: totalContracted - totalDelivered,
      totalRead, totalReplied, totalClicked,
      totalLeads, totalSales, totalRevenue,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
      replyRate: totalDelivered > 0 ? (totalReplied / totalDelivered) * 100 : 0,
      clickRate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
    },
    dispatches: dispatchDetails,
  };
}
