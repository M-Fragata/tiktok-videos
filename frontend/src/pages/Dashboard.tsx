import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearStudioVideoCache } from '../services/studioCache';

interface AccountSnapshot {
  recordedAt: string;
  followerCount: number;
  likesCount: number;
  videoCount: number;
}

interface VideoSnapshot {
  recordedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

interface TikTokVideoItem {
  id: string;
  createTime: number | null;
  title: string | null;
  videoDescription: string | null;
  duration: number | null;
  coverImageUrl: string | null;
  shareUrl: string | null;
  embedLink: string | null;
  localVideoId: string | null;
  localVideo: {
    id: string;
    theme: string;
    status: string;
    videoUrl: string | null;
  } | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewDelta: number;
  likeDelta: number;
  commentDelta: number;
  shareDelta: number;
  engagementRate: number;
  snapshots: VideoSnapshot[];
}

interface StudioVideoItem {
  id: string;
  theme: string;
  status: string;
  videoUrl: string | null;
  createdAt: string;
}

interface TikTokDashboardPayload {
  connected: boolean;
  lastSyncAt: string | null;
  account: {
    openId: string;
    displayName: string | null;
    avatarUrl: string | null;
    bioDescription: string | null;
    profileDeepLink: string | null;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    likesCount: number;
    videoCount: number;
    followerDelta: number;
    likesDelta: number;
    videoDelta: number;
    totalViews: number;
    totalViewsDelta: number;
    averageEngagementRate: number;
  } | null;
  accountHistory: AccountSnapshot[];
  videos: TikTokVideoItem[];
  studioVideos: StudioVideoItem[];
}

/**
 * Formata o tempo decorrido desde a última sincronização de forma curta e discreta
 * (ex: "Agora", "Há 1 min", "Há 5 min", "Há 2 h", "Há 1 d").
 */
function formatSyncTimeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Nunca';
  const past = new Date(isoDate).getTime();
  if (isNaN(past)) return 'Nunca';

  const diffSec = Math.max(0, Math.floor((Date.now() - past) / 1000));

  if (diffSec < 60) {
    return 'Agora';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `Há ${diffMin} min`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `Há ${diffHours} h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Há ${diffDays} d`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestampOrIso: number | string | null): string {
  if (!timestampOrIso) return '—';
  const date =
    typeof timestampOrIso === 'number'
      ? new Date(timestampOrIso * 1000)
      : new Date(timestampOrIso);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderDeltaBadge(delta: number) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        +{delta.toLocaleString('pt-BR')}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-rose-400">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        {delta.toLocaleString('pt-BR')}
      </span>
    );
  }
  return <span className="text-[11px] font-medium text-slate-500">0 estável</span>;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados principais
  const [activePlatform, setActivePlatform] = useState<'tiktok' | 'youtube' | 'instagram'>('tiktok');
  const [data, setData] = useState<TikTokDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filtros e ordenação do grid
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'likes' | 'engagement'>('date');

  // Modal de Detalhe e Controle
  const [selectedVideo, setSelectedVideo] = useState<TikTokVideoItem | null>(null);
  const [selectedStudioLinkId, setSelectedStudioLinkId] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);

  // Controle de vídeo (video.manage)
  const [manageCaption, setManageCaption] = useState<string>('');
  const [isManaging, setIsManaging] = useState<boolean>(false);
  const [manageMessage, setManageMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Ticker de tempo decorrido (atualiza a cada 10s para refletir "1 minuto", "2 minutos" etc.)
  const [, setTick] = useState<number>(Date.now());

  useEffect(() => {
    clearStudioVideoCache();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Alerta de sucesso se redirecionado do login
  useEffect(() => {
    if (searchParams.get('tiktok') === 'connected') {
      setSuccessToast('Conta do TikTok autenticada e sincronizada com sucesso!');
      const t = setTimeout(() => setSuccessToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // Carrega os dados iniciais do Dashboard
  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const res = await fetch('/api/tiktok/dashboard');
      if (!res.ok) {
        throw new Error(`Falha ao carregar dashboard (${res.status})`);
      }
      const json: TikTokDashboardPayload = await res.json();
      setData(json);

      // Se há um vídeo selecionado no modal, atualiza sua referência sem reabrir se fechado
      setSelectedVideo((prev) => {
        if (!prev) return null;
        const updated = json.videos.find((v) => v.id === prev.id);
        if (updated) {
          setSelectedStudioLinkId(updated.localVideoId || '');
          return updated;
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do TikTok');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Sincronização manual com a API do TikTok
  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      setIsSyncing(true);
      setError(null);
      const res = await fetch('/api/tiktok/sync', { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro ao sincronizar (${res.status})`);
      }
      const updatedData: TikTokDashboardPayload = await res.json();
      setData(updatedData);
      setSuccessToast('Dados atualizados com sucesso da API do TikTok!');
      setTimeout(() => setSuccessToast(null), 4000);

      setSelectedVideo((prev) => {
        if (!prev) return null;
        const updated = updatedData.videos.find((v) => v.id === prev.id);
        if (updated) {
          setSelectedStudioLinkId(updated.localVideoId || '');
          return updated;
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar com TikTok');
    } finally {
      setIsSyncing(false);
    }
  };

  // Login / Reconexão via OAuth
  const handleConnectTikTok = () => {
    window.location.href = '/api/tiktok/login';
  };

  // Abrir modal do vídeo
  const handleOpenVideoModal = (video: TikTokVideoItem) => {
    setSelectedVideo(video);
    setSelectedStudioLinkId(video.localVideoId || '');
    setManageCaption(video.title || video.videoDescription || '');
    setManageMessage(null);
  };

  const handleCloseVideoModal = () => {
    setSelectedVideo(null);
    setManageMessage(null);
  };

  // Vincular / Desvincular vídeo do Studio
  const handleSaveVideoLink = async () => {
    if (!selectedVideo) return;
    try {
      setIsLinking(true);
      const res = await fetch(`/api/tiktok/videos/${selectedVideo.id}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localVideoId: selectedStudioLinkId || null }),
      });
      if (!res.ok) {
        throw new Error('Falha ao atualizar vínculo');
      }
      const updatedPayload = await res.json();
      setSelectedVideo(updatedPayload.video);
      await loadDashboard(true);
      setManageMessage({
        type: 'success',
        text: selectedStudioLinkId
          ? 'Vídeo vinculado com sucesso ao projeto do Studio!'
          : 'Vínculo removido com sucesso.',
      });
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao vincular',
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Executar ação de gerenciamento (video.manage)
  const handleVideoManage = async (action: 'edit' | 'delete') => {
    if (!selectedVideo || isManaging) return;
    try {
      setIsManaging(true);
      setManageMessage(null);

      const res = await fetch(`/api/tiktok/videos/${selectedVideo.id}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: manageCaption,
          description: manageCaption,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Erro ao executar ação');
      }

      setManageMessage({
        type: resData.status === 'success' ? 'success' : 'info',
        text: resData.message || 'Comando de gerenciamento processado.',
      });

      if (action === 'edit' && resData.video) {
        setSelectedVideo(resData.video);
        await loadDashboard(true);
      }
    } catch (err) {
      setManageMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao gerenciar publicação',
      });
    } finally {
      setIsManaging(false);
    }
  };

  // Criar novo rascunho de vídeo no Studio
  const handleCreateDraft = async () => {
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'Novo Vídeo — Fragata Shorts' }),
      });
      const resData = await res.json();
      if (res.ok && resData.video?.id) {
        clearStudioVideoCache(resData.video.id);
        navigate(`/video/${resData.video.id}`);
      } else {
        navigate('/');
      }
    } catch {
      navigate('/');
    }
  };

  // Lista de vídeos filtrada e ordenada
  const filteredVideos = useMemo(() => {
    if (!data?.videos) return [];
    let list = [...data.videos];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (v) =>
          (v.title && v.title.toLowerCase().includes(q)) ||
          (v.videoDescription && v.videoDescription.toLowerCase().includes(q)) ||
          (v.localVideo?.theme && v.localVideo.theme.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'views') return b.viewCount - a.viewCount;
      if (sortBy === 'likes') return b.likeCount - a.likeCount;
      if (sortBy === 'engagement') return b.engagementRate - a.engagementRate;
      // Default: date (createTime desc)
      return (b.createTime || 0) - (a.createTime || 0);
    });

    return list;
  }, [data?.videos, searchTerm, sortBy]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* ─── SIDEBAR ESQUERDA (NAVEGAÇÃO MULTIPLATAFORMA) ─── */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div>
          {/* Logo & Marca */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-2 py-3 cursor-pointer group mb-6 transition-transform hover:scale-[1.02]"
          >
            <img
              src="/logo/fragata_shorts_logo.png"
              alt="Fragata Shorts"
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Seção Redes Sociais */}
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Canais Conectados
          </div>

          <nav className="space-y-1.5">
            {/* TikTok Tab (Ativo) */}
            <button
              onClick={() => setActivePlatform('tiktok')}
              className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-xs font-semibold transition-all ${
                activePlatform === 'tiktok'
                  ? 'bg-gradient-to-r from-slate-800 to-slate-800/90 text-white shadow-md shadow-black/40 border border-slate-700/80'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white font-black text-xs shadow-inner shadow-white/10 border border-slate-700">
                  <svg className="w-4 h-4 fill-current text-cyan-400" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.69 6.34 6.34 0 0 0 9.35 22a6.33 6.33 0 0 0 6.34-6.31V9.47a8.16 8.16 0 0 0 4.9 1.62v-3.5a4.85 4.85 0 0 1-1-.9z" />
                  </svg>
                </span>
                <span className="text-sm font-medium">TikTok</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ativo
              </span>
            </button>

            {/* YouTube Shorts (Em breve) */}
            <div
              title="Integração em desenvolvimento"
              className="w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-500 opacity-60 cursor-not-allowed border border-transparent"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-950/40 text-red-500 border border-red-900/30">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </span>
                <span className="text-sm font-medium">YouTube Shorts</span>
              </div>
              <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                Em breve
              </span>
            </div>

            {/* Instagram Reels (Em breve) */}
            <div
              title="Integração em desenvolvimento"
              className="w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-500 opacity-60 cursor-not-allowed border border-transparent"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-950/40 text-pink-500 border border-pink-900/30">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                </span>
                <span className="text-sm font-medium">Instagram Reels</span>
              </div>
              <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                Em breve
              </span>
            </div>
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="space-y-2 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao Início
          </button>

          <button
            onClick={handleCreateDraft}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/10 hover:from-amber-400 hover:to-amber-500 active:scale-95 transition"
          >
            <span className="text-base font-black leading-none">+</span>
            Nova História
          </button>
        </div>
      </aside>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Superior */}
        <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-20 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Painel de Performance</span>
              <span className="text-slate-500">/</span>
              <span className="text-amber-400 text-sm font-semibold">TikTok</span>
            </h1>
          </div>
        </header>

        {/* Notificações e Toasts */}
        {successToast && (
          <div className="mx-8 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-300 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {error && (
          <div className="mx-8 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ─── CONTEÚDO SCROLLÁVEL ─── */}
        <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
          {isLoading && !data ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-4" />
              <p className="text-sm font-medium text-slate-300">Carregando métricas do TikTok...</p>
              <p className="text-xs text-slate-500 mt-1">Conectando ao banco de dados SQLite</p>
            </div>
          ) : !data?.connected || !data?.account ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-amber-400 mb-4 border border-slate-700">
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.69 6.34 6.34 0 0 0 9.35 22a6.33 6.33 0 0 0 6.34-6.31V9.47a8.16 8.16 0 0 0 4.9 1.62v-3.5a4.85 4.85 0 0 1-1-.9z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Conta do TikTok não conectada</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                Para visualizar métricas em tempo real e gerenciar suas postagens, autentique sua conta com os escopos autorizados.
              </p>
              <button
                onClick={handleConnectTikTok}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
              >
                Conectar TikTok Oficial
              </button>
            </div>
          ) : (
            <>
              {/* ─── 1. ANÁLISE DO PERFIL & CABEÇALHO DO CRIADOR ─── */}
              <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-900/40 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-800/80">
                  <div className="flex items-center gap-5">
                    {/* Foto do Perfil */}
                    <div className="relative block rounded-2xl">
                      {data.account.avatarUrl ? (
                        <img
                          src={data.account.avatarUrl}
                          alt={data.account.displayName || 'TikTok Creator'}
                          className="h-20 w-20 rounded-2xl object-cover border-2 border-amber-500/40 shadow-lg shadow-amber-500/10"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-2xl bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-400 border border-slate-700">
                          {data.account.displayName?.[0] || 'T'}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-black text-amber-400 border border-slate-700 shadow">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.69 6.34 6.34 0 0 0 9.35 22a6.33 6.33 0 0 0 6.34-6.31V9.47a8.16 8.16 0 0 0 4.9 1.62v-3.5a4.85 4.85 0 0 1-1-.9z" />
                        </svg>
                      </span>
                    </div>

                    {/* Dados Básicos & Bio */}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <a
                          href={data.account.profileDeepLink || 'https://www.tiktok.com/@billy_aventureiro'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xl font-bold text-white tracking-tight hover:text-amber-400 transition-colors"
                        >
                          {data.account.displayName || 'Billy, O aventureiro!'}
                        </a>

                        {data.account.isVerified && (
                          <span className="text-amber-400" title="Conta Verificada">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          </span>
                        )}

                        <span className="inline-flex items-center rounded-md bg-slate-800/90 px-2 py-0.5 text-[11px] font-mono text-slate-400 border border-slate-700">
                          @billy_aventureiro
                        </span>
                      </div>

                      {data.account.bioDescription && (
                        <p className="mt-2 text-xs text-slate-300 max-w-2xl whitespace-pre-line leading-relaxed">
                          {data.account.bioDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status de Sincronização & Refresh Compacto (Canto Superior Direito do Card) */}
                  <div className="flex items-center gap-2.5 self-end md:self-start">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{formatSyncTimeAgo(data.lastSyncAt)}</span>
                    </div>
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      title="Sincronizar dados"
                      aria-label="Sincronizar dados"
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-95 disabled:opacity-50 ${
                        isSyncing
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                          : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400'
                      }`}
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 16h5v5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ─── CARDS DE KPI (MÉTRICAS DO PERFIL) ─── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6">
                  {/* Seguidores */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Seguidores</span>
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-black text-white">
                      {data.account.followerCount.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {renderDeltaBadge(data.account.followerDelta)}
                    </div>
                  </div>

                  {/* Curtidas Totais */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Total Curtidas</span>
                      <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-black text-white">
                      {data.account.likesCount.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {renderDeltaBadge(data.account.likesDelta)}
                    </div>
                  </div>

                  {/* Total de Visualizações */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Total de Views</span>
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-black text-white">
                      {data.account.totalViews.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {renderDeltaBadge(data.account.totalViewsDelta)}
                    </div>
                  </div>

                  {/* Taxa de Engajamento */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Engajamento</span>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                      {data.account.averageEngagementRate}%
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      (likes+com+sh)/views
                    </div>
                  </div>

                  {/* Vídeos Públicos */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span>Vídeos Ativos</span>
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-black text-white">
                      {data.account.videoCount.toLocaleString('pt-BR')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {renderDeltaBadge(data.account.videoDelta)}
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── 2. SEÇÃO DE PUBLICAÇÕES (MENU-GRID) ─── */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Publicações no TikTok</span>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
                        {filteredVideos.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Clique em qualquer vídeo para abrir detalhes, vincular ao Studio ou gerenciar.
                    </p>
                  </div>

                  {/* Filtro e Ordenação */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por legenda..."
                        className="w-56 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500/80 focus:outline-none"
                      />
                      <svg
                        className="w-4 h-4 text-slate-500 absolute left-3 top-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'likes' | 'engagement')}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 focus:border-amber-500/80 focus:outline-none cursor-pointer"
                    >
                      <option value="date">Mais Recentes</option>
                      <option value="views">Mais Visualizados</option>
                      <option value="likes">Mais Curtidos</option>
                      <option value="engagement">Maior Engajamento</option>
                    </select>
                  </div>
                </div>

                {/* Grid de Vídeos */}
                {filteredVideos.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-12 text-center">
                    <p className="text-sm text-slate-400">Nenhum vídeo encontrado com os filtros atuais.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {filteredVideos.map((video) => (
                      <div
                        key={video.id}
                        onClick={() => handleOpenVideoModal(video)}
                        className="group relative flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700 transition-all cursor-pointer overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.01]"
                      >
                        {/* Imagem de Capa com Badge de Duração */}
                        <div className="relative aspect-[9/14] w-full bg-slate-950 overflow-hidden">
                          {video.coverImageUrl ? (
                            <img
                              src={video.coverImageUrl}
                              alt={video.title || 'Capa do vídeo'}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-700">
                              <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}

                          {/* Overlay escuro gradiente */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

                          {/* Duração */}
                          <div className="absolute top-2.5 right-2.5 rounded-md bg-black/80 backdrop-blur px-2 py-0.5 text-[10px] font-mono font-bold text-white border border-white/10">
                            {formatDuration(video.duration)}
                          </div>

                          {/* Badge de Vínculo com Studio */}
                          <div className="absolute top-2.5 left-2.5">
                            {video.localVideo ? (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-950/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40 shadow">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Studio
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-900/80 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
                                Sem vínculo
                              </span>
                            )}
                          </div>

                          {/* Hover Play Icon */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                              <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </div>

                          {/* Views no canto inferior da capa */}
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-bold text-white drop-shadow">
                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span>{video.viewCount.toLocaleString('pt-BR')} views</span>
                          </div>
                        </div>

                        {/* Corpo do Card */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-medium">
                            {video.title || video.videoDescription || 'Sem legenda cadastrada.'}
                          </p>

                          {/* Linha de Métricas */}
                          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/80 text-[11px]">
                            <div className="flex items-center gap-1 text-slate-400" title="Curtidas">
                              <svg className="w-3.5 h-3.5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              <span>{video.likeCount}</span>
                            </div>

                            <div className="flex items-center gap-1 text-slate-400" title="Comentários">
                              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span>{video.commentCount}</span>
                            </div>

                            <div className="flex items-center justify-end gap-1 text-emerald-400 font-semibold" title="Engajamento">
                              <span>{video.engagementRate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {/* ─── 3. MODAL DE DETALHES & CONTROLE DA PUBLICAÇÃO ─── */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={handleCloseVideoModal}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden flex flex-col md:flex-row custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={handleCloseVideoModal}
              className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>

            {/* Coluna Esquerda: Player Oficial / Embed */}
            <div className="w-full md:w-5/12 bg-black flex flex-col items-center justify-center p-4 relative min-h-[420px]">
              {selectedVideo.embedLink ? (
                <iframe
                  key={selectedVideo.id}
                  src={selectedVideo.embedLink}
                  title={selectedVideo.title || 'TikTok Embed'}
                  className="w-full h-[520px] rounded-xl border border-slate-800 shadow-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : selectedVideo.coverImageUrl ? (
                <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                  <img
                    src={selectedVideo.coverImageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs text-slate-300 mb-3">Player interativo direto no TikTok</p>
                    {selectedVideo.shareUrl && (
                      <a
                        href={selectedVideo.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition"
                      >
                        Abrir no TikTok
                      </a>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedVideo.shareUrl && (
                <a
                  href={selectedVideo.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Abrir post oficial no TikTok</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Coluna Direita: Metadados, Vínculo com Studio e Controle */}
            <div className="w-full md:w-7/12 p-6 flex flex-col justify-between overflow-y-auto max-h-[85vh] space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Publicado em: {formatDate(selectedVideo.createTime)}</span>
                  <span className="font-mono">Duração: {formatDuration(selectedVideo.duration)}</span>
                </div>

                <h3 className="text-base font-bold text-white mb-2 leading-snug">
                  {selectedVideo.title || 'Sem título cadastrado'}
                </h3>

                {/* Grid de Métricas Consolidadas */}
                <div className="grid grid-cols-4 gap-2.5 my-4">
                  <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Views</div>
                    <div className="text-base font-black text-white">
                      {selectedVideo.viewCount.toLocaleString('pt-BR')}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Curtidas</div>
                    <div className="text-base font-black text-pink-400">
                      {selectedVideo.likeCount.toLocaleString('pt-BR')}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Comentários</div>
                    <div className="text-base font-black text-cyan-400">
                      {selectedVideo.commentCount.toLocaleString('pt-BR')}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400">Engajamento</div>
                    <div className="text-base font-black text-emerald-400">
                      {selectedVideo.engagementRate}%
                    </div>
                  </div>
                </div>

                {/* Histórico de Crescimento (Snapshots) */}
                {selectedVideo.snapshots.length > 1 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Histórico de Sincronizações (Snapshots)
                    </h4>
                    <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-[11px] font-mono space-y-1">
                      {selectedVideo.snapshots.map((snap, idx) => (
                        <div key={idx} className="flex items-center justify-between text-slate-300 py-0.5 border-b border-slate-800/50 last:border-0">
                          <span className="text-slate-500">{formatDate(snap.recordedAt)}</span>
                          <span className="text-white font-bold">{snap.viewCount} views</span>
                          <span className="text-pink-400">{snap.likeCount} likes</span>
                          <span className="text-cyan-400">{snap.commentCount} com</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── INTEGRAÇÃO COM STUDIO (VINCULAÇÃO) ─── */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Vínculo com Projeto do Studio (Remotion)
                    </h4>
                    {selectedVideo.localVideo && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                        Vinculado
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Vincule esta publicação ao vídeo correspondente criado no Studio para rastrear a história e assets utilizados.
                  </p>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedStudioLinkId}
                      onChange={(e) => setSelectedStudioLinkId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">-- Selecione um projeto do Studio --</option>
                      {data?.studioVideos.map((sv) => (
                        <option key={sv.id} value={sv.id}>
                          {sv.theme} ({sv.status})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleSaveVideoLink}
                      disabled={isLinking}
                      className="rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50"
                    >
                      {isLinking ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>

                  {selectedVideo.localVideo && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium truncate max-w-[240px]">
                        {selectedVideo.localVideo.theme}
                      </span>
                      <button
                        onClick={() => {
                          if (selectedVideo.localVideoId) {
                            clearStudioVideoCache(selectedVideo.localVideoId);
                          }
                          navigate(`/video/${selectedVideo.localVideoId}`);
                        }}
                        className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition flex items-center gap-1"
                      >
                        <span>Abrir no Studio</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* ─── CONTROLE DA PUBLICAÇÃO (video.manage) ─── */}
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Controle & Edição (video.manage)
                    </h4>
                    <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/30">
                      Escopo Autorizado
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Edite a legenda ou remova o vídeo utilizando as permissões oficiais da API do TikTok.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Legenda / Descrição</label>
                    <textarea
                      value={manageCaption}
                      onChange={(e) => setManageCaption(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleVideoManage('edit')}
                      disabled={isManaging}
                      className="flex-1 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition disabled:opacity-50"
                    >
                      {isManaging ? 'Enviando...' : 'Salvar Alteração'}
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm('Tem certeza de que deseja solicitar a exclusão deste vídeo no TikTok?')) {
                          void handleVideoManage('delete');
                        }
                      }}
                      disabled={isManaging}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
                    >
                      Excluir Post
                    </button>
                  </div>

                  {manageMessage && (
                    <div
                      className={`rounded-xl p-3 text-xs border ${
                        manageMessage.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : manageMessage.type === 'info'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {manageMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Dashboard;