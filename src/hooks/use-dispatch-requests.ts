import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DispatchProfile = {
  id: string;
  client_id: number;
  name: string;
  whatsapp_name: string;
  ddd: string;
  profile_photo_url: string | null;
  redirect_numbers: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type DispatchRequestStatus =
  | 'draft'
  | 'submitted'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DispatchRequest = {
  id: string;
  client_id: number;
  profile_id: string | null;
  offer_text: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  media_size_bytes: number | null;
  media_file_name: string | null;
  contact_list_url: string | null;
  contact_file_name: string | null;
  contact_count: number;
  preferred_date: string | null;
  preferred_time: string | null;
  status: DispatchRequestStatus;
  submitted_at: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
  processed_by: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  dispatch_profiles?: DispatchProfile;
  disparo_clients?: { id: number; name: string; company: string | null };
};

export type DispatchAuditLog = {
  id: number;
  request_id: string;
  action: string;
  changed_by: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
};

// ─── Scheduling Rules ──────────────────────────────────────────────────────────

/**
 * Retorna a data/hora mínima permitida para agendamento.
 * - 1º disparo do cliente: 30 horas de antecedência
 * - 2º disparo em diante: 12 horas de antecedência
 */
export async function getMinScheduleDate(clientId: number): Promise<{ minDate: Date; isFirstDispatch: boolean; hoursRequired: number }> {
  // Contar dispatches anteriores concluídos + solicitações já submetidas
  const { count, error } = await supabase
    .from('dispatch_requests')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .in('status', ['submitted', 'queued', 'processing', 'completed']);

  if (error) throw error;

  const isFirstDispatch = (count || 0) === 0;
  const hoursRequired = isFirstDispatch ? 30 : 12;

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + hoursRequired);

  return { minDate, isFirstDispatch, hoursRequired };
}

/**
 * Valida se a data/hora escolhida respeita o prazo mínimo.
 */
export function validateScheduleDate(
  preferredDate: string,
  preferredTime: string,
  minDate: Date
): { valid: boolean; message?: string } {
  const chosen = new Date(`${preferredDate}T${preferredTime}:00`);

  if (chosen < minDate) {
    const formattedMin = minDate.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return {
      valid: false,
      message: `O horário mínimo para agendamento é ${formattedMin}`,
    };
  }

  return { valid: true };
}

// ─── Profiles ──────────────────────────────────────────────────────────────────

export async function getProfilesByClient(clientId: number) {
  const { data, error } = await supabase
    .from('dispatch_profiles')
    .select('*')
    .eq('client_id', clientId)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data || []) as DispatchProfile[];
}

export async function createProfile(input: {
  client_id: number;
  name: string;
  whatsapp_name: string;
  ddd: string;
  profile_photo_url?: string;
  redirect_numbers: string[];
  is_default?: boolean;
}) {
  if (input.is_default) {
    await supabase
      .from('dispatch_profiles')
      .update({ is_default: false })
      .eq('client_id', input.client_id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('dispatch_profiles')
    .insert({
      client_id: input.client_id,
      name: input.name,
      whatsapp_name: input.whatsapp_name,
      ddd: input.ddd,
      profile_photo_url: input.profile_photo_url || null,
      redirect_numbers: input.redirect_numbers,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DispatchProfile;
}

export async function updateProfile(
  id: string,
  input: Partial<{
    name: string;
    whatsapp_name: string;
    ddd: string;
    profile_photo_url: string | null;
    redirect_numbers: string[];
    is_default: boolean;
  }>
) {
  if (input.is_default) {
    const { data: current } = await supabase
      .from('dispatch_profiles')
      .select('client_id')
      .eq('id', id)
      .single();
    if (current) {
      await supabase
        .from('dispatch_profiles')
        .update({ is_default: false })
        .eq('client_id', current.client_id)
        .eq('is_default', true);
    }
  }

  const { error } = await supabase
    .from('dispatch_profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteProfile(id: string) {
  const { error } = await supabase.from('dispatch_profiles').delete().eq('id', id);
  if (error) throw error;
}

// ─── Previous Redirect Numbers (for reuse in new profiles) ─────────────────────

export type PreviousRedirectNumbers = {
  id: string;
  name: string;
  whatsapp_name: string;
  redirect_numbers: string[];
  created_at: string;
};

export async function getPreviousRedirectNumbers(clientId: number, limit = 5): Promise<PreviousRedirectNumbers[]> {
  const { data, error } = await supabase
    .from('dispatch_profiles')
    .select('id, name, whatsapp_name, redirect_numbers, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((p: any) => p.redirect_numbers && p.redirect_numbers.length > 0) as PreviousRedirectNumbers[];
}

// ─── Previous Requests (for reuse) ──────────────────────────────────────────────

export type PreviousRequestSummary = {
  id: string;
  offer_text: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  media_file_name: string | null;
  created_at: string;
  status: DispatchRequestStatus;
};

export async function getPreviousRequests(clientId: number, limit = 5): Promise<PreviousRequestSummary[]> {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .select('id, offer_text, media_url, media_type, media_file_name, created_at, status')
    .eq('client_id', clientId)
    .not('offer_text', 'is', null)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as PreviousRequestSummary[];
}

// ─── Dispatch Requests ─────────────────────────────────────────────────────────

export async function getRequestsByClient(clientId: number) {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .select('*, dispatch_profiles(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DispatchRequest[];
}

export async function getRequestById(id: string) {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .select('*, dispatch_profiles(*), disparo_clients(id, name, company)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as DispatchRequest;
}

export async function createRequest(input: {
  client_id: number;
  profile_id?: string;
  offer_text?: string;
  preferred_date?: string;
  preferred_time?: string;
}) {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .insert({
      client_id: input.client_id,
      profile_id: input.profile_id || null,
      offer_text: input.offer_text || null,
      preferred_date: input.preferred_date || null,
      preferred_time: input.preferred_time || null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data as DispatchRequest;
}

export async function updateRequest(
  id: string,
  input: Partial<{
    profile_id: string;
    offer_text: string;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    media_size_bytes: number | null;
    media_file_name: string | null;
    contact_list_url: string | null;
    contact_file_name: string | null;
    contact_count: number;
    preferred_date: string;
    preferred_time: string;
  }>
) {
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRequest(id: string) {
  const { error } = await supabase.from('dispatch_requests').delete().eq('id', id);
  if (error) throw error;
}

// ─── Submissão e Cancelamento ──────────────────────────────────────────────────

export async function submitRequest(id: string, userEmail: string) {
  const request = await getRequestById(id);

  const missing: string[] = [];
  if (!request.profile_id) missing.push('Perfil WhatsApp');
  if (!request.offer_text) missing.push('Texto da oferta');
  if (!request.contact_list_url) missing.push('Base de contatos');
  if (!request.preferred_date) missing.push('Data preferencial');
  if (!request.preferred_time) missing.push('Horário preferencial');

  if (missing.length > 0) {
    throw new Error(`Campos obrigatórios faltando: ${missing.join(', ')}`);
  }

  // Validar prazo mínimo de agendamento
  const { minDate } = await getMinScheduleDate(request.client_id);
  const validation = validateScheduleDate(request.preferred_date!, request.preferred_time!, minDate);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'draft');

  if (error) throw error;
  await logAudit(id, userEmail, 'submitted', { status: 'draft' }, { status: 'submitted' });
}

export async function cancelRequest(id: string, userEmail: string) {
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'submitted']);
  if (error) throw error;
  await logAudit(id, userEmail, 'cancelled', null, { status: 'cancelled' });
}

// ─── Admin: Fila e Ações ───────────────────────────────────────────────────────

export async function getQueue(filters?: {
  status?: DispatchRequestStatus;
  clientId?: number;
}) {
  let query = supabase
    .from('dispatch_requests')
    .select('*, dispatch_profiles(*), disparo_clients(id, name, company)')
    .order('submitted_at', { ascending: true });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.in('status', ['submitted', 'queued', 'processing']);
  }
  if (filters?.clientId) query = query.eq('client_id', filters.clientId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DispatchRequest[];
}

export async function getAllRequests(filters?: {
  status?: DispatchRequestStatus;
  clientId?: number;
}) {
  let query = supabase
    .from('dispatch_requests')
    .select('*, dispatch_profiles(*), disparo_clients(id, name, company)')
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.clientId) query = query.eq('client_id', filters.clientId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DispatchRequest[];
}

export async function startProcessing(id: string, adminEmail: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'processing', processing_started_at: now, processed_by: adminEmail, updated_at: now })
    .eq('id', id)
    .in('status', ['submitted', 'queued']);
  if (error) throw error;
  await logAudit(id, adminEmail, 'processing_started', null, { status: 'processing' });
}

export async function completeRequest(id: string, adminEmail: string, notes?: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'completed', completed_at: now, admin_notes: notes || null, updated_at: now })
    .eq('id', id)
    .eq('status', 'processing');
  if (error) throw error;
  await logAudit(id, adminEmail, 'completed', null, { status: 'completed', admin_notes: notes });
}

export async function failRequest(id: string, adminEmail: string, notes: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'failed', completed_at: now, admin_notes: notes, updated_at: now })
    .eq('id', id)
    .eq('status', 'processing');
  if (error) throw error;
  await logAudit(id, adminEmail, 'failed', null, { status: 'failed', admin_notes: notes });
}

export async function resubmitRequest(id: string, userEmail: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('dispatch_requests')
    .update({ status: 'submitted', submitted_at: now, processing_started_at: null, completed_at: null, processed_by: null, admin_notes: null, updated_at: now })
    .eq('id', id)
    .in('status', ['failed', 'cancelled']);
  if (error) throw error;
  await logAudit(id, userEmail, 'resubmitted', null, { status: 'submitted' });
}

// ─── Stats ──────────────────────────────────────────────────────────────────────

export async function getRequestStats(clientId?: number) {
  let query = supabase.from('dispatch_requests').select('status');
  if (clientId) query = query.eq('client_id', clientId);

  const { data, error } = await query;
  if (error) throw error;

  const stats = { total: data.length, draft: 0, submitted: 0, queued: 0, processing: 0, completed: 0, failed: 0, cancelled: 0, pending: 0 };
  for (const row of data) {
    const s = row.status as DispatchRequestStatus;
    if (s in stats) (stats as any)[s]++;
  }
  stats.pending = stats.submitted + stats.queued;
  return stats;
}

// ─── File Upload ────────────────────────────────────────────────────────────────

export async function uploadProfilePhoto(file: File, clientId: number) {
  const ext = file.name.split('.').pop();
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('dispatch-profile-photos').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('dispatch-profile-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMedia(file: File, clientId: number) {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) throw new Error('Formato não suportado. Use imagem ou vídeo.');

  const maxSize = isVideo ? 13 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) throw new Error(`Arquivo excede o limite de ${isVideo ? '13MB' : '5MB'}.`);

  const ext = file.name.split('.').pop();
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('dispatch-media').upload(path, file, { upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('dispatch-media').getPublicUrl(path);
  return { url: data.publicUrl, type: (isVideo ? 'video' : 'image') as 'image' | 'video', size: file.size, name: file.name };
}

export async function uploadContactList(file: File, clientId: number) {
  if (!file.name.match(/\.(xlsx?|csv)$/i)) throw new Error('Formato deve ser .xlsx, .xls ou .csv');

  const ext = file.name.split('.').pop();
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('dispatch-contacts').upload(path, file, { upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from('dispatch-contacts').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}

// ─── Audit Log ──────────────────────────────────────────────────────────────────

async function logAudit(requestId: string, changedBy: string, action: string, oldValues: Record<string, any> | null, newValues: Record<string, any> | null) {
  await supabase.from('dispatch_request_audit_log').insert({ request_id: requestId, action, changed_by: changedBy, old_values: oldValues, new_values: newValues });
}

export async function getAuditLog(requestId: string) {
  const { data, error } = await supabase
    .from('dispatch_request_audit_log')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DispatchAuditLog[];
}

export async function getQueuePosition(requestId: string): Promise<number> {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .select('id')
    .in('status', ['submitted', 'queued'])
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  const index = (data || []).findIndex((r) => r.id === requestId);
  return index >= 0 ? index + 1 : 0;
}

// ─── Client Auth Helper ────────────────────────────────────────────────────────

export async function getClientIdForUser(userId: string): Promise<number | null> {
  // Primeiro tenta pela tabela profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.client_id) return profile.client_id;

  // Fallback: tabela user_clients
  const { data: uc } = await supabase
    .from('user_clients')
    .select('client_id')
    .eq('user_id', userId)
    .maybeSingle();

  return uc?.client_id || null;
}
