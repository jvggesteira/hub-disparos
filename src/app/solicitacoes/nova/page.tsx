'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/custom/sidebar';
import { Header } from '@/components/custom/header';
import { useAuth } from '@/hooks/use-auth';
import {
  ArrowLeft, ArrowRight, Check, Upload, X, Plus,
  Loader2, Image, Video, FileSpreadsheet, User,
  Calendar, Clock, MessageSquare, Trash2, Star, Send, AlertTriangle, Info,
} from 'lucide-react';
import {
  createRequest, updateRequest, submitRequest,
  getProfilesByClient, createProfile, uploadMedia,
  uploadContactList, uploadProfilePhoto, getClientIdForUser,
  getMinScheduleDate, validateScheduleDate,
  type DispatchProfile,
} from '@/hooks/use-dispatch-requests';

const STEPS = [
  { id: 'profile', label: 'Perfil WhatsApp', icon: MessageSquare },
  { id: 'offer', label: 'Oferta', icon: FileSpreadsheet },
  { id: 'contacts', label: 'Base', icon: Upload },
  { id: 'schedule', label: 'Agendamento', icon: Calendar },
  { id: 'review', label: 'Revisão', icon: Check },
];

export default function NovaSolicitacaoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  // Profiles
  const [profiles, setProfiles] = useState<DispatchProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', whatsapp_name: '', ddd: '11', redirect_numbers: [''], is_default: false });
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);

  // Offer
  const [offerText, setOfferText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<{ url: string; type: 'image' | 'video'; size: number; name: string } | null>(null);

  // Contacts
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactInfo, setContactInfo] = useState<{ url: string; name: string } | null>(null);
  const [contactCount, setContactCount] = useState(0);

  // Schedule
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [scheduleInfo, setScheduleInfo] = useState<{ minDate: Date; isFirstDispatch: boolean; hoursRequired: number } | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Toast notification (substitui alert())
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Resolver client_id
  useEffect(() => {
    if (!user) return;
    setLoadingClient(true);
    getClientIdForUser(user.id).then((id) => {
      setClientId(id);
      setLoadingClient(false);
    }).catch(() => setLoadingClient(false));
  }, [user]);

  // Load profiles when client is known
  useEffect(() => {
    if (!clientId) return;
    getProfilesByClient(clientId).then((p) => {
      setProfiles(p);
      const def = p.find((pr) => pr.is_default);
      if (def && !selectedProfileId) setSelectedProfileId(def.id);
    }).catch(console.error);
  }, [clientId]);

  // Load schedule rules when client is known + recalcula ao entrar no step 3
  useEffect(() => {
    if (!clientId) return;
    getMinScheduleDate(clientId).then(setScheduleInfo).catch(console.error);
  }, [clientId, step]);

  // Validate schedule when date/time changes
  useEffect(() => {
    if (!preferredDate || !preferredTime || !scheduleInfo) {
      setScheduleError(null);
      return;
    }
    const result = validateScheduleDate(preferredDate, preferredTime, scheduleInfo.minDate);
    setScheduleError(result.valid ? null : result.message || null);
  }, [preferredDate, preferredTime, scheduleInfo]);

  // Previews
  useEffect(() => {
    if (profilePhotoFile) {
      const url = URL.createObjectURL(profilePhotoFile);
      setProfilePhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setProfilePhotoPreview(null);
  }, [profilePhotoFile]);

  useEffect(() => {
    if (mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setMediaPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setMediaPreview(null);
  }, [mediaFile]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  const canAdvance = () => {
    switch (step) {
      case 0: return !!selectedProfileId;
      case 1: return offerText.trim().length >= 10;
      case 2: return !!contactInfo;
      case 3: return !!preferredDate && !!preferredTime && !scheduleError;
      case 4: return true;
      default: return false;
    }
  };

  const saveDraft = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      if (!requestId) {
        const req = await createRequest({
          client_id: clientId,
          profile_id: selectedProfileId || undefined,
          offer_text: offerText || undefined,
          preferred_date: preferredDate || undefined,
          preferred_time: preferredTime || undefined,
        });
        setRequestId(req.id);
      } else {
        await updateRequest(requestId, {
          profile_id: selectedProfileId || undefined,
          offer_text: offerText || undefined,
          media_url: mediaInfo?.url || null,
          media_type: mediaInfo?.type || null,
          media_size_bytes: mediaInfo?.size || null,
          media_file_name: mediaInfo?.name || null,
          contact_list_url: contactInfo?.url || null,
          contact_file_name: contactInfo?.name || null,
          contact_count: contactCount,
          preferred_date: preferredDate || undefined,
          preferred_time: preferredTime || undefined,
        });
      }
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => { await saveDraft(); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const handleBack = () => { setStep((s) => Math.max(s - 1, 0)); };

  const handleCreateProfile = async () => {
    if (!clientId) return;
    if (!newProfile.name || !newProfile.whatsapp_name || !newProfile.ddd) { setToast({ type: 'error', message: 'Preencha todos os campos obrigatórios do perfil.' }); return; }
    const validNumbers = newProfile.redirect_numbers.filter((n) => n.trim());
    if (validNumbers.length === 0) { setToast({ type: 'error', message: 'Adicione pelo menos um número de redirecionamento.' }); return; }
    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (profilePhotoFile) photoUrl = await uploadProfilePhoto(profilePhotoFile, clientId);
      const profile = await createProfile({ client_id: clientId, name: newProfile.name, whatsapp_name: newProfile.whatsapp_name, ddd: newProfile.ddd, profile_photo_url: photoUrl, redirect_numbers: validNumbers, is_default: newProfile.is_default });
      setProfiles((prev) => [...prev, profile]);
      setSelectedProfileId(profile.id);
      setShowNewProfile(false);
      setNewProfile({ name: '', whatsapp_name: '', ddd: '', redirect_numbers: [''], is_default: false });
      setProfilePhotoFile(null);
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setSaving(false); }
  };

  const handleMediaUpload = async (file: File) => {
    if (!clientId) return;
    setMediaFile(file);
    setSaving(true);
    try { const info = await uploadMedia(file, clientId); setMediaInfo(info); } catch (err: any) { setToast({ type: 'error', message: err.message }); setMediaFile(null); } finally { setSaving(false); }
  };

  const handleContactUpload = async (file: File) => {
    if (!clientId) return;
    setContactFile(file);
    setSaving(true);
    try { const info = await uploadContactList(file, clientId); setContactInfo(info); } catch (err: any) { setToast({ type: 'error', message: err.message }); setContactFile(null); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!requestId) { setToast({ type: 'error', message: 'Erro: solicitação não foi salva ainda.' }); return; }
    setSubmitting(true);
    try {
      await saveDraft();
      await submitRequest(requestId, user?.email || '');
      router.push('/solicitacoes');
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setSubmitting(false); }
  };

  // Loading / No client
  if (loadingClient) {
    return (
      <div className="flex h-screen bg-[#0a0118]">
        <Sidebar /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex h-screen bg-[#0a0118]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/40">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-medium">Conta não vinculada</p>
              <p className="text-sm mt-1">Entre em contato com o administrador para vincular sua conta.</p>
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
          {/* Toast Notification */}
          {toast && (
            <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all animate-in slide-in-from-top-2 ${toast.type === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'}`}>
              {toast.type === 'error' ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <Check className="h-4 w-4 flex-shrink-0" />}
              <p className="text-sm">{toast.message}</p>
              <button onClick={() => setToast(null)} className="p-1 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* Stepper */}
          <div className="flex items-center justify-center mb-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.id} className="flex items-center">
                  <button onClick={() => { if (i < step) { saveDraft(); setStep(i); } }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : isDone ? 'text-emerald-400 hover:bg-white/[0.04]' : 'text-white/30'}`}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className={`w-8 h-px mx-1 ${isDone ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
                </div>
              );
            })}
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">

              {/* STEP 0: Perfil WhatsApp */}
              {step === 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Perfil WhatsApp</h2>
                  <p className="text-sm text-white/40 mb-6">Selecione ou crie um perfil com as informações do WhatsApp para o disparo.</p>

                  {profiles.length > 0 && !showNewProfile && (
                    <div className="space-y-2 mb-4">
                      {profiles.map((p) => (
                        <button key={p.id} onClick={() => setSelectedProfileId(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${selectedProfileId === p.id ? 'border-purple-500/50 bg-purple-600/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                          {p.profile_photo_url ? <img src={p.profile_photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-sm font-semibold">{p.whatsapp_name.charAt(0).toUpperCase()}</div>}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><p className="text-sm font-medium text-white truncate">{p.name}</p>{p.is_default && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}</div>
                            <p className="text-xs text-white/40">{p.whatsapp_name} · DDD {p.ddd} · {p.redirect_numbers.length} nº redirect</p>
                          </div>
                          {selectedProfileId === p.id && <Check className="h-5 w-5 text-purple-400 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {!showNewProfile ? (
                    <button onClick={() => setShowNewProfile(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-white/[0.1] text-white/50 hover:text-white/80 hover:border-purple-500/30 transition-colors">
                      <Plus className="h-4 w-4" />Criar novo perfil
                    </button>
                  ) : (
                    <div className="border border-white/[0.08] rounded-lg p-4 space-y-4">
                      <h3 className="text-sm font-medium text-white">Novo Perfil</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-white/40 mb-1 block">Nome do perfil *</label><input type="text" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} placeholder="Ex: Perfil Principal" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" /></div>
                        <div><label className="text-xs text-white/40 mb-1 block">Nome no WhatsApp *</label><input type="text" value={newProfile.whatsapp_name} onChange={(e) => setNewProfile({ ...newProfile, whatsapp_name: e.target.value })} placeholder="Nome exibido no app" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-white/40 mb-1 block">DDD *</label><input type="text" value={newProfile.ddd} onChange={(e) => setNewProfile({ ...newProfile, ddd: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="11" maxLength={3} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" /></div>
                        <div><label className="text-xs text-white/40 mb-1 block">Foto de perfil</label><label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/50 cursor-pointer hover:bg-white/[0.06] transition-colors"><Upload className="h-4 w-4" />{profilePhotoFile ? profilePhotoFile.name : 'Selecionar...'}<input type="file" accept="image/*" onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)} className="hidden" /></label></div>
                      </div>
                      {profilePhotoPreview && <div className="flex items-center gap-3"><img src={profilePhotoPreview} alt="Preview" className="h-12 w-12 rounded-full object-cover" /><button onClick={() => setProfilePhotoFile(null)} className="text-xs text-red-400 hover:text-red-300">Remover</button></div>}
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">Números de redirecionamento *</label>
                        {newProfile.redirect_numbers.map((num, i) => (
                          <div key={i} className="flex items-center gap-2 mb-2">
                            <input type="text" value={num} onChange={(e) => { const nums = [...newProfile.redirect_numbers]; nums[i] = e.target.value.replace(/\D/g, ''); setNewProfile({ ...newProfile, redirect_numbers: nums }); }} placeholder="5511999998888" className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" />
                            {newProfile.redirect_numbers.length > 1 && <button onClick={() => { const nums = newProfile.redirect_numbers.filter((_, j) => j !== i); setNewProfile({ ...newProfile, redirect_numbers: nums }); }} className="p-2 text-red-400/50 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
                          </div>
                        ))}
                        <button onClick={() => setNewProfile({ ...newProfile, redirect_numbers: [...newProfile.redirect_numbers, ''] })} className="text-xs text-purple-400 hover:text-purple-300">+ Adicionar número</button>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-white/60"><input type="checkbox" checked={newProfile.is_default} onChange={(e) => setNewProfile({ ...newProfile, is_default: e.target.checked })} className="rounded bg-white/[0.06] border-white/[0.1]" />Definir como perfil padrão</label>
                      <div className="flex items-center gap-3 pt-2">
                        <button onClick={handleCreateProfile} disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Perfil'}</button>
                        <button onClick={() => setShowNewProfile(false)} className="px-4 py-2 text-white/50 hover:text-white/80 text-sm">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 1: Oferta */}
              {step === 1 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Oferta e Mídia</h2>
                  <p className="text-sm text-white/40 mb-6">Defina o texto da oferta e anexe a mídia (opcional).</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Texto da oferta * <span className="text-white/20">({offerText.length} caracteres)</span></label>
                      <textarea value={offerText} onChange={(e) => setOfferText(e.target.value)} rows={6} placeholder="Digite o texto da oferta que será enviado..." className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 resize-none" />
                      {offerText.length > 0 && offerText.length < 10 && <p className="text-xs text-red-400 mt-1">Mínimo de 10 caracteres</p>}
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Mídia (imagem ou vídeo) <span className="text-white/20">· Vídeo max 13MB · Imagem max 5MB</span></label>
                      {!mediaInfo && !mediaFile ? (
                        <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-lg border border-dashed border-white/[0.1] cursor-pointer hover:border-purple-500/30 hover:bg-white/[0.02] transition-colors">
                          <Upload className="h-8 w-8 text-white/20" /><span className="text-sm text-white/40">Clique para enviar imagem ou vídeo</span><span className="text-xs text-white/20">JPG, PNG, MP4, MOV</span>
                          <input type="file" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f); }} className="hidden" />
                        </label>
                      ) : (
                        <div className="relative rounded-lg border border-white/[0.08] p-4">
                          <div className="flex items-center gap-4">
                            {mediaPreview && mediaFile?.type.startsWith('image/') && <img src={mediaPreview} alt="Preview" className="h-20 w-20 rounded-lg object-cover" />}
                            {mediaPreview && mediaFile?.type.startsWith('video/') && <video src={mediaPreview} className="h-20 w-20 rounded-lg object-cover" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{mediaInfo?.name || mediaFile?.name}</p>
                              <p className="text-xs text-white/40">{mediaInfo?.type === 'video' ? <Video className="inline h-3 w-3 mr-1" /> : <Image className="inline h-3 w-3 mr-1" />}{((mediaInfo?.size || mediaFile?.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
                              {saving && <p className="text-xs text-purple-400 mt-1">Enviando...</p>}
                            </div>
                            <button onClick={() => { setMediaFile(null); setMediaInfo(null); setMediaPreview(null); }} className="p-2 text-white/30 hover:text-red-400"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Base de Contatos */}
              {step === 2 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Base de Contatos</h2>
                  <p className="text-sm text-white/40 mb-6">Envie a planilha com os números para disparo.</p>
                  <div className="space-y-4">
                    {!contactInfo ? (
                      <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-lg border border-dashed border-white/[0.1] cursor-pointer hover:border-purple-500/30 hover:bg-white/[0.02] transition-colors">
                        <FileSpreadsheet className="h-8 w-8 text-white/20" /><span className="text-sm text-white/40">Clique para enviar planilha</span><span className="text-xs text-white/20">.xlsx, .xls ou .csv</span>
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleContactUpload(f); }} className="hidden" />
                      </label>
                    ) : (
                      <div className="rounded-lg border border-white/[0.08] p-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-emerald-500/10"><FileSpreadsheet className="h-6 w-6 text-emerald-400" /></div>
                          <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{contactInfo.name}</p><p className="text-xs text-emerald-400">Arquivo enviado com sucesso</p></div>
                          <button onClick={() => { setContactFile(null); setContactInfo(null); setContactCount(0); }} className="p-2 text-white/30 hover:text-red-400"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Quantidade de contatos na base</label>
                      <input type="number" value={contactCount || ''} onChange={(e) => setContactCount(Number(e.target.value))} placeholder="Ex: 1500" min={0} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" />
                      <p className="text-xs text-white/20 mt-1">Informe a quantidade aproximada de contatos</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Agendamento (com regra 30h / 12h) */}
              {step === 3 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Agendamento</h2>
                  <p className="text-sm text-white/40 mb-4">Escolha a data e horário preferencial para o disparo.</p>

                  {/* Info box com regra de antecedência */}
                  {scheduleInfo && (
                    <div className={`p-3 rounded-lg mb-6 ${scheduleInfo.isFirstDispatch ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                      <div className="flex items-start gap-2">
                        <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${scheduleInfo.isFirstDispatch ? 'text-yellow-400' : 'text-blue-400'}`} />
                        <div>
                          <p className={`text-sm font-medium ${scheduleInfo.isFirstDispatch ? 'text-yellow-400' : 'text-blue-400'}`}>
                            {scheduleInfo.isFirstDispatch ? 'Primeiro disparo' : 'Disparo recorrente'}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5">
                            {scheduleInfo.isFirstDispatch
                              ? 'Como este é seu primeiro disparo, o agendamento mínimo é de 30 horas a partir de agora.'
                              : 'O agendamento mínimo é de 12 horas a partir de agora.'}
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            Horário mínimo: {scheduleInfo.minDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Data preferencial *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} min={scheduleInfo ? scheduleInfo.minDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Horário preferencial *</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]" />
                      </div>
                    </div>
                  </div>

                  {scheduleError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {scheduleError}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Revisão */}
              {step === 4 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Revisão da Solicitação</h2>
                  <p className="text-sm text-white/40 mb-6">Confira todos os dados antes de enviar.</p>
                  <div className="space-y-4">
                    {/* Perfil */}
                    <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-2"><span className="text-xs text-white/40 uppercase tracking-wider">Perfil WhatsApp</span><button onClick={() => setStep(0)} className="text-xs text-purple-400 hover:text-purple-300">Editar</button></div>
                      {selectedProfile ? (
                        <div className="flex items-center gap-3">
                          {selectedProfile.profile_photo_url ? <img src={selectedProfile.profile_photo_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold">{selectedProfile.whatsapp_name.charAt(0)}</div>}
                          <div><p className="text-sm text-white">{selectedProfile.whatsapp_name}</p><p className="text-xs text-white/40">DDD {selectedProfile.ddd} · {selectedProfile.redirect_numbers.join(', ')}</p></div>
                        </div>
                      ) : <p className="text-sm text-red-400">Nenhum perfil selecionado</p>}
                    </div>
                    {/* Oferta */}
                    <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-2"><span className="text-xs text-white/40 uppercase tracking-wider">Oferta</span><button onClick={() => setStep(1)} className="text-xs text-purple-400 hover:text-purple-300">Editar</button></div>
                      <p className="text-sm text-white whitespace-pre-wrap">{offerText || <span className="text-red-400">Sem oferta</span>}</p>
                      {mediaInfo && <p className="text-xs text-white/40 mt-2">{mediaInfo.type === 'video' ? '🎥' : '🖼️'} {mediaInfo.name} ({(mediaInfo.size / 1024 / 1024).toFixed(2)} MB)</p>}
                    </div>
                    {/* Base */}
                    <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-2"><span className="text-xs text-white/40 uppercase tracking-wider">Base de Contatos</span><button onClick={() => setStep(2)} className="text-xs text-purple-400 hover:text-purple-300">Editar</button></div>
                      {contactInfo ? <div><p className="text-sm text-white">{contactInfo.name}</p>{contactCount > 0 && <p className="text-xs text-white/40">{contactCount.toLocaleString('pt-BR')} contatos</p>}</div> : <p className="text-sm text-red-400">Nenhuma base enviada</p>}
                    </div>
                    {/* Agendamento */}
                    <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-2"><span className="text-xs text-white/40 uppercase tracking-wider">Agendamento</span><button onClick={() => setStep(3)} className="text-xs text-purple-400 hover:text-purple-300">Editar</button></div>
                      {preferredDate && preferredTime ? (
                        <p className="text-sm text-white">{new Date(preferredDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} às {preferredTime}</p>
                      ) : <p className="text-sm text-red-400">Data/horário não definidos</p>}
                    </div>
                  </div>
                  {/* Validation */}
                  {(() => {
                    const issues: string[] = [];
                    if (!selectedProfileId) issues.push('Perfil WhatsApp não selecionado');
                    if (!offerText || offerText.length < 10) issues.push('Texto da oferta muito curto');
                    if (!contactInfo) issues.push('Base de contatos não enviada');
                    if (!preferredDate || !preferredTime) issues.push('Data/horário não definidos');
                    if (scheduleError) issues.push(scheduleError);
                    if (issues.length > 0) return (
                      <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400 font-medium mb-1">Pendências:</p>
                        {issues.map((issue) => <p key={issue} className="text-xs text-red-400/70">• {issue}</p>)}
                      </div>
                    );
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={step === 0 ? () => router.push('/solicitacoes') : handleBack} className="flex items-center gap-2 px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors">
                <ArrowLeft className="h-4 w-4" />{step === 0 ? 'Voltar' : 'Anterior'}
              </button>
              <div className="flex items-center gap-3">
                {saving && <span className="flex items-center gap-1.5 text-xs text-white/30"><Loader2 className="h-3 w-3 animate-spin" />Salvando...</span>}
                {step < STEPS.length - 1 ? (
                  <button onClick={handleNext} disabled={!canAdvance() || saving} className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Próximo<ArrowRight className="h-4 w-4" /></button>
                ) : (
                  <button onClick={handleSubmit} disabled={submitting || !selectedProfileId || !offerText || offerText.trim().length < 10 || !contactInfo || !preferredDate || !preferredTime || !!scheduleError} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-600/20">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Confirmar e Enviar
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
