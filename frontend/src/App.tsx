import React, { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import { TimeMachineVideo } from './remotion/TimeMachineVideo';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarSegment,
  DEFAULT_AVATAR_TIMELINE,
  DEFAULT_SUBTITLES,
  SubtitleItem,
} from './remotion/types';

interface VideoRecord {
  id: string;
  theme: string;
  status: 'PENDING' | 'RENDERED' | 'FAILED' | string;
  videoUrl: string | null;
  createdAt: string;
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<string>(
    'A Erupção do Vesúvio em Pompeia (79 d.C.)'
  );
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(DEFAULT_SUBTITLES);
  const [avatarTimeline, setAvatarTimeline] = useState<AvatarSegment[]>(
    DEFAULT_AVATAR_TIMELINE
  );
  const [activeJob, setActiveJob] = useState<VideoRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Polling assíncrono em GET /api/videos/:id enquanto o vídeo estiver PENDING
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'PENDING') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/videos/${activeJob.id}`);
        if (!response.ok) return;
        const data: VideoRecord = await response.json();
        setActiveJob(data);
      } catch (err) {
        console.error('Erro ao consultar status do vídeo:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJob]);

  const handleSubtitleChange = (index: number, newText: string) => {
    setSubtitles((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, text: newText } : item))
    );
  };

  const handleAvatarChange = (index: number, newSprite: string) => {
    setAvatarTimeline((prev) =>
      prev.map((seg, idx) => (idx === index ? { ...seg, image: newSprite } : seg))
    );
  };

  const handleRenderVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          backgroundSrc: 'background.jpg',
          audioSrc: 'audio.mp3',
          subtitles,
          avatarTimeline,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao iniciar renderização');
      }

      setActiveJob(data.video);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-400">
              ⏳ Máquina do Tempo TikTok — Motor Remotion
            </h1>
            <p className="text-xs text-slate-400">
              Formato 9:16 (1080x1920) • 30 FPS • 450 Frames (15s)
            </p>
          </div>

          {activeJob && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs">
              <span className="text-slate-400">Job #{activeJob.id.slice(0, 8)}:</span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-semibold ${
                  activeJob.status === 'RENDERED'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : activeJob.status === 'FAILED'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'animate-pulse bg-amber-500/20 text-amber-300'
                }`}
              >
                {activeJob.status}
              </span>
              {activeJob.status === 'RENDERED' && activeJob.videoUrl && (
                <a
                  href={activeJob.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-amber-400 underline hover:text-amber-300"
                >
                  Abrir MP4
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-12">
        {/* Coluna Esquerda: Preview em Tempo Real (@remotion/player) */}
        <section className="flex flex-col items-center lg:col-span-5">
          <div className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-2xl">
            <Player
              component={TimeMachineVideo}
              inputProps={{
                theme,
                backgroundSrc: 'background.jpg',
                audioSrc: 'audio.mp3',
                subtitles,
                avatarTimeline,
              }}
              durationInFrames={450}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              style={{
                width: '100%',
                aspectRatio: '9 / 16',
              }}
              controls
              loop
            />
          </div>
        </section>

        {/* Coluna Direita: Configuração da Composição e Disparo para API */}
        <section className="lg:col-span-7">
          <form
            onSubmit={handleRenderVideo}
            className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
          >
            <div>
              <label
                htmlFor="theme-input"
                className="block text-sm font-semibold text-slate-200"
              >
                Tema Histórico (Máquina do Tempo)
              </label>
              <input
                id="theme-input"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Expressões do Avatar por Intervalo */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Timeline de Expressões do Avatar (`frontend/public/avatars/`)
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {avatarTimeline.map((segment, index) => (
                  <div
                    key={`${segment.startSecond}-${segment.endSecond}`}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <span className="block text-xs font-medium text-amber-400">
                      {segment.startSecond}s a {segment.endSecond}s (Frames{' '}
                      {segment.startSecond * 30}–{segment.endSecond * 30})
                    </span>
                    <select
                      value={segment.image}
                      onChange={(e) => handleAvatarChange(index, e.target.value)}
                      className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                    >
                      {AVAILABLE_AVATAR_SPRITES.map((sprite) => (
                        <option key={sprite} value={sprite}>
                          {sprite.replace('avatars/', '')}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Legendas Dinâmicas */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Legendas Dinâmicas (Centro do Ecrã)
              </h2>
              <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {subtitles.map((sub, index) => (
                  <div
                    key={`${sub.frameStart}-${sub.frameEnd}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                  >
                    <span className="w-24 shrink-0 rounded bg-slate-900 px-2 py-1 text-center font-mono text-xs text-slate-400">
                      F {sub.frameStart}–{sub.frameEnd}
                    </span>
                    <input
                      type="text"
                      value={sub.text}
                      onChange={(e) => handleSubtitleChange(index, e.target.value)}
                      className="w-full rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-4 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || activeJob?.status === 'PENDING'}
                className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? 'A enviar pedido...'
                  : activeJob?.status === 'PENDING'
                    ? 'A renderizar no servidor...'
                    : 'Renderizar Vídeo (.mp4) via Express'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

