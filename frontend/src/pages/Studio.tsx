import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Player } from '@remotion/player';
import { TimeMachineVideo } from '../remotion/TimeMachineVideo';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarSegment,
  BackgroundSegment,
  DurationPreset,
  resolveAssetSrc,
  SceneFrameTiming,
  SpeakerType,
  StoryboardScene,
  SubtitleItem,
  TimeMachineVideoProps,
  VideoRecord,
} from '../remotion/types';

const SUGGESTED_THEMES = [
  'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  'A Construção das Pirâmides de Gizé (2560 a.C.)',
  'A Queda da Bastilha na Revolução Francesa (1789)',
  'A Chegada do Homem à Lua com a Apollo 11 (1969)',
];

const SPEAKER_LABELS: Record<SpeakerType, string> = {
  protagonist: 'Protagonista (Viajante POV)',
  character: 'Personagem Histórico (Stick Figure)',
  narrator: 'Narrador (Documentário Épico)',
};

const DURATION_OPTIONS: Array<{ value: DurationPreset; label: string }> = [
  { value: 'short', label: 'Curto (15s - máx 40 palavras)' },
  { value: 'medium', label: 'Médio (30s - máx 70 palavras)' },
  { value: 'long', label: 'Longo (60s - máx 140 palavras)' },
];

export const Studio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Registo principal do banco
  const [videoRecord, setVideoRecord] = useState<VideoRecord | null>(null);

  // Etapa 1: Briefing
  const [theme, setTheme] = useState<string>('');
  const [durationPreset, setDurationPreset] =
    useState<DurationPreset>('short');
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);

  // Etapa 2 & 3: Storyboard e Fábrica Granular
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [generatingImageForScene, setGeneratingImageForScene] = useState<
    Record<number, boolean>
  >({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioGenerated, setAudioGenerated] = useState<boolean>(false);
  const [isAssembled, setIsAssembled] = useState<boolean>(false);
  const [sceneTimings, setSceneTimings] = useState<SceneFrameTiming[]>([]);

  // Dados injetados no @remotion/player após "Montar Vídeo"
  const [durationInFrames, setDurationInFrames] = useState<number>(450);
  const [audioSrc, setAudioSrc] = useState<string>('audio.mp3');
  const [backgroundSrc, setBackgroundSrc] = useState<string>('background.jpg');
  const [backgroundTimeline, setBackgroundTimeline] = useState<
    BackgroundSegment[]
  >([]);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [avatarTimeline, setAvatarTimeline] = useState<AvatarSegment[]>([]);

  // Estados gerais de UI
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRerendering, setIsRerendering] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hydrateFromProps = (
    props: TimeMachineVideoProps,
    recordTheme?: string
  ) => {
    const resolvedTheme =
      props.theme && props.theme !== 'Novo Vídeo — Máquina do Tempo'
        ? props.theme
        : recordTheme && recordTheme !== 'Novo Vídeo — Máquina do Tempo'
          ? recordTheme
          : '';
    setTheme(resolvedTheme);

    if (props.durationInFrames && props.durationInFrames > 0) {
      setDurationInFrames(props.durationInFrames);
    }
    if (props.audioSrc) setAudioSrc(props.audioSrc);
    if (props.backgroundSrc) setBackgroundSrc(props.backgroundSrc);
    if (props.backgroundTimeline) {
      setBackgroundTimeline(props.backgroundTimeline);
    }
    if (props.subtitles) setSubtitles(props.subtitles);
    if (props.avatarTimeline) setAvatarTimeline(props.avatarTimeline);

    if (props.storyboard) {
      setDurationPreset(props.storyboard.durationPreset || 'short');
      setScenes(props.storyboard.scenes || []);
      setAudioGenerated(Boolean(props.storyboard.audioGenerated));
      setIsAssembled(Boolean(props.storyboard.isAssembled));
      setSceneTimings(props.storyboard.sceneTimings || []);
    } else if (
      props.backgroundTimeline &&
      props.backgroundTimeline.length > 0 &&
      props.subtitles &&
      props.subtitles.length > 0
    ) {
      // Compatibilidade retroativa para vídeos antigos já renderizados antes do Storyboard Mode
      setAudioGenerated(true);
      setIsAssembled(true);
      const legacyScenes: StoryboardScene[] = props.backgroundTimeline.map(
        (bg, idx) => ({
          speaker: 'protagonist',
          text:
            props.subtitles?.[idx]?.text ||
            `Cena #${idx + 1} do vídeo renderizado`,
          avatarSprite:
            props.avatarTimeline?.[idx]?.image ||
            'avatars/avatar_greeting.png',
          imagePrompt: 'Cenário histórico previamente gerado',
          sfx_suggestion: '',
          candidateImages: [bg.imageSrc],
          selectedImage: bg.imageSrc,
        })
      );
      setScenes(legacyScenes);
    }
  };

  const fetchVideoData = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) {
        throw new Error(`Falha ao consultar vídeo (${res.status})`);
      }

      const data: VideoRecord = await res.json();
      setVideoRecord(data);

      if (data.remotionProps) {
        hydrateFromProps(data.remotionProps, data.theme);
      } else if (
        data.theme &&
        data.theme !== 'Novo Vídeo — Máquina do Tempo'
      ) {
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

  // Polling automático enquanto estiver a renderizar o MP4 no servidor (status === 'PENDING')
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
        if (data.status === 'RENDERED') {
          setSuccessMsg(
            'MP4 renderizado com sucesso! Clique em "Baixar MP4" no topo.'
          );
        }
      } catch (err) {
        console.error('Erro no polling do vídeo:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [id, videoRecord?.status]);

  // ========================================================
  // ETAPA 1: Gerar Roteiro com IA (POST /api/videos/:id/generate-script)
  // ========================================================
  const handleGenerateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const cleanTheme = theme.trim();
    if (cleanTheme.length < 3) {
      setErrorMsg('Introduza um Tema Histórico com pelo menos 3 caracteres.');
      return;
    }

    setIsGeneratingScript(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: cleanTheme,
          durationPreset,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar roteiro no Gemini');
      }

      setVideoRecord(data.video);
      if (data.video?.remotionProps) {
        hydrateFromProps(data.video.remotionProps, data.video.theme);
      } else if (data.scenes) {
        setScenes(data.scenes);
      }

      setSuccessMsg(
        `Roteiro gerado com ${data.scenes?.length || 0} cenas! Revise as falas e aprove a geração de imagens e narração.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao gerar roteiro com IA'
      );
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // ========================================================
  // ETAPA 2: Edição de Campos do Storyboard (Por Cena)
  // ========================================================
  const handleSceneFieldChange = <K extends keyof StoryboardScene>(
    sceneIndex: number,
    field: K,
    value: StoryboardScene[K]
  ) => {
    setScenes((prev) =>
      prev.map((scene, idx) =>
        idx === sceneIndex ? { ...scene, [field]: value } : scene
      )
    );
  };

  // ========================================================
  // ETAPA 3A: Gerar 2 Imagens B-Roll por Cena (POST /api/videos/:id/generate-scene-images)
  // ========================================================
  const handleGenerateSceneImages = async (sceneIndex: number) => {
    if (!id) return;
    const targetScene = scenes[sceneIndex];
    if (!targetScene) return;

    setGeneratingImageForScene((prev) => ({ ...prev, [sceneIndex]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/generate-scene-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          imagePrompt: targetScene.imagePrompt,
          scenes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || `Falha ao gerar imagens para a cena #${sceneIndex + 1}`
        );
      }

      const generatedUrls: string[] = data.images || [];
      setScenes((prev) =>
        prev.map((scene, idx) =>
          idx === sceneIndex
            ? {
                ...scene,
                candidateImages: generatedUrls,
                selectedImage:
                  scene.selectedImage || generatedUrls[0] || null,
              }
            : scene
        )
      );

      if (data.video) {
        setVideoRecord(data.video);
      }

      setSuccessMsg(
        `2 opções de B-Roll geradas para a Cena #${sceneIndex + 1}! Clique na miniatura favorita para selecioná-la.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : `Erro ao gerar imagens da Cena #${sceneIndex + 1}`
      );
    } finally {
      setGeneratingImageForScene((prev) => ({
        ...prev,
        [sceneIndex]: false,
      }));
    }
  };

  const handleSelectBrollImage = (sceneIndex: number, imageUrl: string) => {
    const updatedScenes = scenes.map((scene, idx) =>
      idx === sceneIndex ? { ...scene, selectedImage: imageUrl } : scene
    );
    setScenes(updatedScenes);

    // Se o vídeo já estiver montado no Player, atualiza também a backgroundTimeline ao vivo
    if (isAssembled && backgroundTimeline.length > sceneIndex) {
      setBackgroundTimeline((prev) =>
        prev.map((seg, idx) =>
          idx === sceneIndex ? { ...seg, imageSrc: imageUrl } : seg
        )
      );
      if (sceneIndex === 0) {
        setBackgroundSrc(imageUrl);
      }
    }
  };

  // ========================================================
  // ETAPA 3B: Gravar Narração Multi-Voz Global (POST /api/videos/:id/generate-audio)
  // ========================================================
  const handleGenerateAudio = async () => {
    if (!id || scenes.length === 0) return;

    setIsGeneratingAudio(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gravar narração na ElevenLabs');
      }

      const narration = data.narration;
      if (narration) {
        setAudioSrc(narration.audioUrl);
        setDurationInFrames(narration.durationInFrames);
        setSubtitles(narration.subtitles || []);
        setAvatarTimeline(narration.avatarTimeline || []);
        setSceneTimings(narration.sceneTimings || []);
        setAudioGenerated(true);
      }

      if (data.video) {
        setVideoRecord(data.video);
      }

      setSuccessMsg(
        'Narração Multi-Voz gravada e concatenada com sucesso! Quando todas as cenas tiverem imagem selecionada, clique em "🎬 Montar Vídeo".'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao gravar narração'
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // ========================================================
  // ETAPA 3C: Montar Vídeo no @remotion/player (PUT /api/videos/:id/storyboard)
  // ========================================================
  const allScenesHaveSelectedImage =
    scenes.length > 0 && scenes.every((s) => Boolean(s.selectedImage));
  const canAssembleVideo = allScenesHaveSelectedImage && audioGenerated;

  const handleAssembleVideo = async () => {
    if (!id || !canAssembleVideo) return;
    setErrorMsg(null);

    const totalFrames = Math.max(30, durationInFrames);
    const framesPerScene = Math.floor(totalFrames / scenes.length);

    const assembledBackgroundTimeline: BackgroundSegment[] = scenes.map(
      (scene, idx) => {
        const timing = sceneTimings[idx];
        const frameStart = timing
          ? timing.frameStart
          : idx * framesPerScene;
        const frameEnd = timing
          ? timing.frameEnd
          : idx === scenes.length - 1
            ? totalFrames
            : (idx + 1) * framesPerScene - 1;

        return {
          imageSrc: scene.selectedImage || 'background.jpg',
          frameStart,
          frameEnd,
        };
      }
    );

    const assembledAvatarTimeline: AvatarSegment[] = scenes.map(
      (scene, idx) => {
        const timing = sceneTimings[idx];
        return {
          startSecond: timing ? timing.startSecond : idx * 4,
          endSecond: timing ? timing.endSecond : (idx + 1) * 4,
          image: scene.avatarSprite,
        };
      }
    );

    const primaryBg =
      assembledBackgroundTimeline[0]?.imageSrc || 'background.jpg';

    setBackgroundSrc(primaryBg);
    setBackgroundTimeline(assembledBackgroundTimeline);
    setAvatarTimeline(assembledAvatarTimeline);
    setIsAssembled(true);

    const payload: TimeMachineVideoProps = {
      theme: theme || 'Vlog de Viagem no Tempo',
      durationInFrames: totalFrames,
      backgroundSrc: primaryBg,
      backgroundTimeline: assembledBackgroundTimeline,
      audioSrc,
      subtitles,
      avatarTimeline: assembledAvatarTimeline,
      storyboard: {
        durationPreset,
        scenes,
        audioGenerated: true,
        isAssembled: true,
        sceneTimings,
      },
    };

    try {
      const res = await fetch(`/api/videos/${id}/storyboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setVideoRecord(data.video);
      }
      setSuccessMsg(
        'Vídeo montado no Player! Confira o preview à esquerda e clique em "Renderizar MP4 no Servidor" quando estiver pronto.'
      );
    } catch (err) {
      console.warn('Aviso ao persistir montagem no banco:', err);
    }
  };

  // ========================================================
  // Renderização Final do MP4 no Servidor (POST /api/videos/:id/rerender)
  // ========================================================
  const handleRenderMp4OnServer = async () => {
    if (!id || !isAssembled) return;
    setIsRerendering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: TimeMachineVideoProps = {
      theme: theme || 'Vlog de Viagem no Tempo',
      durationInFrames,
      backgroundSrc,
      backgroundTimeline,
      audioSrc,
      subtitles,
      avatarTimeline,
      storyboard: {
        durationPreset,
        scenes,
        audioGenerated,
        isAssembled: true,
        sceneTimings,
      },
    };

    try {
      const res = await fetch(`/api/videos/${id}/rerender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao acionar renderização do MP4');
      }

      setVideoRecord(data.video);
      setSuccessMsg(
        'Renderização do MP4 iniciada no servidor! O status atualizará automaticamente assim que concluir.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao renderizar vídeo MP4'
      );
    } finally {
      setIsRerendering(false);
    }
  };

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

  const hasScript = scenes.length > 0;
  const isPending = videoRecord?.status === 'PENDING';
  const selectedImagesCount = scenes.filter((s) =>
    Boolean(s.selectedImage)
  ).length;
  const totalWordsCount = scenes.reduce(
    (acc, s) =>
      acc + (s.text.trim() ? s.text.trim().split(/\s+/).length : 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-3 w-3 animate-ping rounded-full bg-amber-500" />
          <span>A carregar Studio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header da Ilha de Edição */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-900/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-400">
                  STORYBOARD STUDIO
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-xs text-slate-400">
                  #{id?.slice(0, 8)}
                </span>
              </div>
              <h1 className="line-clamp-1 max-w-md text-sm font-bold text-white sm:max-w-xl">
                {theme || 'Etapa 1: Defina o Briefing Histórico'}
              </h1>
            </div>
          </div>

          {/* Indicador de Etapas + Status */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-[11px] font-semibold md:flex">
              <span
                className={
                  !hasScript ? 'text-amber-400 font-bold' : 'text-emerald-400'
                }
              >
                1. Briefing {hasScript ? '✓' : ''}
              </span>
              <span className="text-slate-600">→</span>
              <span
                className={
                  hasScript && !isAssembled
                    ? 'text-amber-400 font-bold'
                    : isAssembled
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                }
              >
                2. Storyboard & B-Roll {isAssembled ? '✓' : ''}
              </span>
              <span className="text-slate-600">→</span>
              <span
                className={
                  isAssembled ? 'text-amber-400 font-bold' : 'text-slate-500'
                }
              >
                3. Preview & MP4
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-md ${
                videoRecord?.status === 'RENDERED'
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                  : videoRecord?.status === 'FAILED'
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                    : videoRecord?.status === 'DRAFT'
                      ? 'border-sky-500/40 bg-sky-500/20 text-sky-300'
                      : 'animate-pulse border-amber-500/40 bg-amber-500/20 text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  videoRecord?.status === 'RENDERED'
                    ? 'bg-emerald-400'
                    : videoRecord?.status === 'FAILED'
                      ? 'bg-rose-400'
                      : videoRecord?.status === 'DRAFT'
                        ? 'bg-sky-400'
                        : 'bg-amber-400'
                }`}
              />
              {videoRecord?.status || 'DRAFT'}
            </span>

            {videoRecord?.status === 'RENDERED' && videoRecord.videoUrl && (
              <a
                href={videoRecord.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md transition hover:bg-amber-400"
              >
                <span>Baixar MP4</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Corpo Principal de Duas Colunas */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-300">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* ========================================================
              COLUNA ESQUERDA (Fixa/Pegajosa):
              - Etapa 1: Formulário de Briefing (se ainda não houver roteiro/montagem)
              - Etapa 2: Checklist de Montagem + Re-gerar Briefing
              - Etapa 3: @remotion/player 9:16 (após clicar em "🎬 Montar Vídeo")
             ======================================================== */}
          <section className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
            {!isAssembled ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  <span>Etapa 1</span>
                  <span>•</span>
                  <span>Briefing do Roteiro</span>
                </div>

                <h2 className="mt-3 text-lg font-extrabold text-white">
                  {hasScript
                    ? 'Configuração do Roteiro Atual'
                    : 'Configurar Novo Vlog no Tempo'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Gere primeiro apenas o JSON do roteiro no Gemini (custo zero de imagem/voz) para revisar antes de produzir os assets.
                </p>

                <form onSubmit={handleGenerateScript} className="mt-5 space-y-4">
                  {/* Input do Tema Histórico */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Tema Histórico
                    </label>
                    <input
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      required
                      disabled={isGeneratingScript}
                      placeholder="Ex: A Erupção do Vesúvio em Pompeia (79 d.C.)"
                      className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Dropdown de Duração */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Duração & Limite de Palavras
                    </label>
                    <select
                      value={durationPreset}
                      onChange={(e) =>
                        setDurationPreset(e.target.value as DurationPreset)
                      }
                      disabled={isGeneratingScript}
                      className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botão Gerar Roteiro com IA */}
                  <button
                    type="submit"
                    disabled={isGeneratingScript || !theme.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGeneratingScript ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        <span>A gerar roteiro no Gemini...</span>
                      </>
                    ) : (
                      <>
                        <span>📝</span>
                        <span>
                          {hasScript
                            ? 'Regerar Roteiro com IA'
                            : 'Gerar Roteiro com IA'}
                        </span>
                      </>
                    )}
                  </button>
                </form>

                {/* Checklist de Progresso para Desbloquear o Player */}
                {hasScript && (
                  <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Status da Montagem
                      </span>
                      <span className="font-mono text-xs text-amber-400">
                        {scenes.length} cenas • {totalWordsCount} palavras
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          1. Roteiro Estruturado:
                        </span>
                        <span className="font-bold text-emerald-400">
                          ✓ Pronto ({scenes.length} cenas)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          2. Imagens B-Roll Selecionadas:
                        </span>
                        <span
                          className={`font-bold ${
                            allScenesHaveSelectedImage
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {selectedImagesCount} / {scenes.length} selecionadas
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">
                          3. Narração Multi-Voz (ElevenLabs):
                        </span>
                        <span
                          className={`font-bold ${
                            audioGenerated
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {audioGenerated ? '✓ Gravada' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Player Remotion 9:16 Ativo após "🎬 Montar Vídeo" */
              <div className="space-y-4">
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

                  {isPending && (
                    <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-900/90 p-3 shadow-xl backdrop-blur">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-2.5 w-2.5 animate-ping rounded-full bg-amber-400" />
                        <span className="text-xs font-bold text-amber-300">
                          A renderizar MP4 no servidor...
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        Auto-sync
                      </span>
                    </div>
                  )}
                </div>

                <div className="mx-auto max-w-[360px] rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span>Duração Total:</span>
                    <span className="font-bold text-white">
                      {durationInFrames} frames (
                      {(durationInFrames / 30).toFixed(1)}s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span>Resolução:</span>
                    <span className="text-amber-400">
                      1080 × 1920 (9:16) • 30 FPS
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAssembled(false)}
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white"
                  >
                    ← Voltar para Configuração de Briefing
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ========================================================
              COLUNA DIREITA (Scrollável):
              - Estado Inicial (Sem Roteiro): Guia das 3 Etapas + Sugestões de Temas
              - Com Roteiro: Barra Global da Fábrica + Cartões de Cena (Storyboard) + Legendas/Render
             ======================================================== */}
          <section className="lg:col-span-7 space-y-6">
            {!hasScript ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
                <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  Fluxo Storyboard em 3 Etapas
                </span>
                <h3 className="mt-4 text-xl font-bold text-white">
                  Controlo Granular sem Desperdício de Créditos
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Comece preenchendo o Tema Histórico e a Duração na coluna à esquerda. Você poderá revisar e editar todo o roteiro antes de acionar o Fal.ai (FLUX.1) ou a ElevenLabs.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-lg">📝 1. Briefing</div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      O Gemini gera o JSON com falas, speakers, expressões do avatar e prompts POV + Stick Figure.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-lg">🎨 2. B-Roll (2x)</div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Ajuste o prompt em inglês e gere 2 variações de imagem por cena para escolher a melhor miniatura.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-lg">🎬 3. Montagem</div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Grave a locução multi-voz, monte no Player 9:16 e exporte o MP4 final.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sugestões Rápidas de Temas (Clique para preencher):
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED_THEMES.map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => setTheme(suggested)}
                        className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-400"
                      >
                        {suggested}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ========================================================
                    PAINEL GLOBAL DA FÁBRICA (Passo 3: Gravar Narração & Montar Vídeo)
                   ======================================================== */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        Etapa 3 • Fábrica Global
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Produção de Áudio & Montagem Final
                      </h3>
                      <p className="text-xs text-slate-400">
                        Grave a narração com as 3 vozes e selecione 1 imagem B-Roll em cada cena para habilitar a montagem.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Botão Global: Gravar Narração */}
                      <button
                        type="button"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio || scenes.length === 0}
                        className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isGeneratingAudio ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                            <span>A gravar vozes...</span>
                          </>
                        ) : (
                          <>
                            <span>🎙️</span>
                            <span>
                              {audioGenerated
                                ? 'Regravar Narração'
                                : 'Gravar Narração'}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Botão Global: Montar Vídeo */}
                      <button
                        type="button"
                        onClick={handleAssembleVideo}
                        disabled={!canAssembleVideo}
                        title={
                          !canAssembleVideo
                            ? 'Selecione 1 imagem em todas as cenas e grave a narração primeiro'
                            : 'Injetar dados no Remotion Player'
                        }
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>🎬</span>
                        <span>Montar Vídeo</span>
                      </button>
                    </div>
                  </div>

                  {/* Player de Áudio Rápido quando a locução já foi gerada */}
                  {audioGenerated && audioSrc && (
                    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                        <span>✓ Áudio Multi-Voz Sincronizado</span>
                        <span className="font-mono text-slate-400">
                          ({(durationInFrames / 30).toFixed(1)}s •{' '}
                          {subtitles.length} legendas)
                        </span>
                      </div>
                      <audio
                        controls
                        src={resolveAssetSrc(audioSrc)}
                        className="h-8 max-w-xs"
                      />
                    </div>
                  )}
                </div>

                {/* ========================================================
                    LISTA DE CARTÕES DO STORYBOARD (Passo 2 & Passo 3 por Cena)
                   ======================================================== */}
                <div className="space-y-5">
                  {scenes.map((scene, index) => {
                    const isGeneratingImg = Boolean(
                      generatingImageForScene[index]
                    );
                    const spriteUrl = resolveAssetSrc(scene.avatarSprite);

                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg transition hover:border-slate-700/80"
                      >
                        {/* Cabeçalho do Cartão da Cena */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 font-mono text-xs font-black text-slate-950">
                              #{index + 1}
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-white">
                                Cena {index + 1}
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                {SPEAKER_LABELS[scene.speaker]}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {scene.selectedImage ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                                ✓ Imagem Selecionada
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                                Aguardando B-Roll
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Corpo do Cartão da Cena */}
                        <div className="mt-4 space-y-4">
                          {/* 1. Texto da Fala */}
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                              Texto da Fala (Narrado)
                            </label>
                            <textarea
                              rows={2}
                              value={scene.text}
                              onChange={(e) =>
                                handleSceneFieldChange(
                                  index,
                                  'text',
                                  e.target.value
                                )
                              }
                              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* 2. Grid: Casting de Voz (Speaker) + Expressão do Avatar + SFX Injection */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {/* Casting de Voz (Speaker) */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Casting de Voz (Speaker)
                              </label>
                              <select
                                value={scene.speaker}
                                onChange={(e) =>
                                  handleSceneFieldChange(
                                    index,
                                    'speaker',
                                    e.target.value as SpeakerType
                                  )
                                }
                                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                              >
                                <option value="protagonist">
                                  protagonist (Viajante)
                                </option>
                                <option value="character">
                                  character (Histórico)
                                </option>
                                <option value="narrator">
                                  narrator (Documentário)
                                </option>
                              </select>
                            </div>

                            {/* Expressão do Avatar */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Expressão do Avatar
                              </label>
                              <div className="mt-1.5 flex items-center gap-2">
                                <img
                                  src={spriteUrl}
                                  alt="Avatar"
                                  className="h-8 w-8 shrink-0 rounded-lg border border-slate-800 bg-slate-950 object-contain p-0.5"
                                />
                                <select
                                  value={scene.avatarSprite}
                                  onChange={(e) =>
                                    handleSceneFieldChange(
                                      index,
                                      'avatarSprite',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                                >
                                  {AVAILABLE_AVATAR_SPRITES.map((sprite) => (
                                    <option key={sprite} value={sprite}>
                                      {sprite
                                        .replace('avatars/avatar_', '')
                                        .replace('.png', '')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* SFX Injection */}
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Efeito Sonoro Sugerido (SFX)
                              </label>
                              <input
                                type="text"
                                value={scene.sfx_suggestion || ''}
                                onChange={(e) =>
                                  handleSceneFieldChange(
                                    index,
                                    'sfx_suggestion',
                                    e.target.value
                                  )
                                }
                                placeholder="Ex: Som de explosão"
                                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* 3. Direção de Arte (imagePrompt em Inglês) */}
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                                Direção de Arte (Image Prompt em Inglês)
                              </label>
                              <button
                                type="button"
                                onClick={() => handleGenerateSceneImages(index)}
                                disabled={
                                  isGeneratingImg || !scene.imagePrompt.trim()
                                }
                                className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-slate-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isGeneratingImg ? (
                                  <>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    <span>A gerar 2 opções...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🎨</span>
                                    <span>
                                      {scene.candidateImages?.length > 0
                                        ? 'Regerar Imagens (2x)'
                                        : 'Gerar Imagens'}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>

                            <textarea
                              rows={3}
                              value={scene.imagePrompt}
                              onChange={(e) =>
                                handleSceneFieldChange(
                                  index,
                                  'imagePrompt',
                                  e.target.value
                                )
                              }
                              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-300 focus:border-amber-500 focus:outline-none"
                            />
                          </div>

                          {/* 4. Seletor de Miniaturas B-Roll (2 variações geradas) */}
                          {scene.candidateImages &&
                            scene.candidateImages.length > 0 && (
                              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                                <p className="mb-2.5 text-xs font-semibold text-slate-300">
                                  Escolha a imagem oficial da Cena #{index + 1}{' '}
                                  (B-Roll):
                                </p>
                                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                                  {scene.candidateImages.map(
                                    (imgUrl, optIdx) => {
                                      const isSelected =
                                        scene.selectedImage === imgUrl;
                                      return (
                                        <div
                                          key={`${optIdx}-${imgUrl}`}
                                          onClick={() =>
                                            handleSelectBrollImage(
                                              index,
                                              imgUrl
                                            )
                                          }
                                          className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                                            isSelected
                                              ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                                              : 'border-slate-800 opacity-75 hover:border-slate-600 hover:opacity-100'
                                          }`}
                                        >
                                          <div className="aspect-[9/16] max-h-52 w-full bg-black">
                                            <img
                                              src={resolveAssetSrc(imgUrl)}
                                              alt={`Cena ${index + 1} - Opção ${optIdx + 1}`}
                                              className="h-full w-full object-cover"
                                            />
                                          </div>
                                          <div
                                            className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold ${
                                              isSelected
                                                ? 'bg-amber-500 text-slate-950'
                                                : 'bg-slate-900 text-slate-300'
                                            }`}
                                          >
                                            <span>Opção {optIdx + 1}</span>
                                            <span>
                                              {isSelected
                                                ? '✓ Oficial'
                                                : 'Selecionar'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ========================================================
                    AJUSTE FINO DE LEGENDAS & RENDERIZAÇÃO MP4 (Visível após Montar Vídeo)
                   ======================================================== */}
                {isAssembled && (
                  <>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Legendas Sincronizadas (TikTok Style)
                          </h3>
                          <p className="text-xs text-slate-400">
                            Ajuste fino opcional de frames e blocos de texto
                          </p>
                        </div>
                        <span className="rounded-md bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-300">
                          {subtitles.length} blocos
                        </span>
                      </div>

                      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {subtitles.map((sub, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950 p-2"
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
                              />
                            </div>

                            <input
                              type="text"
                              value={sub.text}
                              onChange={(e) =>
                                handleSubtitleChange(
                                  index,
                                  'text',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Barra Fixa Inferior para Renderizar MP4 no Servidor */}
                    <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Vídeo Montado e Pronto para Exportação!
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Renderiza o ficheiro .mp4 final no servidor usando os assets aprovados (sem custo extra de IA).
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRenderMp4OnServer}
                        disabled={isRerendering || isPending}
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRerendering || isPending ? (
                          <span>A renderizar MP4...</span>
                        ) : (
                          <>
                            <span>🚀</span>
                            <span>Renderizar MP4 no Servidor</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
