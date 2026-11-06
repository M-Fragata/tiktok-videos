import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Player } from '@remotion/player';
import { TimeMachineVideo } from '../remotion/TimeMachineVideo';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarSegment,
  BackgroundSegment,
  DEFAULT_AVATAR_TIMELINE,
  DEFAULT_BACKGROUND_TIMELINE,
  DEFAULT_SUBTITLES,
  defaultTimeMachineProps,
  resolveAssetSrc,
  SubtitleItem,
  TimeMachineVideoProps,
  VideoRecord,
} from '../remotion/types';

export const Studio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [videoRecord, setVideoRecord] = useState<VideoRecord | null>(null);
  const [theme, setTheme] = useState<string>(defaultTimeMachineProps.theme);
  const [durationInFrames, setDurationInFrames] = useState<number>(
    defaultTimeMachineProps.durationInFrames || 450
  );
  const [audioSrc, setAudioSrc] = useState<string>(
    defaultTimeMachineProps.audioSrc || 'audio.mp3'
  );
  const [backgroundSrc, setBackgroundSrc] = useState<string>(
    defaultTimeMachineProps.backgroundSrc || 'background.jpg'
  );
  const [backgroundTimeline, setBackgroundTimeline] = useState<
    BackgroundSegment[]
  >(DEFAULT_BACKGROUND_TIMELINE);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>(DEFAULT_SUBTITLES);
  const [avatarTimeline, setAvatarTimeline] = useState<AvatarSegment[]>(
    DEFAULT_AVATAR_TIMELINE
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRerendering, setIsRerendering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const applyProps = (props: TimeMachineVideoProps) => {
    if (props.theme) setTheme(props.theme);
    if (props.durationInFrames && props.durationInFrames > 0) {
      setDurationInFrames(props.durationInFrames);
    }
    if (props.audioSrc) setAudioSrc(props.audioSrc);
    if (props.backgroundSrc) setBackgroundSrc(props.backgroundSrc);
    if (props.backgroundTimeline && props.backgroundTimeline.length > 0) {
      setBackgroundTimeline(props.backgroundTimeline);
    }
    if (props.subtitles && props.subtitles.length > 0) {
      setSubtitles(props.subtitles);
    }
    if (props.avatarTimeline && props.avatarTimeline.length > 0) {
      setAvatarTimeline(props.avatarTimeline);
    }
  };

  // Carregamento inicial do vídeo
  const fetchVideoData = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          // Se for ID fictício/mock ainda não persistido
          setVideoRecord({
            id,
            theme,
            status: 'PENDING',
            videoUrl: null,
            remotionProps: null,
            createdAt: new Date().toISOString(),
          });
          return;
        }
        throw new Error(`Falha ao consultar vídeo (${res.status})`);
      }

      const data: VideoRecord = await res.json();
      setVideoRecord(data);

      if (data.remotionProps) {
        applyProps(data.remotionProps);
      } else if (data.theme) {
        setTheme(data.theme);
      }
    } catch (err) {
      console.warn('Aviso ao carregar dados do vídeo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchVideoData();
  }, [id]);

  // Polling automático enquanto o status for PENDING
  useEffect(() => {
    if (!id || !videoRecord || videoRecord.status !== 'PENDING') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${id}`);
        if (!res.ok) return;
        const data: VideoRecord = await res.json();
        setVideoRecord(data);

        if (data.remotionProps) {
          applyProps(data.remotionProps);
        }
      } catch (err) {
        console.error('Erro no polling do vídeo:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [id, videoRecord?.status]);

  const handleSubtitleChange = (
    index: number,
    field: keyof SubtitleItem,
    value: string | number
  ) => {
    setSubtitles((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAvatarChange = (index: number, newSprite: string) => {
    setAvatarTimeline((prev) =>
      prev.map((seg, idx) =>
        idx === index ? { ...seg, image: newSprite } : seg
      )
    );
  };

  // Re-renderização no servidor sem custo de IA (POST /api/videos/:id/rerender)
  const handleRerender = async () => {
    if (!id) return;
    setIsRerendering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: TimeMachineVideoProps = {
      theme,
      durationInFrames,
      backgroundSrc,
      backgroundTimeline,
      audioSrc,
      subtitles,
      avatarTimeline,
    };

    try {
      const res = await fetch(`/api/videos/${id}/rerender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao acionar re-renderização');
      }

      setVideoRecord(data.video);
      setSuccessMsg('Re-renderização iniciada em background!');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao re-renderizar vídeo'
      );
    } finally {
      setIsRerendering(false);
    }
  };

  const isPending = videoRecord?.status === 'PENDING';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header da Ilha de Edição */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition"
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-400 font-bold">
                  STUDIO
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-mono">
                  #{id?.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-sm font-bold text-white line-clamp-1 max-w-md sm:max-w-xl">
                {theme}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border shadow-md ${
                videoRecord?.status === 'RENDERED'
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                  : videoRecord?.status === 'FAILED'
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                    : 'animate-pulse border-amber-500/40 bg-amber-500/20 text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  videoRecord?.status === 'RENDERED'
                    ? 'bg-emerald-400'
                    : videoRecord?.status === 'FAILED'
                      ? 'bg-rose-400'
                      : 'bg-amber-400'
                }`}
              />
              {videoRecord?.status || 'PENDING'}
            </span>

            {videoRecord?.status === 'RENDERED' && videoRecord.videoUrl && (
              <a
                href={videoRecord.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 transition"
              >
                <span>Baixar MP4</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Studio Body: Layout de Duas Colunas */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* ========================================================
              Coluna Esquerda (Fixa/Pegajosa): Player Remotion 9:16
             ======================================================== */}
          <section className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl border border-slate-800 bg-black shadow-2xl shadow-black/80">
              <Player
                component={TimeMachineVideo}
                inputProps={{
                  theme,
                  durationInFrames,
                  backgroundSrc,
                  backgroundTimeline,
                  audioSrc,
                  subtitles,
                  avatarTimeline,
                }}
                durationInFrames={Math.max(30, durationInFrames)}
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

              {/* Overlay suave quando está PENDING */}
              {isPending && (
                <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-900/90 p-3 shadow-xl backdrop-blur">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-bold text-amber-300">
                      A renderizar no servidor...
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Auto-sync
                  </span>
                </div>
              )}
            </div>

            <div className="mx-auto mt-4 max-w-[360px] rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3.5 text-xs text-slate-400">
              <div className="flex items-center justify-between font-mono">
                <span>Duração Total:</span>
                <span className="font-bold text-white">
                  {durationInFrames} frames ({(durationInFrames / 30).toFixed(1)}s)
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono">
                <span>Formato TikTok:</span>
                <span className="text-amber-400">1080 × 1920 (9:16) • 30 FPS</span>
              </div>
            </div>
          </section>

          {/* ========================================================
              Coluna Direita (Scrollável): Painéis de Controlo
             ======================================================== */}
          <section className="lg:col-span-7 space-y-6">
            {errorMsg && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                {successMsg}
              </div>
            )}

            {/* Painel 0: Título do Tema */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Tema do Vídeo
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Painel 1: Cenários Dinâmicos (Hard Cut) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Cenários Dinâmicos (Hard Cut)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cortes secos sincronizados com o frame inicial de cada frase
                  </p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300">
                  {backgroundTimeline.length} cenários
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {backgroundTimeline.map((bg, idx) => {
                  const resolvedImg = resolveAssetSrc(bg.imageSrc);
                  return (
                    <div
                      key={`${idx}-${bg.frameStart}`}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs"
                    >
                      <div className="aspect-[9/16] max-h-36 w-full overflow-hidden rounded-lg bg-black">
                        <img
                          src={resolvedImg}
                          alt={`Cena ${idx + 1}`}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between font-semibold text-slate-200">
                        <span className="text-amber-400">Cena #{idx + 1}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          F {bg.frameStart}–{bg.frameEnd}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Painel 2: Expressões do Avatar */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Expressões do Avatar
                  </h3>
                  <p className="text-xs text-slate-400">
                    Troca automática de humor do personagem principal
                  </p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300">
                  {avatarTimeline.length} segmentos
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {avatarTimeline.map((segment, index) => {
                  const spritePath = resolveAssetSrc(segment.image);
                  return (
                    <div
                      key={`${index}-${segment.startSecond}`}
                      className="flex flex-col items-center rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs"
                    >
                      <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-900 p-1 border border-slate-800">
                        <img
                          src={spritePath}
                          alt="Sprite Avatar"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span className="mt-2 font-mono text-[11px] text-amber-400 font-bold">
                        {segment.startSecond.toFixed(1)}s a{' '}
                        {segment.endSecond.toFixed(1)}s
                      </span>
                      <select
                        value={segment.image}
                        onChange={(e) =>
                          handleAvatarChange(index, e.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      >
                        {AVAILABLE_AVATAR_SPRITES.map((sprite) => (
                          <option key={sprite} value={sprite}>
                            {sprite.replace('avatars/', '')}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Painel 3: Legendas Sincronizadas */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Legendas Sincronizadas (TikTok Style)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ajuste fino de frames e textos curtos (3 a 5 palavras por tela)
                  </p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300">
                  {subtitles.length} blocos
                </span>
              </div>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {subtitles.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950 p-2.5 transition hover:border-slate-700"
                  >
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <input
                        type="number"
                        value={sub.frameStart}
                        onChange={(e) =>
                          handleSubtitleChange(
                            index,
                            'frameStart',
                            Number(e.target.value)
                          )
                        }
                        className="w-16 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-center text-slate-200 focus:border-amber-500 focus:outline-none"
                        title="Frame Inicial"
                      />
                      <span className="text-slate-500">–</span>
                      <input
                        type="number"
                        value={sub.frameEnd}
                        onChange={(e) =>
                          handleSubtitleChange(
                            index,
                            'frameEnd',
                            Number(e.target.value)
                          )
                        }
                        className="w-16 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-center text-slate-200 focus:border-amber-500 focus:outline-none"
                        title="Frame Final"
                      />
                    </div>

                    <input
                      type="text"
                      value={sub.text}
                      onChange={(e) =>
                        handleSubtitleChange(index, 'text', e.target.value)
                      }
                      className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Barra Fixa de Ação no Fundo */}
            <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur shadow-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white">
                  Pronto para atualizar o MP4 final?
                </p>
                <p className="text-[11px] text-slate-400">
                  Re-renderiza no servidor usando os assets já gerados (zero custo de IA).
                </p>
              </div>

              <button
                type="button"
                onClick={handleRerender}
                disabled={isRerendering || isPending}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRerendering ? (
                  <span>A processar re-renderização...</span>
                ) : (
                  <>
                    <span>🎬</span>
                    <span>Re-renderizar no Servidor</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

