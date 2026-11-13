import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveAssetSrc, VideoRecord } from '../remotion/types';
import { clearStudioVideoCache } from '../services/studioCache';

const ITEMS_PER_PAGE_FIRST = 7; // 1º página: 1 card de criação + 7 vídeos = 8 cards (4 cols x 2 linhas)
const ITEMS_PER_PAGE_OTHER = 8; // Páginas subsequentes: 8 vídeos = 8 cards (4 cols x 2 linhas)
const SKELETON_ITEMS_COUNT = 7; // No loading: 1 card de criação real + 7 skeletons de vídeos

/**
 * Componente de Skeleton para um card de vídeo no grid da Home.
 * Segue exatamente as dimensões e proporções dos cards reais.
 */
const HomeVideoCardSkeleton: React.FC = () => {
  return (
    <div
      className="flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 animate-pulse"
      aria-hidden="true"
    >
      {/* Thumbnail 9:16 Aspect Area */}
      <div className="relative aspect-[9/16] max-h-[260px] w-full bg-slate-800/60 flex items-center justify-center overflow-hidden">
        <svg
          className="h-10 w-10 text-slate-700/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
      </div>

      {/* Conteúdo do Card */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-2">
          <div className="h-4 w-4/5 rounded bg-slate-800" />
          <div className="h-4 w-3/5 rounded bg-slate-800/80" />
        </div>
        <div className="pt-3">
          <div className="h-3 w-2/5 rounded bg-slate-800/60" />
        </div>
      </div>
    </div>
  );
};

/**
 * Gera lista de páginas com reticências para paginação amigável.
 */
function getVisiblePages(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/videos');
      if (!res.ok) {
        throw new Error(`Falha ao buscar histórico (${res.status})`);
      }
      const data: VideoRecord[] = await res.json();
      setVideos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vídeos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    clearStudioVideoCache();
    void fetchVideos();
  }, []);

  /**
   * Cálculo da paginação com base na regra de 4 colunas x 2 linhas (8 slots):
   * - Página 1: 1 slot para o card "Criar Nova História" + 7 vídeos = 8 slots.
   * - Páginas 2+: 8 vídeos = 8 slots.
   */
  const totalVideos = videos.length;
  const totalPages = Math.max(
    1,
    totalVideos <= ITEMS_PER_PAGE_FIRST
      ? 1
      : 1 + Math.ceil((totalVideos - ITEMS_PER_PAGE_FIRST) / ITEMS_PER_PAGE_OTHER)
  );

  // Ajusta a página atual se a lista for reduzida
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const displayedVideos = useMemo(() => {
    if (currentPage === 1) {
      return videos.slice(0, ITEMS_PER_PAGE_FIRST);
    }
    const start = ITEMS_PER_PAGE_FIRST + (currentPage - 2) * ITEMS_PER_PAGE_OTHER;
    return videos.slice(start, start + ITEMS_PER_PAGE_OTHER);
  }, [videos, currentPage]);

  const startIndex =
    currentPage === 1
      ? 0
      : ITEMS_PER_PAGE_FIRST + (currentPage - 2) * ITEMS_PER_PAGE_OTHER;
  const endIndex =
    currentPage === 1
      ? Math.min(ITEMS_PER_PAGE_FIRST, totalVideos)
      : Math.min(startIndex + ITEMS_PER_PAGE_OTHER, totalVideos);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Cria um registo em rascunho (status: DRAFT, remotionProps: null)
   * e abre diretamente o Studio na Etapa 1 (Briefing) sem gastar créditos de IA.
   */
  const handleCreateDraftVideo = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: 'Novo Vídeo — Fragata Shorts',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar rascunho de vídeo');
      }

      clearStudioVideoCache(data.video.id);
      navigate(`/video/${data.video.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao criar novo projeto'
      );
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo/fragata_shorts_logo.png"
              alt="Fragata Shorts"
              className="h-11 w-auto cursor-pointer object-contain transition-transform hover:scale-105 active:scale-95"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateDraftVideo}
              disabled={isCreating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-amber-500 active:scale-95 disabled:opacity-50"
            >
              <span className="text-base leading-none font-black">+</span>
              <span>{isCreating ? 'Criando...' : 'Nova História'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Histórico de Produções
            </h2>
            <p className="text-xs text-slate-400">
              Rascunhos e vídeos renderizados prontos para edição.
            </p>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-200 shadow-sm transition hover:bg-slate-750 hover:text-white hover:border-amber-500/60"
          >
            <span>Dashboard</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Dashboard Grid: 4 colunas x 2 linhas */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* 
            Na 1ª página, o 1º slot (1ª linha, 1ª coluna) é SEMPRE a box para Criar Nova História.
            Ela NÃO entra no skeleton e permanece disponível mesmo durante o loading.
          */}
          {currentPage === 1 && (
            <div
              onClick={handleCreateDraftVideo}
              className="group relative flex min-h-[380px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-slate-800 bg-slate-900/30 p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/60 hover:bg-amber-500/5 hover:shadow-xl hover:shadow-amber-500/5"
            >
              <span className="text-7xl font-light leading-none group-hover:text-amber-400 transition">+</span>
              <h3 className="mt-5 text-base font-bold text-white group-hover:text-amber-400 transition">
                {isCreating ? 'Abrindo Studio...' : 'Criar Nova História'}
              </h3>
              <p className="mt-1.5 max-w-[210px] text-xs text-slate-400">
                Crie o roteiro da sua história, gere imagens, legendas e vozes.
              </p>
            </div>
          )}

          {/* Skeletons durante o carregamento inicial (7 itens na página 1 completando o grid 4x2) */}
          {isLoading ? (
            Array.from({ length: currentPage === 1 ? SKELETON_ITEMS_COUNT : ITEMS_PER_PAGE_OTHER }).map((_, index) => (
              <HomeVideoCardSkeleton key={`skeleton-${index}`} />
            ))
          ) : (
            /* Cartões dos Vídeos Paginados */
            displayedVideos.map((video) => {
              const firstSelectedSceneImg =
                video.remotionProps?.storyboard?.scenes?.find(
                  (s) => s.selectedImage
                )?.selectedImage;

              const thumbnailSrc =
                firstSelectedSceneImg ||
                video.remotionProps?.backgroundTimeline?.[0]?.imageSrc ||
                video.remotionProps?.backgroundSrc ||
                'background.jpg';

              const resolvedThumb = resolveAssetSrc(thumbnailSrc);
              const dateStr = new Date(video.createdAt).toLocaleDateString(
                'pt-BR',
                {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              );

              return (
                <div
                  key={video.id}
                  onClick={() => {
                    clearStudioVideoCache(video.id);
                    navigate(`/video/${video.id}`);
                  }}
                  className="group relative flex min-h-[380px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:shadow-2xl hover:shadow-black/60"
                >
                  {/* Thumbnail 9:16 Aspect Area */}
                  <div className="relative aspect-[9/16] max-h-[260px] w-full overflow-hidden bg-slate-950">
                    <img
                      src={resolvedThumb}
                      alt={video.theme}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/40" />

                    {/* Play Overlay no Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40">
                        <svg
                          className="h-5 w-5 translate-x-0.5 fill-current"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo do Card */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h4 className="line-clamp-2 text-sm font-bold text-white group-hover:text-amber-400 transition">
                        {video.theme}
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500">
                        ID #{video.id.slice(0, 8)} • {dateStr}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── BARRA DE PAGINAÇÃO NO FINAL DA HOME ─── */}
        {!isLoading && totalVideos > 0 && (
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-6 sm:flex-row">
            <p className="text-xs text-slate-400">
              Mostrando <span className="font-semibold text-slate-200">{startIndex + 1}</span> a{' '}
              <span className="font-semibold text-slate-200">{endIndex}</span> de{' '}
              <span className="font-semibold text-slate-200">{totalVideos}</span> produções
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Anterior</span>
                </button>

                {/* Botões numéricos de página */}
                <div className="flex items-center gap-1">
                  {getVisiblePages(currentPage, totalPages).map((pageItem, idx) => {
                    if (typeof pageItem === 'string') {
                      return (
                        <span key={`dots-${idx}`} className="px-1.5 text-xs text-slate-600">
                          ...
                        </span>
                      );
                    }
                    const isActive = pageItem === currentPage;
                    return (
                      <button
                        key={pageItem}
                        onClick={() => handlePageChange(pageItem)}
                        className={`h-8 min-w-[32px] rounded-xl px-2.5 text-xs font-bold transition ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {pageItem}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-40"
                >
                  <span>Próxima</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
