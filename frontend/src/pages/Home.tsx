import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveAssetSrc, VideoRecord } from '../remotion/types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [_, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
    void fetchVideos();
  }, []);

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

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Cartão 1: Criar Novo Vídeo */}
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

          {/* Cartões dos Vídeos no Histórico */}
          {videos.map((video) => {
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
                onClick={() => navigate(`/video/${video.id}`)}
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
          })}
        </div>
      </main>
    </div>
  );
};
