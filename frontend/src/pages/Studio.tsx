import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Player, PlayerRef } from '@remotion/player';
import { TimeMachineVideo } from '../remotion/TimeMachineVideo';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarConfig,
  AvatarSegment,
  BackgroundSegment,
  BgmVibe,
  BriefingBgmOption,
  ContentBalance,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_SUBTITLE_STYLE,
  DurationPreset,
  ensureSubtitleWordTimings,
  EpisodeFormat,
  getSceneDialogues,
  getSceneFullText,
  getSceneSfxList,
  resolveSfxAudioUrl,
  SfxItem,
  IdeationOption,
  injectAvatarConfigIntoPrompt,
  ProtagonistAgency,
  resolveAssetSrc,
  SceneFrameTiming,
  SeriesContext,
  SeriesSummary,
  SfxOption,
  SFX_OPTIONS,
  SpeakerType,
  splitSceneTextIntoSubtitleChunks,
  StoryboardScene,
  SubtitleAnimationType,
  SubtitleFontFamily,
  SubtitleItem,
  SubtitleStyleConfig,
  TimeMachineVideoProps,
  VideoRecord,
  VoiceCatalog,
} from '../remotion/types';
import {
  fetchVoiceCatalog,
  getCachedVoiceCatalog,
} from '../services/voiceCatalog';
import { VoicePreviewButton } from '../components/VoicePreviewButton';
import {
  IdeationDressingRoomTab,
  SelectedFinalSceneItem,
} from '../components/IdeationDressingRoomTab';
import { clearStudioVideoCache } from '../services/studioCache';

type InspectorTab =
  | 'briefing'
  | 'storyboard'
  | 'subtitles'
  | 'audio'
  | 'extra1'
  | 'extra2';

const SUGGESTED_THEMES = [
  'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  'A Construção das Pirâmides de Gizé (2560 a.C.)',
  'A Queda da Bastilha na Revolução Francesa (1789)',
  'A Chegada do Homem à Lua com a Apollo 11 (1969)',
];

const DURATION_OPTIONS: Array<{ value: DurationPreset; label: string }> = [
  { value: 'short', label: 'Curto (15s • 32 a 42 pal.)' },
  { value: 'medium', label: 'Médio (30s • 65 a 78 pal.)' },
  { value: 'long', label: 'Longo (65s • 145 a 175 pal. - Monetização)' },
];

/**
 * Formata frames (30 fps) para MM:SS (ex: 00:02 / 00:15)
 */
const formatShortTime = (frame: number, fps = 30): string => {
  const safeFrame = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(safeFrame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Alturas pseudo-aleatórias determinísticas para desenhar as ondas de áudio (waveform) na faixa de áudio
 */
const WAVEFORM_BARS = Array.from({ length: 76 }, (_, i) => {
  const v = Math.sin(i * 0.65) * 0.4 + Math.cos(i * 1.35) * 0.35 + 0.5;
  return Math.max(16, Math.min(92, Math.round(v * 100)));
});

/**
 * Gera uma assinatura (fingerprint) determinística de todo o estado visual e sonoro do vídeo.
 * Usada para saber se o arquivo .mp4 já renderizado corresponde exatamente ao estado atual do Studio
 * ou se o utilizador fez alguma alteração que exige nova renderização antes do download.
 */
function computeRenderSignature(params: {
  durationInFrames: number;
  backgroundSrc: string;
  backgroundTimeline: BackgroundSegment[];
  audioSrc: string;
  bgmVibe: BgmVibe;
  bgmVolume?: number;
  globalSfxMultiplier?: number;
  autoDucking?: boolean;
  subtitles: SubtitleItem[];
  subtitleStyle: SubtitleStyleConfig;
  avatarTimeline: AvatarSegment[];
  scenes: Array<{
    speaker?: string;
    text?: string;
    dialogues?: unknown[];
    avatarSprite: string;
    selectedImage?: string | null;
  }>;
}): string {
  return JSON.stringify({
    durationInFrames: params.durationInFrames,
    backgroundSrc: params.backgroundSrc,
    backgroundTimeline: params.backgroundTimeline.map((b) => ({
      imageSrc: b.imageSrc,
      frameStart: b.frameStart,
      frameEnd: b.frameEnd,
    })),
    audioSrc: params.audioSrc,
    bgmVibe: params.bgmVibe,
    bgmVolume: params.bgmVolume ?? 0.1,
    globalSfxMultiplier: params.globalSfxMultiplier ?? 1.0,
    autoDucking: params.autoDucking ?? true,
    subtitles: params.subtitles.map((s) => ({
      text: s.text,
      frameStart: s.frameStart,
      frameEnd: s.frameEnd,
      words: s.words,
    })),
    subtitleStyle: params.subtitleStyle,
    avatarTimeline: params.avatarTimeline.map((a) => ({
      startSecond: a.startSecond,
      endSecond: a.endSecond,
      image: a.image,
    })),
    scenes: params.scenes.map((sc) => ({
      speaker: sc.speaker,
      text: sc.text,
      dialogues: sc.dialogues,
      avatarSprite: sc.avatarSprite,
      selectedImage: sc.selectedImage || null,
    })),
  });
}

function buildMp4DownloadFileName(themeTitle: string): string {
  const slug =
    (themeTitle || 'video')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50) || 'video';
  return `fragata-shorts-${slug}.mp4`;
}

export const Studio: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<PlayerRef>(null);

  // Registo principal do banco
  const [videoRecord, setVideoRecord] = useState<VideoRecord | null>(null);

  // Navegação de Abas Horizontais do Painel Esquerdo com Cache por Vídeo
  const [activeTab, setActiveTabState] = useState<InspectorTab>(() => {
    if (!id) return 'briefing';
    try {
      const cached = localStorage.getItem(`studio_active_tab_${id}`);
      if (
        cached &&
        ['briefing', 'storyboard', 'subtitles', 'audio', 'extra1', 'extra2'].includes(cached)
      ) {
        return cached as InspectorTab;
      }
    } catch {
      /* ignore storage error */
    }
    return 'briefing';
  });

  const setActiveTab = (tab: InspectorTab) => {
    setActiveTabState(tab);
    if (id) {
      try {
        localStorage.setItem(`studio_active_tab_${id}`, tab);
      } catch {
        /* ignore storage error */
      }
    }
  };

  useEffect(() => {
    if (!id) return;
    try {
      const cached = localStorage.getItem(`studio_active_tab_${id}`);
      if (
        cached &&
        ['briefing', 'storyboard', 'subtitles', 'audio', 'extra1', 'extra2'].includes(cached)
      ) {
        setActiveTabState(cached as InspectorTab);
      }
    } catch {
      /* ignore storage error */
    }
  }, [id]);

  // Controlo de recolhimento (accordion) dos cards de cena (Padrão: todas recolhidas)
  const [collapsedScenes, setCollapsedScenes] = useState<
    Record<number, boolean>
  >(() => {
    if (!id) return {};
    try {
      const saved = localStorage.getItem(`studio_collapsed_scenes_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore storage error */
    }
    return {};
  });

  useEffect(() => {
    if (!id) return;
    try {
      const saved = localStorage.getItem(`studio_collapsed_scenes_${id}`);
      if (saved) {
        setCollapsedScenes(JSON.parse(saved));
      } else {
        setCollapsedScenes({});
      }
    } catch {
      /* ignore storage error */
    }
  }, [id]);

  // Estados de recolhimento dos cards na aba Legendas (Padrão: todas recolhidas)
  const [isSubtitleStyleCollapsed, setIsSubtitleStyleCollapsed] =
    useState<boolean>(() => {
      if (!id) return true;
      try {
        const saved = localStorage.getItem(`studio_sub_style_collapsed_${id}`);
        if (saved !== null) return saved === 'true';
      } catch {
        /* ignore storage error */
      }
      return true;
    });

  const [isSubtitleBlocksCollapsed, setIsSubtitleBlocksCollapsed] =
    useState<boolean>(() => {
      if (!id) return true;
      try {
        const saved = localStorage.getItem(`studio_sub_blocks_collapsed_${id}`);
        if (saved !== null) return saved === 'true';
      } catch {
        /* ignore storage error */
      }
      return true;
    });

  const toggleSubtitleStyleCollapsed = () => {
    setIsSubtitleStyleCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_sub_style_collapsed_${id}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  const toggleSubtitleBlocksCollapsed = () => {
    setIsSubtitleBlocksCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_sub_blocks_collapsed_${id}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  // Etapa 1: Sala de Ideação & Camarim 360º
  const [theme, setTheme] = useState<string>('');
  const [durationPreset, setDurationPreset] =
    useState<DurationPreset>('short');
  const [bgmVibe, setBgmVibe] = useState<BriefingBgmOption>('auto');
  const effectiveBgmVibe: BgmVibe = bgmVibe === 'auto' ? 'epic' : bgmVibe;
  const [episodeFormat, setEpisodeFormat] = useState<EpisodeFormat>('single');
  const [seriesContext, setSeriesContext] = useState<SeriesContext>({
    isContinuation: false,
    seriesId: '',
    seriesTitle: '',
    episodeNumber: 1,
    previousContext: '',
  });
  const [availableSeries, setAvailableSeries] = useState<SeriesSummary[]>([]);
  const [protagonistAgency, setProtagonistAgency] =
    useState<ProtagonistAgency>('chaos_agent');
  const [contentBalance, setContentBalance] =
    useState<ContentBalance>('balanced');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    DEFAULT_AVATAR_CONFIG
  );
  const [ideationOptions, setIdeationOptions] = useState<IdeationOption[]>([]);
  const [finalMixScenes, setFinalMixScenes] = useState<
    SelectedFinalSceneItem[]
  >([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [isApprovingScript, setIsApprovingScript] = useState<boolean>(false);

  // Etapa 2 & 3: Storyboard e Fábrica Granular
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [generatingImageForScene, setGeneratingImageForScene] = useState<
    Record<number, boolean>
  >({});
  const [isUploadingManualImage, setIsUploadingManualImage] = useState<
    Record<number, boolean>
  >({});
  const [generatingPromptForScene, setGeneratingPromptForScene] = useState<
    Record<number, boolean>
  >({});
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [audioGenerated, setAudioGenerated] = useState<boolean>(false);
  const [isAssembled, setIsAssembled] = useState<boolean>(false);
  const [sceneTimings, setSceneTimings] = useState<SceneFrameTiming[]>([]);

  // Dados injetados no @remotion/player
  const [durationInFrames, setDurationInFrames] = useState<number>(450);
  const [audioSrc, setAudioSrc] = useState<string>('audio.mp3');
  const [backgroundSrc, setBackgroundSrc] = useState<string>('background.jpg');
  const [backgroundTimeline, setBackgroundTimeline] = useState<
    BackgroundSegment[]
  >([]);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleConfig>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [avatarTimeline, setAvatarTimeline] = useState<AvatarSegment[]>([]);

  // Estados de Mixagem Global de Áudio (Aba Inferior "Áudio")
  const [globalSfxMultiplier, setGlobalSfxMultiplier] = useState<number>(1.0);
  const [bgmVolume, setBgmVolume] = useState<number>(0.1);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [playingSfxPreview, setPlayingSfxPreview] = useState<string | null>(null);

  // Estados de recolhimento dos cards na aba Áudio (Padrão: todas recolhidas)
  const [isAudioNarrationCollapsed, setIsAudioNarrationCollapsed] =
    useState<boolean>(() => {
      if (!id) return true;
      try {
        const saved = localStorage.getItem(`studio_audio_narration_collapsed_${id}`);
        if (saved !== null) return saved === 'true';
      } catch {
        /* ignore storage error */
      }
      return true;
    });

  const [isAudioMixerCollapsed, setIsAudioMixerCollapsed] = useState<boolean>(() => {
    if (!id) return true;
    try {
      const saved = localStorage.getItem(`studio_audio_mixer_collapsed_${id}`);
      if (saved !== null) return saved === 'true';
    } catch {
      /* ignore storage error */
    }
    return true;
  });

  const [isAudioSfxCollapsed, setIsAudioSfxCollapsed] = useState<boolean>(() => {
    if (!id) return true;
    try {
      const saved = localStorage.getItem(`studio_audio_sfx_collapsed_${id}`);
      if (saved !== null) return saved === 'true';
    } catch {
      /* ignore storage error */
    }
    return true;
  });

  const toggleAudioNarrationCollapsed = () => {
    setIsAudioNarrationCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_audio_narration_collapsed_${id}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  const toggleAudioMixerCollapsed = () => {
    setIsAudioMixerCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_audio_mixer_collapsed_${id}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  const toggleAudioSfxCollapsed = () => {
    setIsAudioSfxCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_audio_sfx_collapsed_${id}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!id) return;
    try {
      const savedSubStyle = localStorage.getItem(`studio_sub_style_collapsed_${id}`);
      if (savedSubStyle !== null) {
        setIsSubtitleStyleCollapsed(savedSubStyle === 'true');
      } else {
        setIsSubtitleStyleCollapsed(true);
      }

      const savedSubBlocks = localStorage.getItem(`studio_sub_blocks_collapsed_${id}`);
      if (savedSubBlocks !== null) {
        setIsSubtitleBlocksCollapsed(savedSubBlocks === 'true');
      } else {
        setIsSubtitleBlocksCollapsed(true);
      }

      const savedNarration = localStorage.getItem(`studio_audio_narration_collapsed_${id}`);
      if (savedNarration !== null) {
        setIsAudioNarrationCollapsed(savedNarration === 'true');
      } else {
        setIsAudioNarrationCollapsed(true);
      }

      const savedMixer = localStorage.getItem(`studio_audio_mixer_collapsed_${id}`);
      if (savedMixer !== null) {
        setIsAudioMixerCollapsed(savedMixer === 'true');
      } else {
        setIsAudioMixerCollapsed(true);
      }

      const savedSfx = localStorage.getItem(`studio_audio_sfx_collapsed_${id}`);
      if (savedSfx !== null) {
        setIsAudioSfxCollapsed(savedSfx === 'true');
      } else {
        setIsAudioSfxCollapsed(true);
      }
    } catch {
      /* ignore storage error */
    }
  }, [id]);

  // Ao sair da página do vídeo (navegar para Home, Dashboard, etc.), limpa o cache para que
  // ao retornar o vídeo inicie limpo com todas as abas e seções recolhidas.
  useEffect(() => {
    return () => {
      if (id) {
        clearStudioVideoCache(id);
      }
    };
  }, [id]);

  // Biblioteca de Efeitos Sonoros Reutilizáveis (Padrões + CustomSfx)
  const [sfxLibraryOptions, setSfxLibraryOptions] =
    useState<SfxOption[]>(SFX_OPTIONS);
  const [promotingSfxSceneIndex, setPromotingSfxSceneIndex] = useState<
    number | null
  >(null);
  const [generatingSfxSceneIndex, setGeneratingSfxSceneIndex] = useState<
    number | null
  >(null);

  // Estado de Reprodução do Player & Agulha da Timeline
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isScrubbingTimeline, setIsScrubbingTimeline] =
    useState<boolean>(false);
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState<boolean>(false);

  // Modal de Visualização Ampliada de Cenário B-Roll
  const [previewBrollModal, setPreviewBrollModal] = useState<{
    sceneIndex: number;
    optionIndex: number;
    imageUrl: string;
  } | null>(null);

  // Estados gerais de UI & Redimensionamento de Colunas (Split Pane)
  const [sidebarWidth, setSidebarWidth] = useState<number>(420);
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRerendering, setIsRerendering] = useState<boolean>(false);
  const [isDownloadingMp4, setIsDownloadingMp4] = useState<boolean>(false);
  const [lastRenderedSignature, setLastRenderedSignature] = useState<
    string | null
  >(null);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const [isSavingTitle, setIsSavingTitle] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('');
  const [isDeletingVideo, setIsDeletingVideo] = useState<boolean>(false);
  const [voiceCatalog, setVoiceCatalog] = useState<VoiceCatalog>(
    getCachedVoiceCatalog()
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const pendingAutoDownloadRef = useRef<boolean>(false);
  const renderingSignatureRef = useRef<string | null>(null);
  const shouldSyncInitialRenderedSignatureRef = useRef<boolean>(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleFormRef = useRef<HTMLFormElement>(null);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const videoCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchVoiceCatalog().then(setVoiceCatalog);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewBrollModal(null);
        setIsOptionsMenuOpen(false);
        setIsEditingTitle(false);
        setIsDeleteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(target)
      ) {
        setIsOptionsMenuOpen(false);
      }
      if (
        isEditingTitle &&
        titleFormRef.current &&
        !titleFormRef.current.contains(target)
      ) {
        setIsEditingTitle(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditingTitle]);

  const hydrateFromProps = (
    props: TimeMachineVideoProps,
    recordTheme?: string
  ) => {
    const isDefaultTheme = (t?: string) =>
      !t ||
      t === 'Novo Vídeo — Fragata Shorts' ||
      t === 'Novo Vídeo — Máquina do Tempo';

    const resolvedTheme = !isDefaultTheme(props.theme)
      ? props.theme
      : !isDefaultTheme(recordTheme)
        ? (recordTheme as string)
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
    if (props.subtitleStyle) {
      setSubtitleStyle({
        ...DEFAULT_SUBTITLE_STYLE,
        ...props.subtitleStyle,
      });
    }
    if (props.avatarTimeline) setAvatarTimeline(props.avatarTimeline);

    if (props.bgmVibe) {
      setBgmVibe(props.bgmVibe);
    }
    if (props.bgmVolume !== undefined) {
      setBgmVolume(props.bgmVolume);
    }
    if (props.globalSfxMultiplier !== undefined) {
      setGlobalSfxMultiplier(props.globalSfxMultiplier);
    }
    if (props.autoDucking !== undefined) {
      setAutoDucking(props.autoDucking);
    }

    if (props.storyboard) {
      setDurationPreset(props.storyboard.durationPreset || 'short');
      if (props.storyboard.bgmVibe) {
        setBgmVibe(props.storyboard.bgmVibe);
      }
      if (props.storyboard.episodeFormat) {
        setEpisodeFormat(props.storyboard.episodeFormat);
      }
      if (props.storyboard.seriesContext) {
        setSeriesContext(props.storyboard.seriesContext);
      }
      if (props.storyboard.protagonistAgency) {
        setProtagonistAgency(props.storyboard.protagonistAgency);
      }
      if (props.storyboard.contentBalance) {
        setContentBalance(props.storyboard.contentBalance);
      }
      if (props.storyboard.avatarConfig) {
        setAvatarConfig({
          ...DEFAULT_AVATAR_CONFIG,
          ...props.storyboard.avatarConfig,
        });
      }
      if (
        props.storyboard.ideationOptions &&
        props.storyboard.ideationOptions.length > 0
      ) {
        setIdeationOptions(props.storyboard.ideationOptions);
      }

      const loadedScenes = props.storyboard.scenes || [];
      setScenes(loadedScenes);
      if (loadedScenes.length > 0 && finalMixScenes.length === 0) {
        setFinalMixScenes(
          loadedScenes.map((sc, idx) => ({
            uid: `approved__scene_${idx}`,
            sourceOptionId: 'approved',
            sourceOptionBadge: '✓ Aprovada',
            sourceSceneIndex: idx,
            scene: sc,
          }))
        );
      }
      setAudioGenerated(Boolean(props.storyboard.audioGenerated));
      setIsAssembled(Boolean(props.storyboard.isAssembled));
      setSceneTimings(props.storyboard.sceneTimings || []);
      if (loadedScenes.length > 0) {
        let hasCachedTab = false;
        try {
          hasCachedTab = Boolean(
            id && localStorage.getItem(`studio_active_tab_${id}`)
          );
        } catch {
          /* ignore storage error */
        }
        if (!hasCachedTab) {
          setActiveTab('storyboard');
        }
      }
    } else if (
      props.backgroundTimeline &&
      props.backgroundTimeline.length > 0 &&
      props.subtitles &&
      props.subtitles.length > 0
    ) {
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
          imagePrompt:
            'POV historical time-travel scene with hyper-realistic background and stick figure character, 9:16 vertical',
          sfx_suggestion: '',
          candidateImages: [bg.imageSrc],
          selectedImage: bg.imageSrc,
        })
      );
      setScenes(legacyScenes);
      let hasCachedTab = false;
      try {
        hasCachedTab = Boolean(
          id && localStorage.getItem(`studio_active_tab_${id}`)
        );
      } catch {
        /* ignore storage error */
      }
      if (!hasCachedTab) {
        setActiveTab('storyboard');
      }
    }
  };

  const fetchVideoData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/videos/${id}`);
      if (!res.ok) {
        setIsLoading(false);
        return;
      }

      const data: VideoRecord = await res.json();
      setVideoRecord(data);

      if (data.status === 'RENDERED' && data.videoUrl) {
        shouldSyncInitialRenderedSignatureRef.current = true;
      }

      if (data.remotionProps) {
        hydrateFromProps(data.remotionProps, data.theme);
      } else if (
        data.theme &&
        data.theme !== 'Novo Vídeo — Fragata Shorts' &&
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

  const loadSfxLibrary = async () => {
    try {
      const res = await fetch('/api/sfx-library');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.options) && data.options.length > 0) {
          setSfxLibraryOptions(data.options);
        }
      }
    } catch (err) {
      console.warn('Aviso ao carregar biblioteca de SFX:', err);
    }
  };

  const loadSeriesList = async () => {
    try {
      const res = await fetch('/api/series');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.series)) {
          setAvailableSeries(data.series);
        }
      }
    } catch (err) {
      console.warn('Aviso ao carregar lista de séries:', err);
    }
  };

  const handlePromoteStoryboardSceneSfx = async (sceneIndex: number) => {
    if (!id) return;
    const scene = scenes[sceneIndex];
    if (!scene?.custom_sfx_url) return;

    setPromotingSfxSceneIndex(sceneIndex);
    try {
      const res = await fetch('/api/sfx-library/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: id,
          sceneIndex,
          customSfxUrl: scene.custom_sfx_url,
          sfxPrompt: scene.sfx_prompt || '',
          sfxLabel: scene.sfx_label || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar som na biblioteca.');
      }

      handleSceneFieldChange(sceneIndex, 'sfx_suggestion', data.slug);
      handleSceneFieldChange(
        sceneIndex,
        'sfx_label',
        data.label || scene.sfx_label || ''
      );
      handleSceneFieldChange(sceneIndex, 'custom_sfx_url', null);

      await loadSfxLibrary();
      setSuccessMsg('Efeito sonoro salvo na biblioteca global com sucesso!');
    } catch (err) {
      console.error('[Promote SFX Error]', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao salvar efeito sonoro na biblioteca.'
      );
    } finally {
      setPromotingSfxSceneIndex(null);
    }
  };

  useEffect(() => {
    void fetchVideoData();
    void loadSfxLibrary();
    void loadSeriesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sincronização de eventos de frame e play/pause com @remotion/player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [isLoading]);

  // ========================================================
  // ETAPA 1A: Gerar 4 Opções de Ideias com IA (POST /api/videos/:id/generate-script)
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
          avatarConfig,
          bgmVibe,
          episodeFormat,
          seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
          protagonistAgency,
          contentBalance,
        }),
      });

      const rawText = await res.text();
      let data: {
        error?: string;
        video?: VideoRecord;
        options?: IdeationOption[];
        scenes?: StoryboardScene[];
      } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          res.ok
            ? 'Resposta inválida do servidor ao gerar roteiro.'
            : `Erro HTTP ${res.status} do servidor (verifique os logs do backend).`
        );
      }

      if (!res.ok) {
        throw new Error(
          data.error || 'Falha ao gerar ideias de roteiro no Gemini'
        );
      }

      if (data.video) {
        setVideoRecord(data.video);
        const savedSeriesCtx = data.video?.remotionProps?.storyboard?.seriesContext;
        if (savedSeriesCtx) {
          setSeriesContext(savedSeriesCtx);
        }
      }
      if (episodeFormat === 'series') {
        void loadSeriesList();
      }

      if (Array.isArray(data.options) && data.options.length > 0) {
        setIdeationOptions(data.options);
        setSuccessMsg(
          `4 opções de roteiro geradas! Abra os accordions, escolha as melhores cenas e aprove o Roteiro Final.`
        );
      } else if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        const fallbackOption: IdeationOption = {
          id: 'humor',
          title: 'Roteiro Sugerido',
          badge: '💡 Opção 1',
          description: 'Cenas geradas pelo Gemini',
          scenes: data.scenes,
        };
        setIdeationOptions([fallbackOption]);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao gerar ideias com IA'
      );
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // ========================================================
  // ETAPA 1B: Consolidar e Aprovar o "Roteiro Final" (Mix & Match)
  // ========================================================
  const handleApproveFinalScript = async (approvedTitle?: string) => {
    if (!id || finalMixScenes.length === 0) return;

    setIsApprovingScript(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // O Roteirista-Chefe (Gemini) revisa a sequência completa do Roteiro Final.
      // Se existirem cenas extras autorais ou edições na descrição do cenário ("visual_description"),
      // ele gera os prompts de imagem ("imagePrompt") em inglês baseados estritamente nessas descrições.
      let consolidatedScenes: StoryboardScene[] = [];

      try {
        const reviewRes = await fetch(
          `/api/videos/${id}/review-final-script`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              theme: approvedTitle?.trim() || theme,
              avatarConfig,
              scenes: finalMixScenes.map((item) => ({
                id: item.uid,
                speaker: item.scene.speaker,
                text: item.scene.text,
                dialogues: getSceneDialogues(item.scene),
                avatarSprite: item.scene.avatarSprite,
                visual_description: item.scene.visual_description || '',
                imagePrompt: item.scene.imagePrompt || '',
                sfx_suggestion: item.scene.sfx_suggestion || '',
                sfx_prompt: item.scene.sfx_prompt || '',
                isCustom: item.sourceOptionId === 'custom',
              })),
            }),
          }
        );

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          if (
            Array.isArray(reviewData.scenes) &&
            reviewData.scenes.length === finalMixScenes.length
          ) {
            consolidatedScenes = reviewData.scenes.map(
              (revScene: StoryboardScene, idx: number) => ({
                ...revScene,
                dialogues:
                  revScene.dialogues && revScene.dialogues.length > 0
                    ? revScene.dialogues
                    : getSceneDialogues(finalMixScenes[idx]?.scene),
                candidateImages:
                  finalMixScenes[idx]?.scene.candidateImages || [],
                selectedImage:
                  finalMixScenes[idx]?.scene.selectedImage || null,
              })
            );
          }
        }
      } catch (reviewErr) {
        console.warn(
          '[Studio] Falha na revisão via Gemini, aplicando fallback local:',
          reviewErr
        );
      }

      // Fallback de segurança se a chamada ao Gemini falhou
      if (consolidatedScenes.length === 0) {
        consolidatedScenes = finalMixScenes.map((item) => ({
          ...item.scene,
          dialogues: getSceneDialogues(item.scene),
          imagePrompt: injectAvatarConfigIntoPrompt(
            item.scene.imagePrompt,
            avatarConfig
          ),
          candidateImages: item.scene.candidateImages || [],
          selectedImage: item.scene.selectedImage || null,
        }));
      }

      setScenes(consolidatedScenes);
      setAudioGenerated(false);
      setIsAssembled(false);
      setSceneTimings([]);
      setSubtitles([]);

      const targetDurationFrames =
        durationPreset === 'long'
          ? 1800
          : durationPreset === 'medium'
            ? 900
            : 450;
      setDurationInFrames(targetDurationFrames);

      const finalTitle =
        approvedTitle?.trim() ||
        (theme.trim().length <= 60
          ? theme.trim()
          : 'Viagem no Tempo — Fragata Shorts');
      if (approvedTitle?.trim()) {
        setTheme(approvedTitle.trim());
      }

      const payload: TimeMachineVideoProps = {
        theme: finalTitle,
        durationInFrames: targetDurationFrames,
        backgroundSrc: backgroundSrc || 'background.jpg',
        backgroundTimeline: [],
        audioSrc: audioSrc || 'audio.mp3',
        bgmVibe: effectiveBgmVibe,
        subtitles: [],
        subtitleStyle,
        avatarTimeline: [],
        storyboard: {
          durationPreset,
          scenes: consolidatedScenes,
          audioGenerated: false,
          isAssembled: false,
          sceneTimings: [],
          avatarConfig,
          ideationOptions,
          bgmVibe: effectiveBgmVibe,
          episodeFormat,
          seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
          protagonistAgency,
          contentBalance,
        },
      };

      const res = await fetch(`/api/videos/${id}/storyboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Falha ao salvar o Roteiro Final aprovado'
        );
      }

      if (data.video) {
        setVideoRecord(data.video);
        const savedSeriesCtx = data.video?.remotionProps?.storyboard?.seriesContext;
        if (savedSeriesCtx) {
          setSeriesContext(savedSeriesCtx);
        }
      }
      if (episodeFormat === 'series') {
        void loadSeriesList();
      }

      setActiveTab('storyboard');
      setSuccessMsg(
        `Roteiro Final aprovado com ${consolidatedScenes.length} cenas e avatar configurado! Gere agora as imagens B-Roll.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao aprovar e salvar o Roteiro Final'
      );
    } finally {
      setIsApprovingScript(false);
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

  /**
   * Atualiza o volume sugerido (0.0 a 1.0) de um efeito específico dentro de uma cena
   */
  const handleUpdateSceneSfxVolume = (
    sceneIndex: number,
    sfxIndex: number,
    newVolume: number
  ) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== sceneIndex) return scene;
        const currentList: SfxItem[] = getSceneSfxList(scene);
        const updatedList: SfxItem[] = currentList.map((item: SfxItem, sIdx: number) =>
          sIdx === sfxIndex ? { ...item, suggested_volume: newVolume } : item
        );
        return {
          ...scene,
          sfx_list: updatedList,
        };
      })
    );
  };

  /**
   * Reproduz um efeito sonoro isolado para pré-escuta na aba de Áudio
   */
  const handlePlaySfxPreview = (audioUrl: string, keyId: string) => {
    try {
      const audio = new window.Audio(audioUrl);
      setPlayingSfxPreview(keyId);
      audio.onended = () => setPlayingSfxPreview(null);
      audio.onerror = () => setPlayingSfxPreview(null);
      void audio.play();
    } catch (e) {
      console.warn('Erro ao reproduzir pré-escuta de SFX:', e);
      setPlayingSfxPreview(null);
    }
  };

  /**
   * Gera um efeito sonoro sob demanda na ElevenLabs via Text-to-SFX
   */
  const handleGenerateSceneSfx = async (
    sceneIndex: number,
    promptText: string
  ) => {
    if (!id || !promptText.trim()) return;
    setGeneratingSfxSceneIndex(sceneIndex);
    try {
      const res = await fetch(`/api/videos/${id}/generate-scene-sfx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          sfxPrompt: promptText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Falha ao sintetizar efeito sonoro na ElevenLabs'
        );
      }

      const audioUrl = data.audioUrl;
      setScenes((prev) =>
        prev.map((sc, idx) => {
          if (idx !== sceneIndex) return sc;
          const existingList =
            Array.isArray(sc.sfx_list) && sc.sfx_list.length > 0
              ? sc.sfx_list
              : [];
          const updatedList: SfxItem[] =
            existingList.length > 0
              ? existingList.map((item, itemIdx) =>
                  itemIdx === 0
                    ? {
                        ...item,
                        sound_prompt: promptText.trim(),
                        audio_url: audioUrl,
                      }
                    : item
                )
              : [
                  {
                    sound_prompt: promptText.trim(),
                    match_score: 95,
                    start_time_sec: 0,
                    duration_sec: 2.5,
                    suggested_volume: 0.35,
                    audio_url: audioUrl,
                  },
                ];
          return {
            ...sc,
            sfx_prompt: promptText.trim(),
            custom_sfx_url: audioUrl,
            sfx_list: updatedList,
          };
        })
      );
      setSuccessMsg(
        `Efeito sonoro gerado com sucesso para a Cena #${sceneIndex + 1}!`
      );
    } catch (err: unknown) {
      console.error('[Generate SFX Error]', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao gerar efeito sonoro na ElevenLabs'
      );
    } finally {
      setGeneratingSfxSceneIndex(null);
    }
  };

  /**
   * Altera a opção de efeito sonoro selecionada da biblioteca (ou limpa)
   */
  const handleSceneSfxOptionChange = (
    sceneIndex: number,
    newOptionValue: string
  ) => {
    setScenes((prev) =>
      prev.map((sc, idx) => {
        if (idx !== sceneIndex) return sc;
        if (newOptionValue === 'custom') {
          return sc;
        }
        if (newOptionValue === 'none') {
          return {
            ...sc,
            sfx_suggestion: 'none',
            custom_sfx_url: null,
            sfx_list: [],
          };
        }
        const selectedOpt = sfxLibraryOptions.find(
          (o) => o.value === newOptionValue
        );
        const existingList =
          Array.isArray(sc.sfx_list) && sc.sfx_list.length > 0
            ? sc.sfx_list
            : [];
        const updatedList: SfxItem[] =
          existingList.length > 0
            ? existingList.map((item, itemIdx) =>
                itemIdx === 0
                  ? { ...item, sfx_key: newOptionValue, audio_url: null }
                  : item
              )
            : [
                {
                  sound_prompt:
                    sc.sfx_prompt || selectedOpt?.label || newOptionValue,
                  match_score: 90,
                  start_time_sec: 0,
                  duration_sec: 2.0,
                  suggested_volume: 0.35,
                  sfx_key: newOptionValue,
                  audio_url: null,
                },
              ];
        return {
          ...sc,
          sfx_suggestion: newOptionValue,
          sfx_label: selectedOpt?.label,
          custom_sfx_url: null,
          sfx_list: updatedList,
        };
      })
    );
  };

  /**
   * Remove o áudio customizado de IA gerado e desvincula da cena
   */
  const handleRemoveCustomSfx = (sceneIndex: number) => {
    setScenes((prev) =>
      prev.map((sc, idx) => {
        if (idx !== sceneIndex) return sc;
        const existingList =
          Array.isArray(sc.sfx_list) && sc.sfx_list.length > 0
            ? sc.sfx_list
            : [];
        const updatedList: SfxItem[] = existingList.map((item, itemIdx) =>
          itemIdx === 0 ? { ...item, audio_url: null } : item
        );
        return {
          ...sc,
          custom_sfx_url: null,
          sfx_list: updatedList,
        };
      })
    );
  };

  const handleAddDialogueInStudio = (sceneIndex: number) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== sceneIndex) return scene;
        const currentDialogues = getSceneDialogues(scene);
        const newDialogue = {
          id: `dlg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          speaker: 'character' as SpeakerType,
          text: '',
        };
        const updatedDialogues = [...currentDialogues, newDialogue];
        return {
          ...scene,
          dialogues: updatedDialogues,
          speaker: updatedDialogues[0]?.speaker || scene.speaker,
          text: updatedDialogues.map((d) => d.text).join(' '),
        };
      })
    );
  };

  const handleUpdateDialogueInStudio = (
    sceneIndex: number,
    dialogueId: string,
    field: 'speaker' | 'text' | 'voiceId' | 'characterName',
    value: string
  ) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== sceneIndex) return scene;
        const currentDialogues = getSceneDialogues(scene);
        const updatedDialogues = currentDialogues.map((d) => {
          if (d.id !== dialogueId) return d;
          const next = {
            ...d,
            [field]: field === 'speaker' ? (value as SpeakerType) : value,
          };
          if (field === 'speaker' && value === 'character' && !next.voiceId) {
            next.voiceId =
              voiceCatalog.characters[0]?.id || 'N2lVS1w4EtoT3dr4eOWO';
          }
          return next;
        });
        return {
          ...scene,
          dialogues: updatedDialogues,
          speaker: updatedDialogues[0]?.speaker || scene.speaker,
          text: updatedDialogues.map((d) => d.text).join(' '),
        };
      })
    );
  };

  const handleRemoveDialogueInStudio = (
    sceneIndex: number,
    dialogueId: string
  ) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== sceneIndex) return scene;
        const currentDialogues = getSceneDialogues(scene);
        if (currentDialogues.length <= 1) return scene;
        const updatedDialogues = currentDialogues.filter(
          (d) => d.id !== dialogueId
        );
        return {
          ...scene,
          dialogues: updatedDialogues,
          speaker: updatedDialogues[0]?.speaker || scene.speaker,
          text: updatedDialogues.map((d) => d.text).join(' '),
        };
      })
    );
  };

  const toggleSceneCollapse = (sceneIndex: number) => {
    setCollapsedScenes((prev) => {
      const current = prev[sceneIndex] !== undefined ? prev[sceneIndex] : true;
      const next = {
        ...prev,
        [sceneIndex]: !current,
      };
      if (id) {
        try {
          localStorage.setItem(`studio_collapsed_scenes_${id}`, JSON.stringify(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  const handleRegenerateScenePromptInStudio = async (sceneIndex: number) => {
    if (!id) return;
    const targetScene = scenes[sceneIndex];
    const fullText = getSceneFullText(targetScene);
    if (!fullText) return;

    setGeneratingPromptForScene((prev) => ({ ...prev, [sceneIndex]: true }));
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/generate-scene-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          speaker: targetScene.speaker,
          dialogues: getSceneDialogues(targetScene),
          theme,
          avatarConfig,
          visual_description: targetScene.visual_description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar prompt visual');
      }

      setScenes((prev) =>
        prev.map((s, idx) =>
          idx === sceneIndex
            ? {
                ...s,
                imagePrompt: data.imagePrompt,
                visual_description: data.visual_description,
                sfx_suggestion: data.sfx_suggestion || s.sfx_suggestion,
                sfx_prompt: data.sfx_prompt || s.sfx_prompt,
                avatarSprite: data.avatarSprite || s.avatarSprite,
              }
            : s
        )
      );

      setSuccessMsg(
        `Prompt da cena #${sceneIndex + 1} atualizado com sucesso!`
      );
    } catch (err) {
      console.error('Erro ao gerar prompt da cena:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Falha ao gerar prompt visual com IA.'
      );
    } finally {
      setGeneratingPromptForScene((prev) => ({ ...prev, [sceneIndex]: false }));
    }
  };

  // ========================================================
  // ETAPA 3A: Gerar 2 Imagens B-Roll por Cena
  // ========================================================
  const handleGenerateSceneImages = async (sceneIndex: number) => {
    if (!id) return;
    const targetScene = scenes[sceneIndex];
    if (!targetScene) return;

    setGeneratingImageForScene((prev) => ({ ...prev, [sceneIndex]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const sanitizedScenes = scenes.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        avatarSprite: s.avatarSprite,
        imagePrompt: s.imagePrompt,
        sfx_suggestion: s.sfx_suggestion || '',
      }));

      const res = await fetch(`/api/videos/${id}/generate-scene-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          imagePrompt: targetScene.imagePrompt,
          scenes: sanitizedScenes,
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
        const savedSeriesCtx = data.video?.remotionProps?.storyboard?.seriesContext;
        if (savedSeriesCtx) {
          setSeriesContext(savedSeriesCtx);
        }
      }
      if (episodeFormat === 'series') {
        void loadSeriesList();
      }

      setSuccessMsg(
        `2 opções de B-Roll geradas para a Cena #${sceneIndex + 1}!`
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

    if (backgroundTimeline.length > sceneIndex) {
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

  const handleDeleteBrollImage = async (
    sceneIndex: number,
    imageUrlToDelete: string
  ) => {
    const targetScene = scenes[sceneIndex];
    if (!targetScene) return;

    // Não permite excluir a imagem se ela estiver selecionada no momento
    if (targetScene.selectedImage === imageUrlToDelete) {
      setErrorMsg(
        'Não é possível excluir a imagem que está atualmente selecionada nesta cena.'
      );
      return;
    }

    const updatedCandidates = (targetScene.candidateImages || []).filter(
      (img) => img !== imageUrlToDelete
    );

    const updatedScenes = scenes.map((scene, idx) =>
      idx === sceneIndex
        ? {
            ...scene,
            candidateImages: updatedCandidates,
          }
        : scene
    );

    setScenes(updatedScenes);

    if (
      previewBrollModal &&
      previewBrollModal.sceneIndex === sceneIndex &&
      previewBrollModal.imageUrl === imageUrlToDelete
    ) {
      setPreviewBrollModal(null);
    }

    // Persiste imediatamente a lista atualizada de imagens no banco
    if (id) {
      try {
        const payload: TimeMachineVideoProps = {
          theme: theme || 'Vlog de Viagem no Tempo',
          durationInFrames: effectiveTotalFrames,
          backgroundSrc:
            effectiveBackgroundTimeline[0]?.imageSrc || backgroundSrc,
          backgroundTimeline: effectiveBackgroundTimeline,
          audioSrc,
          bgmVibe: effectiveBgmVibe,
          subtitles: effectiveSubtitles,
          subtitleStyle,
          avatarTimeline: effectiveAvatarTimeline,
          storyboard: {
            durationPreset,
            scenes: updatedScenes,
            audioGenerated,
            isAssembled,
            sceneTimings,
            avatarConfig,
            ideationOptions,
            bgmVibe: effectiveBgmVibe,
            episodeFormat,
            seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
            protagonistAgency,
            contentBalance,
          },
        };

        const res = await fetch(`/api/videos/${id}/storyboard`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.video) {
            setVideoRecord(data.video);
          }
        }
      } catch (err) {
        console.warn('Aviso ao sincronizar remoção de imagem com o banco:', err);
      }
    }
  };

  const handleManualImageUpload = async (sceneIndex: number, file: File) => {
    if (!id || !file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        'Por favor selecione um arquivo de imagem válido (JPG, PNG, WebP).'
      );
      return;
    }

    setIsUploadingManualImage((prev) => ({ ...prev, [sceneIndex]: true }));
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch(`/api/videos/${id}/upload-scene-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneIndex,
            imageBase64: base64Data,
            fileName: file.name,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Falha ao salvar imagem no servidor.');
        }

        const finalUrl = data.imageUrl || base64Data;

        setScenes((prev) =>
          prev.map((scene, idx) =>
            idx === sceneIndex
              ? {
                  ...scene,
                  candidateImages: [
                    finalUrl,
                    ...(scene.candidateImages || []).filter(
                      (u) => u !== finalUrl
                    ),
                  ],
                  selectedImage: finalUrl,
                }
              : scene
          )
        );

        if (backgroundTimeline.length > sceneIndex) {
          setBackgroundTimeline((prev) =>
            prev.map((seg, idx) =>
              idx === sceneIndex ? { ...seg, imageSrc: finalUrl } : seg
            )
          );
          if (sceneIndex === 0) {
            setBackgroundSrc(finalUrl);
          }
        }

        if (data.video) {
          setVideoRecord(data.video);
        }

        setSuccessMsg(
          `Imagem manual adicionada com sucesso à Cena #${sceneIndex + 1}!`
        );
      } catch (err) {
        console.warn(
          'Erro ao enviar imagem ao servidor, aplicando localmente:',
          err
        );
        handleSelectBrollImage(sceneIndex, base64Data);
        setScenes((prev) =>
          prev.map((scene, idx) =>
            idx === sceneIndex
              ? {
                  ...scene,
                  candidateImages: [
                    base64Data,
                    ...(scene.candidateImages || []).filter(
                      (u) => u !== base64Data
                    ),
                  ],
                  selectedImage: base64Data,
                }
              : scene
          )
        );
        setSuccessMsg(`Imagem aplicada à Cena #${sceneIndex + 1}!`);
      } finally {
        setIsUploadingManualImage((prev) => ({ ...prev, [sceneIndex]: false }));
      }
    };

    reader.onerror = () => {
      setErrorMsg('Falha ao ler o arquivo de imagem.');
      setIsUploadingManualImage((prev) => ({ ...prev, [sceneIndex]: false }));
    };

    reader.readAsDataURL(file);
  };

  // ========================================================
  // ETAPA 3B: Gravar Narração Multi-Voz Global
  // ========================================================
  const handleGenerateAudio = async () => {
    if (!id || scenes.length === 0) return;

    setIsGeneratingAudio(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const sanitizedScenes = scenes.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        avatarSprite: s.avatarSprite,
        imagePrompt: s.imagePrompt,
        sfx_suggestion: s.sfx_suggestion || '',
      }));

      const res = await fetch(`/api/videos/${id}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: sanitizedScenes }),
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
        const savedSeriesCtx = data.video?.remotionProps?.storyboard?.seriesContext;
        if (savedSeriesCtx) {
          setSeriesContext(savedSeriesCtx);
        }
      }
      if (episodeFormat === 'series') {
        void loadSeriesList();
      }

      setSuccessMsg(
        'Narração Multi-Voz gravada com sucesso! Clique em "Montar Vídeo" para atualizar.'
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
  // ETAPA 3C: Montar Vídeo no @remotion/player
  // ========================================================
  const allScenesHaveSelectedImage =
    scenes.length > 0 && scenes.every((s) => Boolean(s.selectedImage));
  const canAssembleVideo = allScenesHaveSelectedImage && audioGenerated;

  const handleAssembleVideo = async () => {
    if (!id || scenes.length === 0) return;
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

    const subtitlesToPersist =
      subtitles.length > 0
        ? subtitles.map((sub) => ({
            ...sub,
            words: ensureSubtitleWordTimings(sub),
          }))
        : effectiveSubtitles;

    const payload: TimeMachineVideoProps = {
      theme: theme || 'Vlog de Viagem no Tempo',
      durationInFrames: totalFrames,
      backgroundSrc: primaryBg,
      backgroundTimeline: assembledBackgroundTimeline,
      audioSrc,
      bgmVibe: effectiveBgmVibe,
      bgmVolume,
      sfxEnabled: true,
      globalSfxMultiplier,
      autoDucking,
      subtitles: subtitlesToPersist,
      subtitleStyle,
      avatarTimeline: assembledAvatarTimeline,
      storyboard: {
        durationPreset,
        scenes,
        audioGenerated,
        isAssembled: true,
        sceneTimings,
        avatarConfig,
        ideationOptions,
        bgmVibe: effectiveBgmVibe,
        episodeFormat,
        seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
        protagonistAgency,
        contentBalance,
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
        'Vídeo e estilos de legenda salvos e sincronizados com o Player!'
      );
    } catch (err) {
      console.warn('Aviso ao persistir montagem no banco:', err);
    }
  };

  // Função para disparar o download real do arquivo .mp4 diretamente na pasta Downloads do navegador
  const triggerDirectMp4Download = async (
    videoUrl: string,
    currentTheme: string
  ) => {
    const fileName = buildMp4DownloadFileName(currentTheme);
    setIsDownloadingMp4(true);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error('Falha ao obter o arquivo MP4 renderizado.');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (err) {
      console.warn('Fallback para download direto via link:', err);
      const fallbackLink = document.createElement('a');
      fallbackLink.href = videoUrl;
      fallbackLink.download = fileName;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noreferrer';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
    } finally {
      setIsDownloadingMp4(false);
    }
  };

  // ========================================================
  // Renderização Final do MP4 no Servidor (POST /api/videos/:id/rerender)
  // ========================================================
  const handleRenderMp4OnServer = async () => {
    if (!id) return;
    if (!isAssembled && canAssembleVideo) {
      await handleAssembleVideo();
    }

    setIsRerendering(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: TimeMachineVideoProps = {
      theme: theme || 'Vlog de Viagem no Tempo',
      durationInFrames: effectiveTotalFrames,
      backgroundSrc: effectiveBackgroundTimeline[0]?.imageSrc || backgroundSrc,
      backgroundTimeline: effectiveBackgroundTimeline,
      audioSrc,
      bgmVibe: effectiveBgmVibe,
      subtitles: effectiveSubtitles,
      subtitleStyle,
      avatarTimeline: effectiveAvatarTimeline,
      storyboard: {
        durationPreset,
        scenes,
        audioGenerated,
        isAssembled: true,
        sceneTimings,
        avatarConfig,
        ideationOptions,
        bgmVibe: effectiveBgmVibe,
        episodeFormat,
        seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
        protagonistAgency,
        contentBalance,
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
        pendingAutoDownloadRef.current = false;
        throw new Error(data.error || 'Falha ao acionar renderização do MP4');
      }

      setVideoRecord(data.video);
      setIsAssembled(true);
      setSuccessMsg(
        'Renderizando MP4 atualizado no servidor! O download iniciará automaticamente ao concluir.'
      );
    } catch (err) {
      pendingAutoDownloadRef.current = false;
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao renderizar vídeo MP4'
      );
    } finally {
      setIsRerendering(false);
    }
  };

  const handleSubtitleStyleChange = <K extends keyof SubtitleStyleConfig>(
    field: K,
    value: SubtitleStyleConfig[K]
  ) => {
    setSubtitleStyle((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubtitleChange = (
    index: number,
    field: keyof SubtitleItem,
    value: string | number
  ) => {
    setSubtitles((prev) => {
      const baseList = prev.length > 0 ? prev : effectiveSubtitles;
      return baseList.map((item, idx) => {
        if (idx !== index) return item;
        const updatedItem: SubtitleItem = {
          ...item,
          [field]: value,
          words: undefined,
        };
        updatedItem.words = ensureSubtitleWordTimings(updatedItem);
        return updatedItem;
      });
    });
  };

  // ========================================================
  // DADOS DERIVADOS PARA O PLAYER E TIMELINE
  // ========================================================
  const hasScript = scenes.length > 0;
  const isPending = videoRecord?.status === 'PENDING';

  const effectiveTotalFrames = useMemo(() => {
    if (durationInFrames && durationInFrames > 0) return durationInFrames;
    if (durationPreset === 'long') return 1800;
    if (durationPreset === 'medium') return 900;
    return 450;
  }, [durationInFrames, durationPreset]);

  const effectiveBackgroundTimeline = useMemo<BackgroundSegment[]>(() => {
    if (
      backgroundTimeline.length > 0 &&
      backgroundTimeline.length === scenes.length
    ) {
      return backgroundTimeline.map((seg, idx) => ({
        ...seg,
        imageSrc:
          scenes[idx]?.selectedImage || seg.imageSrc || 'background.jpg',
      }));
    }
    if (scenes.length > 0) {
      const framesPerScene = Math.floor(effectiveTotalFrames / scenes.length);
      return scenes.map((scene, idx) => {
        const timing = sceneTimings[idx];
        const frameStart = timing ? timing.frameStart : idx * framesPerScene;
        const frameEnd = timing
          ? timing.frameEnd
          : idx === scenes.length - 1
            ? effectiveTotalFrames
            : (idx + 1) * framesPerScene - 1;
        return {
          imageSrc:
            scene.selectedImage ||
            scene.candidateImages?.[0] ||
            'background.jpg',
          frameStart,
          frameEnd,
        };
      });
    }
    return backgroundTimeline;
  }, [backgroundTimeline, scenes, sceneTimings, effectiveTotalFrames]);

  const effectiveAvatarTimeline = useMemo<AvatarSegment[]>(() => {
    if (avatarTimeline.length > 0 && avatarTimeline.length === scenes.length) {
      return avatarTimeline.map((seg, idx) => ({
        ...seg,
        image: scenes[idx]?.avatarSprite || seg.image,
      }));
    }
    if (scenes.length > 0) {
      const secPerScene = effectiveTotalFrames / 30 / scenes.length;
      return scenes.map((scene, idx) => {
        const timing = sceneTimings[idx];
        return {
          startSecond: timing ? timing.startSecond : idx * secPerScene,
          endSecond: timing ? timing.endSecond : (idx + 1) * secPerScene,
          image: scene.avatarSprite,
        };
      });
    }
    return avatarTimeline;
  }, [avatarTimeline, scenes, sceneTimings, effectiveTotalFrames]);

  const effectiveSubtitles = useMemo<SubtitleItem[]>(() => {
    if (subtitles.length > 0) {
      return subtitles.flatMap((sub) => {
        const wordCount = sub.text.trim().split(/\s+/).filter(Boolean).length;
        // Se for um registro antigo que guardou a frase inteira da cena num único bloco (> 6 palavras sem array words), divide em blocos de 4 palavras
        if (!sub.words && wordCount > 6) {
          return splitSceneTextIntoSubtitleChunks(
            sub.text,
            sub.frameStart,
            sub.frameEnd,
            4
          );
        }
        return [
          {
            ...sub,
            words: ensureSubtitleWordTimings(sub),
          },
        ];
      });
    }
    if (scenes.length > 0) {
      return effectiveBackgroundTimeline.flatMap((seg, idx) => {
        const sceneText = scenes[idx]?.text || `Cena ${idx + 1}`;
        return splitSceneTextIntoSubtitleChunks(
          sceneText,
          seg.frameStart,
          seg.frameEnd,
          4
        );
      });
    }
    return [];
  }, [subtitles, scenes, effectiveBackgroundTimeline]);

  // Assinatura reativa do estado atual do vídeo no Studio (para detectar se o MP4 existente está atualizado)
  const currentRenderSignature = useMemo(() => {
    return computeRenderSignature({
      durationInFrames: effectiveTotalFrames,
      backgroundSrc: effectiveBackgroundTimeline[0]?.imageSrc || backgroundSrc,
      backgroundTimeline: effectiveBackgroundTimeline,
      audioSrc,
      bgmVibe: effectiveBgmVibe,
      bgmVolume,
      globalSfxMultiplier,
      autoDucking,
      subtitles: effectiveSubtitles,
      subtitleStyle,
      avatarTimeline: effectiveAvatarTimeline,
      scenes,
    });
  }, [
    effectiveTotalFrames,
    effectiveBackgroundTimeline,
    backgroundSrc,
    audioSrc,
    effectiveBgmVibe,
    bgmVolume,
    globalSfxMultiplier,
    autoDucking,
    effectiveSubtitles,
    subtitleStyle,
    effectiveAvatarTimeline,
    scenes,
  ]);

  // Sincroniza a assinatura inicial caso o projeto já venha do banco com status === 'RENDERED'
  useEffect(() => {
    if (
      !isLoading &&
      shouldSyncInitialRenderedSignatureRef.current &&
      videoRecord?.status === 'RENDERED' &&
      videoRecord?.videoUrl
    ) {
      shouldSyncInitialRenderedSignatureRef.current = false;
      setLastRenderedSignature(currentRenderSignature);
    }
  }, [
    isLoading,
    videoRecord?.status,
    videoRecord?.videoUrl,
    currentRenderSignature,
  ]);

  const isMp4UpToDate =
    videoRecord?.status === 'RENDERED' &&
    Boolean(videoRecord?.videoUrl) &&
    lastRenderedSignature !== null &&
    currentRenderSignature === lastRenderedSignature;

  // Ação unificada do botão "Exportar MP4":
  // - Se já existe MP4 e nada mudou no vídeo (hash idêntico), baixa imediatamente.
  // - Se nunca foi renderizado ou houve qualquer edição, renderiza e baixa automaticamente ao concluir.
  const handleExportMp4Click = async () => {
    if (!id) return;

    if (isMp4UpToDate && videoRecord?.videoUrl) {
      setErrorMsg(null);
      setSuccessMsg(
        'Vídeo sem alterações pendentes! Baixando MP4 diretamente...'
      );
      await triggerDirectMp4Download(videoRecord.videoUrl, theme);
      return;
    }

    pendingAutoDownloadRef.current = true;
    renderingSignatureRef.current = currentRenderSignature;
    await handleRenderMp4OnServer();
  };

  // ========================================================
  // Edição Rápida do Título na Barra Superior (Duplo Clique)
  // ========================================================
  const handleStartEditTitle = () => {
    setTitleDraft(theme || 'Sem Título');
    setIsEditingTitle(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 20);
  };

  const handleSaveTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id) return;

    const cleanTitle = titleDraft.trim();
    if (!cleanTitle) {
      setErrorMsg('O título do vídeo não pode ficar vazio.');
      return;
    }

    if (cleanTitle === theme) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: cleanTitle }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao salvar o novo título.');
      }

      setTheme(cleanTitle);
      if (data.video) {
        setVideoRecord(data.video);
        const savedSeriesCtx = data.video?.remotionProps?.storyboard?.seriesContext;
        if (savedSeriesCtx) {
          setSeriesContext(savedSeriesCtx);
        }
      }
      if (episodeFormat === 'series') {
        void loadSeriesList();
      }
      setIsEditingTitle(false);
      setSuccessMsg('Título atualizado com sucesso!');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao atualizar título.'
      );
    } finally {
      setIsSavingTitle(false);
    }
  };

  // ========================================================
  // Exclusão Permanente do Vídeo (Confirmação "fragata shorts")
  // ========================================================
  const isDeleteConfirmationValid =
    deleteConfirmInput.trim().toLowerCase() === 'fragata shorts';

  const handleConfirmDeleteVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !isDeleteConfirmationValid) return;

    setIsDeletingVideo(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao excluir o vídeo.');
      }

      navigate('/');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao excluir o vídeo.'
      );
      setIsDeletingVideo(false);
      setIsDeleteModalOpen(false);
    }
  };

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
        if (data.status === 'RENDERED' && data.videoUrl) {
          setLastRenderedSignature(
            renderingSignatureRef.current ?? currentRenderSignature
          );
          if (pendingAutoDownloadRef.current) {
            pendingAutoDownloadRef.current = false;
            setSuccessMsg(
              'MP4 renderizado com sucesso! Iniciando download automático...'
            );
            void triggerDirectMp4Download(
              data.videoUrl,
              data.theme || theme
            );
          } else {
            setSuccessMsg('MP4 renderizado com sucesso!');
          }
        } else if (data.status === 'FAILED') {
          pendingAutoDownloadRef.current = false;
          setErrorMsg('Falha ao renderizar o MP4 no servidor.');
        }
      } catch (err) {
        console.error('Erro no polling do vídeo:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, videoRecord?.status, currentRenderSignature, theme]);

  // Arraste direto da caixa de legenda sobre o Player 9:16 (sem disparar Play/Pause)
  const updateSubtitlePositionFromClientXY = (
    clientX: number,
    clientY: number
  ) => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.round(Math.max(15, Math.min(85, rawX)));
    const clampedY = Math.round(Math.max(10, Math.min(92, rawY)));

    setSubtitleStyle((prev) => ({
      ...prev,
      positionX: clampedX,
      positionY: clampedY,
    }));
  };

  const handleSubtitleDragMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingSubtitle(true);
  };

  useEffect(() => {
    if (!isDraggingSubtitle) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      updateSubtitlePositionFromClientXY(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      setIsDraggingSubtitle(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingSubtitle]);

  // Redimensionamento interativo entre a Sidebar Esquerda e a Coluna Direita (Player/Timeline)
  // Garante largura mínima e máxima tanto para a coluna direita quanto para a coluna esquerda
  const handleSidebarResizeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    const MIN_LEFT_WIDTH = 340;
    const MAX_LEFT_WIDTH = 760;
    const MIN_RIGHT_WIDTH = 480;
    const MAX_RIGHT_WIDTH = 1480;
    const SPLITTER_AND_PADDING_SPACE = 36; // p-3 (24px) + divisor (12px)

    const handleWindowMouseMove = (e: MouseEvent) => {
      const container = workspaceContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalAvailableWidth = rect.width - SPLITTER_AND_PADDING_SPACE;

      // Posição X do rato relativa ao início da área útil do workspace
      const rawLeftWidth = e.clientX - rect.left - 12;

      // Calcula os limites da esquerda respeitando também o MÍNIMO e MÁXIMO da coluna direita
      const minLeftByRightMax = Math.max(
        MIN_LEFT_WIDTH,
        totalAvailableWidth - MAX_RIGHT_WIDTH
      );
      const maxLeftByRightMin = Math.min(
        MAX_LEFT_WIDTH,
        totalAvailableWidth - MIN_RIGHT_WIDTH
      );

      const safeMinLeft = Math.min(minLeftByRightMax, maxLeftByRightMin);
      const safeMaxLeft = Math.max(minLeftByRightMax, maxLeftByRightMin);

      const clampedLeftWidth = Math.round(
        Math.max(safeMinLeft, Math.min(safeMaxLeft, rawLeftWidth))
      );

      setSidebarWidth(clampedLeftWidth);
    };

    const handleWindowMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isResizingSidebar]);

  // Controlos de transporte do Player
  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted) {
      player.unmute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  const seekToFrame = (frame: number) => {
    const clamped = Math.max(0, Math.min(frame, effectiveTotalFrames - 1));
    setCurrentFrame(clamped);
    playerRef.current?.seekTo(clamped);
  };

  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const targetFrame = Math.round(ratio * Math.max(0, effectiveTotalFrames - 1));
    seekToFrame(targetFrame);
  };

  const seekTimelineByClientX = (clientX: number) => {
    const container = timelineContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? offsetX / rect.width : 0;
    const targetFrame = Math.round(
      ratio * Math.max(0, effectiveTotalFrames - 1)
    );
    const clamped = Math.max(0, Math.min(targetFrame, effectiveTotalFrames - 1));
    setCurrentFrame(clamped);
    playerRef.current?.seekTo(clamped);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (isPlaying) {
      playerRef.current?.pause();
    }
    setIsScrubbingTimeline(true);
    seekTimelineByClientX(e.clientX);
  };

  useEffect(() => {
    if (!isScrubbingTimeline) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      seekTimelineByClientX(e.clientX);
    };

    const handleWindowMouseUp = () => {
      setIsScrubbingTimeline(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbingTimeline, effectiveTotalFrames]);

  // Identifica qual Cena e qual Legenda estão ativas no frame atual da agulha
  const activeSceneIndexAtPlayhead = useMemo(() => {
    return effectiveBackgroundTimeline.findIndex(
      (seg) => currentFrame >= seg.frameStart && currentFrame <= seg.frameEnd
    );
  }, [effectiveBackgroundTimeline, currentFrame]);

  const activeSubtitleIndexAtPlayhead = useMemo(() => {
    return effectiveSubtitles.findIndex(
      (sub) => currentFrame >= sub.frameStart && currentFrame <= sub.frameEnd
    );
  }, [effectiveSubtitles, currentFrame]);

  // Marcações da Régua de Tempo (00:00, 00:05, 00:10, 00:15...)
  const rulerMarks = useMemo(() => {
    const totalSeconds = Math.max(5, Math.ceil(effectiveTotalFrames / 30));
    const step = totalSeconds <= 20 ? 5 : totalSeconds <= 45 ? 10 : 15;
    const marks: Array<{ second: number; pct: number; label: string }> = [];
    for (let s = 0; s <= totalSeconds; s += step) {
      const pct = Math.min(100, ((s * 30) / effectiveTotalFrames) * 100);
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      marks.push({
        second: s,
        pct,
        label: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      });
    }
    return marks;
  }, [effectiveTotalFrames]);

  const playheadPercent = Math.min(
    100,
    Math.max(0, (currentFrame / Math.max(1, effectiveTotalFrames - 1)) * 100)
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f0f11] text-slate-200">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-3 w-3 animate-ping rounded-full bg-amber-500" />
          <span>A carregar Fragata Shorts Studio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f0f11] text-slate-200 select-none">
      {/* ====================================================================
          1. BARRA SUPERIOR (Top Bar - 60px)
         ==================================================================== */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#2c2c32]/50 bg-[#141418] px-5 z-30">
        {/* Esquerda: Botão de Voltar + Logo Fragata Shorts */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            title="Voltar ao Dashboard"
            aria-label="Voltar ao Dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2c2c32]/80 bg-[#1c1c22] text-slate-200 transition hover:border-white/20 hover:bg-[#24242c] hover:text-white"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <img
            src="/logo/fragata_shorts_logo.png"
            alt="Fragata Shorts"
            onClick={() => navigate('/')}
            className="h-9 w-auto cursor-pointer object-contain transition-transform hover:scale-105 active:scale-95"
          />
        </div>

        {/* Centro: Título do Vídeo em Destaque (Duplo Clique para Editar) */}
        <div className="flex items-center gap-3 min-w-0 px-4">
          {isEditingTitle ? (
            <form
              ref={titleFormRef}
              onSubmit={(e) => void handleSaveTitle(e)}
              className="flex items-center gap-2"
            >
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={isSavingTitle}
                placeholder="Digite o título do vídeo..."
                className="w-[240px] sm:w-[360px] md:w-[440px] rounded-xl border border-amber-500/60 bg-[#1c1c22] px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="submit"
                disabled={isSavingTitle || !titleDraft.trim()}
                className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingTitle ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          ) : (
            <h1
              onDoubleClick={handleStartEditTitle}
              title="Clique duas vezes para alterar o título"
              className="cursor-pointer truncate max-w-[260px] sm:max-w-[460px] md:max-w-[600px] rounded-lg px-2 py-1 text-[15px] font-semibold tracking-tight text-slate-100 transition hover:bg-white/5 hover:text-amber-300"
            >
              {theme || 'Sem Título'}
            </h1>
          )}

          {/* Notificação Compacta Flutuante */}
          {errorMsg && (
            <div className="hidden xl:flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-[11px] text-rose-200">
              <span className="truncate max-w-[240px]">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-400 hover:text-white font-bold"
              >
                ×
              </button>
            </div>
          )}
          {!errorMsg && successMsg && (
            <div className="hidden xl:flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-200">
              <span className="truncate max-w-[240px]">{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-400 hover:text-white font-bold"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Direita: Pílula temporária de progresso + Menu de 3 Pontos Verticais */}
        <div className="relative flex items-center gap-2.5" ref={optionsMenuRef}>
          {(isRerendering || isPending || isDownloadingMp4) && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-sm">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span>
                {isDownloadingMp4 ? 'Baixando MP4...' : 'Renderizando MP4...'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
            title="Mais opções"
            aria-label="Mais opções"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2c2c32]/80 bg-[#1c1c22] text-slate-200 transition hover:border-white/20 hover:bg-[#24242c] hover:text-white"
          >
            {isRerendering || isPending || isDownloadingMp4 ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            ) : (
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            )}
          </button>

          {isOptionsMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#2c2c32] bg-[#1c1c22] p-1.5 shadow-2xl shadow-black/90 z-50">
              <button
                type="button"
                disabled={
                  isRerendering || isPending || isDownloadingMp4 || !hasScript
                }
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  void handleExportMp4Click();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-100 transition hover:bg-amber-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                  />
                </svg>
                <span>
                  {isRerendering || isPending
                    ? 'Renderizando MP4...'
                    : isDownloadingMp4
                      ? 'Baixando MP4...'
                      : 'Exportar MP4'}
                </span>
              </button>

              <div className="my-1 border-t border-[#2c2c32]/80" />

              <button
                type="button"
                disabled={isDeletingVideo}
                onClick={() => {
                  setIsOptionsMenuOpen(false);
                  setDeleteConfirmInput('');
                  setIsDeleteModalOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-400 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>Excluir Vídeo</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ====================================================================
          2. WORKSPACE PRINCIPAL (Sidebar Esquerda + Divisor + Coluna Direita)
         ==================================================================== */}
      <div
        ref={workspaceContainerRef}
        className="flex flex-1 min-h-0 flex-row p-3 overflow-hidden"
      >
        {/* ------------------------------------------------------------------
            SIDEBAR ESQUERDA (Inspetor com Abas Horizontais + Footer de Ação)
           ------------------------------------------------------------------ */}
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="flex shrink-0 flex-col rounded-2xl border border-[#2c2c32]/50 bg-[#18181c] overflow-hidden shadow-2xl"
        >
          {/* Abas Horizontais no Topo da Sidebar */}
          <div className="grid grid-cols-3 border-b border-[#2c2c32]/60 bg-[#151519] px-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('briefing')}
              className={`flex items-center justify-center gap-1.5 border-b-2 py-3.5 px-3 text-xs font-semibold transition-all ${
                activeTab === 'briefing'
                  ? 'border-amber-500 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[13px]">📝</span>
              <span>1. Roteiro</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('storyboard')}
              className={`flex items-center justify-center gap-1.5 border-b-2 py-3.5 px-3 text-xs font-semibold transition-all ${
                activeTab === 'storyboard'
                  ? 'border-amber-500 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[13px]">🎬</span>
              <span>2. Cenas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subtitles')}
              className={`flex items-center justify-center gap-1.5 border-b-2 py-3.5 px-3 text-xs font-semibold transition-all ${
                activeTab === 'subtitles'
                  ? 'border-amber-500 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-[13px]">💬</span>
              <span>3. Legendas</span>
            </button>
          </div>

          {/* Feedback Mobile/Tablet */}
          {(errorMsg || successMsg) && (
            <div className="xl:hidden px-4 pt-3 shrink-0">
              {errorMsg && (
                <div className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                  <span>{errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="ml-2 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
              {!errorMsg && successMsg && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
                  <span>{successMsg}</span>
                  <button
                    type="button"
                    onClick={() => setSuccessMsg(null)}
                    className="ml-2 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Conteúdo Scrollável da Sidebar */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {/* ==============================================================
                ABA 1: SALA DE IDEAÇÃO & CAMARIM 360º (Módulos 1, 2 e 3)
               ============================================================== */}
            <div className={activeTab === 'briefing' ? 'block' : 'hidden'}>
              <IdeationDressingRoomTab
                videoId={id}
                theme={theme}
                setTheme={setTheme}
                suggestedThemes={SUGGESTED_THEMES}
                durationPreset={durationPreset}
                setDurationPreset={setDurationPreset}
                durationOptions={DURATION_OPTIONS}
                bgmVibe={bgmVibe}
                setBgmVibe={setBgmVibe}
                episodeFormat={episodeFormat}
                setEpisodeFormat={setEpisodeFormat}
                seriesContext={seriesContext}
                setSeriesContext={setSeriesContext}
                availableSeries={availableSeries}
                protagonistAgency={protagonistAgency}
                setProtagonistAgency={setProtagonistAgency}
                contentBalance={contentBalance}
                setContentBalance={setContentBalance}
                avatarConfig={avatarConfig}
                setAvatarConfig={setAvatarConfig}
                ideationOptions={ideationOptions}
                isGeneratingIdeas={isGeneratingScript}
                onGenerateIdeas={handleGenerateScript}
                finalMixScenes={finalMixScenes}
                setFinalMixScenes={setFinalMixScenes}
                isApprovingScript={isApprovingScript}
                onApproveFinalScript={(approvedTitle) =>
                  void handleApproveFinalScript(approvedTitle)
                }
                sfxOptions={sfxLibraryOptions}
                onReloadSfxLibrary={loadSfxLibrary}
              />
            </div>

            {/* ==============================================================
                ABA 2: STORYBOARD (Cards de Cena Espaçados + B-Roll 9:16)
               ============================================================== */}
            <div className={activeTab === 'storyboard' ? 'block' : 'hidden'}>
              <>
                {!hasScript ? (
                  <div className="rounded-xl bg-[#202024]/60 border border-white/[0.05] p-6 text-center space-y-3">
                    <div className="text-2xl">🎬</div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Nenhum Roteiro Ativo
                    </h3>
                    <p className="text-xs text-slate-400">
                      Comece na aba 1. Roteiro para gerar as cenas do seu vídeo.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('briefing')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950"
                    >
                      <span>Ir para 1. Roteiro</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[calc(100vh-210px)] overflow-y-auto pr-1.5 custom-scrollbar">
                    {scenes.map((scene, index) => {
                      const isGeneratingImg = Boolean(
                        generatingImageForScene[index]
                      );
                      const isCollapsed =
                        collapsedScenes[index] !== undefined
                          ? collapsedScenes[index]
                          : true;
                      const spriteUrl = resolveAssetSrc(scene.avatarSprite);
                      const sceneSegment = effectiveBackgroundTimeline[index];

                      return (
                        <div
                          key={index}
                          className="p-5 rounded-xl bg-[#202024]/60 border border-white/[0.04] mb-4 hover:border-white/[0.1] transition-all"
                        >
                          {/* Cabeçalho do Card da Cena */}
                          <div
                            onClick={() => toggleSceneCollapse(index)}
                            className="flex cursor-pointer items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sceneSegment) {
                                    seekToFrame(sceneSegment.frameStart);
                                  }
                                }}
                                title="Posicionar agulha nesta cena"
                                className="text-sm font-bold text-slate-100 hover:text-amber-400 transition"
                              >
                                Cena #{index + 1}
                              </button>
                              {scene.selectedImage && (
                                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                  ✓ Pronta
                                </span>
                              )}
                            </div>

                            <span className="text-xs text-slate-400 transition-transform">
                              {isCollapsed ? '⌄' : '⌃'}
                            </span>
                          </div>

                          {/* Corpo da Cena */}
                          {!isCollapsed && (
                            <div className="mt-4 space-y-3.5">
                              {/* Campo: Cenário (Visual) */}
                              {scene.visual_description && (
                                <div className="rounded-lg bg-[#141418] border border-[#272730] px-3 py-2 text-xs text-slate-300">
                                  <span className="font-semibold text-amber-400 mr-1.5">
                                    🖼️ Cenário:
                                  </span>
                                  <span className="italic">
                                    {scene.visual_description}
                                  </span>
                                </div>
                              )}

                              {/* Diálogos Dinâmicos da Cena (Suporta Múltiplas Falas) */}
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-slate-300">
                                  Falas / Diálogos da Cena
                                </label>
                                {getSceneDialogues(scene).map(
                                  (dialogue, dIdx, arr) => {
                                    const isCharacter =
                                      dialogue.speaker === 'character';
                                    const currentCharVoice =
                                      voiceCatalog.characters.find(
                                        (v) => v.id === dialogue.voiceId
                                      ) || voiceCatalog.characters[0];
                                    const rolePreviewUrl =
                                      dialogue.speaker === 'protagonist'
                                        ? voiceCatalog.protagonist.preview_url
                                        : dialogue.speaker === 'narrator'
                                          ? voiceCatalog.narrator.preview_url
                                          : currentCharVoice?.preview_url;
                                    const roleVoiceName =
                                      dialogue.speaker === 'protagonist'
                                        ? voiceCatalog.protagonist.name
                                        : dialogue.speaker === 'narrator'
                                          ? voiceCatalog.narrator.name
                                          : currentCharVoice?.name;

                                    return (
                                      <div
                                        key={dialogue.id || `dlg_${dIdx}`}
                                        className="flex flex-col sm:flex-row items-start gap-2.5 rounded-lg border border-[#272730] bg-[#141418] p-2.5 transition hover:border-[#383844]"
                                      >
                                        <div className="w-full sm:w-44 shrink-0 space-y-1.5">
                                          {/* Seletor de Papel + Preview de Áudio */}
                                          <div className="flex items-center gap-1.5">
                                            <select
                                              value={dialogue.speaker}
                                              onChange={(e) =>
                                                handleUpdateDialogueInStudio(
                                                  index,
                                                  dialogue.id,
                                                  'speaker',
                                                  e.target.value
                                                )
                                              }
                                              className="flex-1 rounded-md border border-[#30303c] bg-[#202028] px-2 py-1.5 text-[11px] font-bold text-amber-300 focus:border-amber-500 focus:outline-none"
                                            >
                                              <option value="protagonist">
                                                🧑 Protagonista
                                              </option>
                                              <option value="character">
                                                🎭 Personagem
                                              </option>
                                              <option value="narrator">
                                                🎙️ Narrador
                                              </option>
                                            </select>
                                            <VoicePreviewButton
                                              previewUrl={rolePreviewUrl}
                                              voiceName={roleVoiceName}
                                            />
                                          </div>

                                          {/* Configurações específicas quando for Personagem Secundário */}
                                          {isCharacter && (
                                            <div className="space-y-1 rounded bg-[#1a1a22] p-1.5 border border-[#2a2a36]">
                                              {/* Seletor de Voz de Personagem */}
                                              <div className="flex items-center gap-1">
                                                <select
                                                  value={
                                                    dialogue.voiceId ||
                                                    currentCharVoice?.id
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateDialogueInStudio(
                                                      index,
                                                      dialogue.id,
                                                      'voiceId',
                                                      e.target.value
                                                    )
                                                  }
                                                  title="Voz do Personagem (ElevenLabs)"
                                                  className="w-full rounded border border-[#323242] bg-[#22222d] px-1.5 py-1 text-[10px] font-semibold text-slate-200 focus:border-amber-500 focus:outline-none"
                                                >
                                                  {voiceCatalog.characters.map(
                                                    (v) => (
                                                      <option
                                                        key={v.id}
                                                        value={v.id}
                                                      >
                                                        {v.gender === 'female'
                                                          ? '👩'
                                                          : '👨'}{' '}
                                                        {v.name} (
                                                        {v.gender === 'female'
                                                          ? 'Fem'
                                                          : 'Masc'}
                                                        )
                                                      </option>
                                                    )
                                                  )}
                                                </select>
                                              </div>

                                              {/* Nome do Personagem */}
                                              <input
                                                type="text"
                                                value={
                                                  dialogue.characterName || ''
                                                }
                                                onChange={(e) =>
                                                  handleUpdateDialogueInStudio(
                                                    index,
                                                    dialogue.id,
                                                    'characterName',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Nome (ex: Cleópatra)"
                                                className="w-full rounded border border-[#323242] bg-[#16161e] px-1.5 py-0.5 text-[10px] text-amber-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex-1 w-full flex items-start gap-1.5">
                                          <textarea
                                            rows={isCharacter ? 3 : 2}
                                            value={dialogue.text}
                                            onChange={(e) =>
                                              handleUpdateDialogueInStudio(
                                                index,
                                                dialogue.id,
                                                'text',
                                                e.target.value
                                              )
                                            }
                                            placeholder={`Fala #${dIdx + 1} / Legenda...`}
                                            className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] p-2 text-xs text-slate-100 font-medium leading-relaxed focus:border-amber-500 focus:outline-none transition resize-none"
                                          />

                                          {arr.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveDialogueInStudio(
                                                  index,
                                                  dialogue.id
                                                )
                                              }
                                              title="Remover esta fala"
                                              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25 hover:text-rose-200"
                                            >
                                              ×
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                )}

                                <div className="flex justify-end pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddDialogueInStudio(index)
                                    }
                                    title="Adicionar mais uma fala nesta mesma cena"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#3a3a46] bg-[#16161b] px-2.5 py-1 text-[11px] font-medium text-amber-400/90 transition hover:border-amber-500/60 hover:bg-[#1f1f26] hover:text-amber-300 active:scale-[0.98]"
                                  >
                                    <span className="text-xs font-bold leading-none">
                                      +
                                    </span>
                                    <span>Nova Fala</span>
                                  </button>
                                </div>
                              </div>

                              {/* Campo: Expressão do Avatar */}
                              <div>
                                <label className="block text-xs text-slate-400 mb-1.5">
                                  Expressão
                                </label>
                                <div className="flex items-center gap-2">
                                  <img
                                    src={spriteUrl}
                                    alt="Avatar"
                                    className="h-8 w-8 shrink-0 rounded-lg border border-[#2c2c32]/80 bg-[#121214] object-contain p-0.5"
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
                                    className="w-full rounded-lg border border-[#2c2c32]/80 bg-[#121214] py-2 px-3 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
                                  >
                                    {AVAILABLE_AVATAR_SPRITES.map((sprite) => (
                                      <option key={sprite} value={sprite}>
                                        {sprite.replace('avatars/', '')}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Campo: Prompt visual */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="block text-xs text-slate-400">
                                    Prompt visual
                                  </label>
                                  <button
                                    type="button"
                                    disabled={
                                      generatingPromptForScene[index] ||
                                      !getSceneFullText(scene).trim()
                                    }
                                    onClick={() =>
                                      void handleRegenerateScenePromptInStudio(
                                        index
                                      )
                                    }
                                    title="Regenerar prompt visual com IA a partir da fala"
                                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 disabled:opacity-40 transition"
                                  >
                                    {generatingPromptForScene[index] ? (
                                      <>
                                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amber-300 border-t-transparent" />
                                        <span>Criando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🪄</span>
                                        <span>Gerar com IA</span>
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
                                  className="w-full rounded-lg border border-[#2c2c32]/80 bg-[#121214] px-3 py-2.5 text-xs text-slate-300 leading-relaxed focus:border-amber-500 focus:outline-none transition"
                                />
                              </div>

                              {/* Secção B-Roll */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs text-slate-400">
                                    Imagens
                                  </label>
                                </div>

                                {/* Cards B-Roll Verticais 9:16 com Overlay e Badge */}
                                {scene.candidateImages &&
                                  scene.candidateImages.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 mb-3">
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
                                              className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                                                isSelected
                                                  ? 'border-emerald-400 ring-2 ring-emerald-400/25 shadow-lg shadow-emerald-500/10 scale-[1.01]'
                                                  : 'border-[#2c2c32]/80 opacity-80 hover:border-white/25 hover:opacity-100'
                                              }`}
                                            >
                                              <div className="aspect-[9/16] max-h-40 w-full bg-[#121214]">
                                                <img
                                                  src={resolveAssetSrc(imgUrl)}
                                                  alt={`Cena ${index + 1} - Opção ${optIdx + 1}`}
                                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                              </div>

                                              {/* Botão Superior Direito (Hover): Ampliar / Visualizar Cenário */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setPreviewBrollModal({
                                                    sceneIndex: index,
                                                    optionIndex: optIdx,
                                                    imageUrl: imgUrl,
                                                  });
                                                }}
                                                title="Ampliar cenário"
                                                aria-label={`Ampliar Cena ${index + 1} - Opção ${optIdx + 1}`}
                                                className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/75 text-slate-100 opacity-0 shadow-md backdrop-blur-xs transition-all duration-150 group-hover:opacity-100 hover:scale-105 hover:border-amber-400/60 hover:bg-black/90 hover:text-amber-300"
                                              >
                                                <svg
                                                  className="h-3.5 w-3.5"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  stroke="currentColor"
                                                  strokeWidth={2}
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                                  />
                                                </svg>
                                              </button>

                                              {/* Botão Inferior Esquerdo (Hover): Excluir Imagem B-Roll (apenas imagens não selecionadas) */}
                                              {!isSelected && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleDeleteBrollImage(
                                                      index,
                                                      imgUrl
                                                    );
                                                  }}
                                                  title="Excluir esta imagem"
                                                  aria-label={`Excluir imagem da Cena ${index + 1}`}
                                                  className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/75 text-slate-300 opacity-0 shadow-md backdrop-blur-xs transition-all duration-150 group-hover:opacity-100 hover:scale-105 hover:border-rose-500/60 hover:bg-black/90 hover:text-rose-400"
                                                >
                                                  <svg
                                                    className="h-3.5 w-3.5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                  </svg>
                                                </button>
                                              )}
                                            </div>
                                          );
                                        }
                                      )}
                                    </div>
                                  )}

                                {/* Botões de Imagem: Adicionar Manual (Esquerda) e Gerar IA (Direita) */}
                                <div className="grid grid-cols-2 gap-2.5">
                                  {/* Botão da Esquerda: Adicionar Imagem Manualmente */}
                                  <label
                                    htmlFor={`upload-scene-file-${index}`}
                                    className={`flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#222228] py-2.5 px-3 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#2c2c34] active:scale-[0.99] cursor-pointer ${
                                      isUploadingManualImage[index]
                                        ? 'cursor-not-allowed opacity-60'
                                        : ''
                                    }`}
                                  >
                                    {isUploadingManualImage[index] ? (
                                      <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
                                        <span>Enviando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>📁</span>
                                        <span>Adicionar Imagem</span>
                                      </>
                                    )}
                                  </label>
                                  <input
                                    type="file"
                                    id={`upload-scene-file-${index}`}
                                    accept="image/*"
                                    disabled={Boolean(
                                      isUploadingManualImage[index]
                                    )}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        void handleManualImageUpload(
                                          index,
                                          file
                                        );
                                      }
                                      e.target.value = '';
                                    }}
                                  />

                                  {/* Botão da Direita: Gerar IA */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGenerateSceneImages(index)
                                    }
                                    disabled={
                                      isGeneratingImg ||
                                      !scene.imagePrompt.trim()
                                    }
                                    className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 hover:border-amber-500/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isGeneratingImg ? (
                                      <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                        <span>Gerando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>✨</span>
                                        <span>Gerar IA</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            </div>

            {/* ==============================================================
                ABA 3: LEGENDAS (Estilos Customizáveis + Posição + Blocos Sincronizados)
               ============================================================== */}
            <div className={activeTab === 'subtitles' ? 'block' : 'hidden'}>
              <div className="space-y-3.5">
                {/* 1. Card Recolhível: Estilo & Animação das Legendas (Padrão: Recolhido) */}
                <div className="rounded-xl bg-[#202024]/70 border border-white/[0.06] p-4 hover:border-white/[0.1] transition-all">
                  <div
                    onClick={toggleSubtitleStyleCollapsed}
                    className="flex cursor-pointer items-center justify-between gap-2"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">
                        Estilo &amp; Animação das Legendas
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Alterações aplicadas em tempo real no vídeo
                      </p>
                    </div>
                  </div>

                  {!isSubtitleStyleCollapsed && (
                    <div className="mt-4 space-y-4 border-t border-white/[0.05] pt-4 max-h-[420px] overflow-y-auto pr-1.5 custom-scrollbar">
                      {/* 1. Tipo de Animação (Karaokê / Pop TikTok / Hormozi) */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Tipo de Animação
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              {
                                id: 'karaoke',
                                icon: '🎤',
                                title: 'Karaokê',
                                desc: 'Realce por palavra',
                              },
                              {
                                id: 'pop',
                                icon: '💥',
                                title: 'Pop TikTok',
                                desc: 'Blocos 3-4 palavras',
                              },
                              {
                                id: 'hormozi',
                                icon: '⚡',
                                title: 'Hormozi',
                                desc: '1 palavra por vez',
                              },
                            ] as Array<{
                              id: SubtitleAnimationType;
                              icon: string;
                              title: string;
                              desc: string;
                            }>
                          ).map((opt) => {
                            const isSelected =
                              subtitleStyle.animationType === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  handleSubtitleStyleChange(
                                    'animationType',
                                    opt.id
                                  )
                                }
                                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                                  isSelected
                                    ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm'
                                    : 'border-[#2c2c32]/80 bg-[#141418] text-slate-300 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                  <span>{opt.icon}</span>
                                  <span>{opt.title}</span>
                                </div>
                                <span className="mt-0.5 text-[10px] text-slate-400">
                                  {opt.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Estilo da Fonte */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Fonte
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(
                            [
                              { id: 'montserrat', label: 'Montserrat' },
                              { id: 'impact', label: 'Impacto' },
                              { id: 'grotesque', label: 'Grotesque' },
                              { id: 'script', label: 'Script' },
                            ] as Array<{
                              id: SubtitleFontFamily;
                              label: string;
                            }>
                          ).map((fontOpt) => {
                            const active =
                              subtitleStyle.fontFamily === fontOpt.id;
                            return (
                              <button
                                key={fontOpt.id}
                                type="button"
                                onClick={() =>
                                  handleSubtitleStyleChange(
                                    'fontFamily',
                                    fontOpt.id
                                  )
                                }
                                className={`rounded-lg border py-1.5 px-2 text-[11px] font-semibold transition ${
                                  active
                                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                                    : 'border-[#2c2c32]/80 bg-[#141418] text-slate-300 hover:border-white/20'
                                }`}
                              >
                                {fontOpt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Tamanho do Texto (Slider) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-300">
                            Tamanho do Texto
                          </span>
                          <span className="font-mono text-amber-400">
                            {subtitleStyle.fontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={36}
                          max={96}
                          step={2}
                          value={subtitleStyle.fontSize}
                          onChange={(e) =>
                            handleSubtitleStyleChange(
                              'fontSize',
                              Number(e.target.value)
                            )
                          }
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#121214] accent-amber-500"
                        />
                      </div>

                      {/* 4. Paleta de Cores (Cor Principal + Cor de Destaque) */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Cor Principal */}
                        <div className="rounded-lg border border-[#2c2c32]/70 bg-[#141418] p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-300">
                              Cor Principal
                            </span>
                            <input
                              type="color"
                              value={subtitleStyle.primaryColor}
                              onChange={(e) =>
                                handleSubtitleStyleChange(
                                  'primaryColor',
                                  e.target.value
                                )
                              }
                              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {['#FFFFFF', '#F8FAFC', '#FEF08A', '#A7F3D0'].map(
                              (hex) => (
                                <button
                                  key={hex}
                                  type="button"
                                  onClick={() =>
                                    handleSubtitleStyleChange(
                                      'primaryColor',
                                      hex
                                    )
                                  }
                                  style={{ backgroundColor: hex }}
                                  className={`h-5 w-5 rounded-full border transition ${
                                    subtitleStyle.primaryColor.toLowerCase() ===
                                    hex.toLowerCase()
                                      ? 'scale-110 border-amber-400 ring-2 ring-amber-400/40'
                                      : 'border-white/25 opacity-80 hover:opacity-100'
                                  }`}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {/* Cor de Destaque */}
                        <div className="rounded-lg border border-[#2c2c32]/70 bg-[#141418] p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-300">
                              Cor de Destaque
                            </span>
                            <input
                              type="color"
                              value={subtitleStyle.highlightColor}
                              onChange={(e) =>
                                handleSubtitleStyleChange(
                                  'highlightColor',
                                  e.target.value
                                )
                              }
                              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {[
                              '#FBBF24',
                              '#22C55E',
                              '#EF4444',
                              '#38BDF8',
                              '#F472B6',
                            ].map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                onClick={() =>
                                  handleSubtitleStyleChange(
                                    'highlightColor',
                                    hex
                                  )
                                }
                                style={{ backgroundColor: hex }}
                                className={`h-5 w-5 rounded-full border transition ${
                                  subtitleStyle.highlightColor.toLowerCase() ===
                                  hex.toLowerCase()
                                    ? 'scale-110 border-white ring-2 ring-amber-400/50'
                                    : 'border-white/25 opacity-80 hover:opacity-100'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 5. Efeitos de Estilo (Switches: Sombra, Borda Preta, Fundo Translúcido) */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Efeitos de Leitura
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { field: 'hasStroke', label: 'Borda Preta' },
                              { field: 'hasShadow', label: 'Sombra' },
                              { field: 'hasBackground', label: 'Fundo Box' },
                            ] as Array<{
                              field: 'hasStroke' | 'hasShadow' | 'hasBackground';
                              label: string;
                            }>
                          ).map((eff) => {
                            const isOn = Boolean(subtitleStyle[eff.field]);
                            return (
                              <button
                                key={eff.field}
                                type="button"
                                onClick={() =>
                                  handleSubtitleStyleChange(eff.field, !isOn)
                                }
                                className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] font-medium transition ${
                                  isOn
                                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                    : 'border-[#2c2c32]/80 bg-[#141418] text-slate-400 hover:border-white/15'
                                }`}
                              >
                                <span>{eff.label}</span>
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isOn ? 'bg-emerald-400' : 'bg-slate-600'
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 6. Posicionamento no Vídeo (Presets + Sliders + Arraste Direto) */}
                      <div className="space-y-2 border-t border-white/[0.06] pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">
                            Posição no Vídeo
                          </span>
                          <div className="flex items-center gap-1">
                            {[
                              { label: 'Topo', x: 50, y: 20 },
                              { label: 'Centro', x: 50, y: 50 },
                              { label: 'Base', x: 50, y: 88 },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  handleSubtitleStyleChange(
                                    'positionX',
                                    preset.x
                                  );
                                  handleSubtitleStyleChange(
                                    'positionY',
                                    preset.y
                                  );
                                }}
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                                  Math.abs(
                                    subtitleStyle.positionY - preset.y
                                  ) <= 3
                                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                                    : 'border-[#2c2c32] bg-[#141418] text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Vertical (Y)</span>
                              <span className="font-mono text-slate-200">
                                {subtitleStyle.positionY}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={92}
                              value={subtitleStyle.positionY}
                              onChange={(e) =>
                                handleSubtitleStyleChange(
                                  'positionY',
                                  Number(e.target.value)
                                )
                              }
                              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#121214] accent-amber-500"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Horizontal (X)</span>
                              <span className="font-mono text-slate-200">
                                {subtitleStyle.positionX}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={15}
                              max={85}
                              value={subtitleStyle.positionX}
                              onChange={(e) =>
                                handleSubtitleStyleChange(
                                  'positionX',
                                  Number(e.target.value)
                                )
                              }
                              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#121214] accent-amber-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAssembleVideo();
                          }}
                          disabled={!hasScript}
                          className=" rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 shadow-sm hover:bg-amber-400 transition disabled:opacity-40"
                        >
                          Salvar Estilo
                        </button>
                    </div>
                    </div>
                  )}
                </div>

                {/* 2. Card Recolhível: Blocos de Fala (Padrão: Recolhido) */}
                <div className="rounded-xl bg-[#202024]/60 border border-white/[0.05] p-4 hover:border-white/[0.1] transition-all">
                  <div
                    onClick={toggleSubtitleBlocksCollapsed}
                    className="flex cursor-pointer items-center justify-between gap-2"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">
                        Blocos de Fala ({effectiveSubtitles.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Frases curtas sincronizadas com o ritmo da fala (30 FPS)
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 transition-transform">
                      {isSubtitleBlocksCollapsed ? '⌄' : '⌃'}
                    </span>
                  </div>

                  {!isSubtitleBlocksCollapsed && (
                    <div className="mt-4 border-t border-white/[0.05] pt-3.5">
                      {effectiveSubtitles.length === 0 ? (
                        <div className="rounded-xl bg-[#141418] border border-white/[0.04] p-5 text-center space-y-2">
                          <p className="text-xs text-slate-400">
                            Gere o roteiro na aba 1 para visualizar e editar os blocos de legenda.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {effectiveSubtitles.map((sub, index) => {
                            const isCurrentBlock =
                              index === activeSubtitleIndexAtPlayhead;
                            return (
                              <div
                                key={index}
                                className={`rounded-xl border p-3.5 transition-all space-y-2 ${
                                  isCurrentBlock
                                    ? 'bg-[#26262e] border-amber-500/50 shadow-sm'
                                    : 'bg-[#18181c] border-white/[0.04] hover:border-white/[0.1]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => seekToFrame(sub.frameStart)}
                                    title="Ir para este trecho no Player"
                                    className="shrink-0 rounded-md bg-[#121214] border border-[#2c2c32] px-2 py-1 font-mono text-[10px] font-bold text-amber-400 hover:border-amber-500/50"
                                  >
                                    #{index + 1}
                                  </button>

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
                                    className="w-full rounded-lg border border-[#2c2c32]/80 bg-[#121214] px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                  />
                                </div>

                                {/* Informação de Frame Mono-espaçada abaixo do Input */}
                                <div className="flex items-center justify-between pl-1">
                                  <span className="font-mono text-[10px] text-slate-400 opacity-60">
                                    Frames: {sub.frameStart}f – {sub.frameEnd}f (
                                    {(sub.frameStart / 30).toFixed(1)}s –{' '}
                                    {(sub.frameEnd / 30).toFixed(1)}s)
                                  </span>

                                  <div className="flex items-center gap-1 font-mono text-[10px]">
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
                                      className="w-14 rounded border border-[#2c2c32] bg-[#121214] px-1.5 py-0.5 text-center text-slate-300 focus:border-amber-500 focus:outline-none"
                                    />
                                    <span className="text-slate-600">-</span>
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
                                      className="w-14 rounded border border-[#2c2c32] bg-[#121214] px-1.5 py-0.5 text-center text-slate-300 focus:border-amber-500 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==============================================================
                ABA 4: ÁUDIO & MIXAGEM (Narração + SFX Multiplier + BGM + Auto-Ducking)
               ============================================================== */}
            <div className={activeTab === 'audio' ? 'block' : 'hidden'}>
              <div className="space-y-4">
                {/* Cabeçalho da Seção de Áudio */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎵</span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-100">
                        Mixagem & Narração
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Ajuste os volumes globais da música, efeitos e grave a narração
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1. Card de Narração Multi-Voz (ElevenLabs) */}
                <div className="rounded-xl border border-[#2c2c32] bg-[#1c1c22] p-3.5 space-y-3">
                  <div
                    onClick={toggleAudioNarrationCollapsed}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <span className="text-xs font-bold text-slate-200 ">
                      <div className="flex items-center gap-1.5">
                      <span>🎙️</span>
                      <span>Narração</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Escolha sons disponíveis ou gere efeitos sonoros com a ElevenLabs
                      </p>
                      
                    </span>
                    <span className="text-xs text-slate-400">
                      {isAudioNarrationCollapsed ? '⌄' : '⌃'}
                    </span>
                  </div>

                  {!isAudioNarrationCollapsed && (
                    <>
                      {audioGenerated && audioSrc ? (
                        <div className="rounded-lg bg-[#141418] p-2 border border-white/[0.05]">
                          <audio
                            controls
                            src={resolveAssetSrc(audioSrc)}
                            className="w-full h-8"
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Nenhum áudio gerado ainda.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleGenerateAudio}
                        disabled={isGeneratingAudio || !hasScript}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2c2c32] bg-[#222228] py-2.5 px-3 text-xs font-semibold text-slate-100 transition hover:border-white/20 hover:bg-[#2a2a32] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isGeneratingAudio ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
                            <span>Gravando Narração...</span>
                          </>
                        ) : (
                          <>
                            <span>🎙️</span>
                            <span>{audioGenerated ? 'Regravar Narração' : 'Gravar Narração'}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* 2. Card de Mixagem Global de Áudio */}
                <div className="rounded-xl border border-[#2c2c32] bg-[#1c1c22] p-3.5 space-y-4">
                  <div
                    onClick={toggleAudioMixerCollapsed}
                    className="cursor-pointer flex items-center justify-between border-b border-[#2c2c32]/60 pb-2"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>🎚️</span>
                        <span>Mixer de Áudio</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Mudanças afetam a reprodução no player e a renderização final do MP4
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {isAudioMixerCollapsed ? '⌄' : '⌃'}
                    </span>
                  </div>

                  {!isAudioMixerCollapsed && (
                    <>
                      {/* Slider: SFX Multiplier */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <span>💥</span>
                            <span>Intensidade dos Efeitos (SFX)</span>
                          </span>
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                            {globalSfxMultiplier.toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={globalSfxMultiplier}
                          onChange={(e) => setGlobalSfxMultiplier(parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#2a2a32] rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>0.0x (Mudo)</span>
                          <span>1.0x (Padrão)</span>
                          <span>2.0x (Máximo)</span>
                        </div>
                      </div>

                      {/* Slider: BGM Volume */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <span>🎶</span>
                            <span>Volume da Música de Fundo (BGM)</span>
                          </span>
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                            {Math.round(bgmVolume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={bgmVolume}
                          onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#2a2a32] rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>0%</span>
                          <span>10% (Padrão)</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Toggle: Auto-Ducking */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#2c2c32]/60">
                        <div className="space-y-0.5 pr-3">
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>🔉</span>
                            <span>Reduzir música nas falas</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            Abaixa suavemente o volume da musica em momentos de diálogo.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoDucking}
                          onClick={() => setAutoDucking((prev) => !prev)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoDucking ? 'bg-amber-500' : 'bg-[#2a2a32]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              autoDucking ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. Card Granular: Efeitos Sonoros por Cena */}
                {/* 3. Card de Efeitos Sonoros por Cena (Sound Design Centralizado) */}
                <div className="rounded-xl border border-[#2c2c32] bg-[#1c1c22] p-3.5 space-y-3">
                  <div
                    onClick={toggleAudioSfxCollapsed}
                    className="cursor-pointer border-b border-[#2c2c32]/60 pb-2 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>🔊</span>
                        <span>Efeitos Sonoros por Cena</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Escolha sons disponíveis ou gere efeitos sonoros com a ElevenLabs
                      </p>
                    </div>
                   </div>

                  {!isAudioSfxCollapsed && (
                    <>
                      {scenes.length === 0 ? (
                        <div className="py-4 text-center">
                          <p className="text-xs text-slate-400 italic">
                            Nenhuma cena disponível no roteiro.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                          {scenes.map((scene, sceneIdx) => {
                            const sfxItems = getSceneSfxList(scene);
                            const hasActiveAudio =
                              Boolean(scene.custom_sfx_url) ||
                              (Boolean(scene.sfx_suggestion) &&
                                scene.sfx_suggestion !== 'none');
                            const activeSfxItem = sfxItems[0];
                            const previewKey = `sfx-${sceneIdx}-0`;
                            const isPlaying = playingSfxPreview === previewKey;
                            const resolvedAudioUrl = activeSfxItem
                              ? resolveSfxAudioUrl(activeSfxItem)
                              : '';
                            const currentVolume =
                              activeSfxItem?.suggested_volume ?? 0.35;
                            const isGeneratingThisSfx =
                              generatingSfxSceneIndex === sceneIdx;

                            return (
                              <div
                                key={`scene-sfx-group-${sceneIdx}`}
                                className="rounded-xl border border-white/[0.06] bg-[#16161b] p-3 space-y-2.5"
                              >
                                {/* Cabeçalho da Cena */}
                                <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                                  <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1.5">
                                    <span>🎬</span>
                                    <span>Cena #{sceneIdx + 1}</span>
                                  </span>
                                  <span
                                    className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px] truncate"
                                    title={scene.text}
                                  >
                                    {scene.text || 'Sem fala'}
                                  </span>
                                </div>

                                {/* Linha 1: Som Escolhido */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                                      <span>🔊 Som Escolhido:</span>
                                      {scene.sfx_label && (
                                        <span className="text-[9px] text-teal-300/80 font-normal">
                                          ({scene.sfx_label})
                                        </span>
                                      )}
                                    </label>

                                    {scene.custom_sfx_url && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                          ✨ ElevenLabs IA Ativo
                                        </span>
                                        <button
                                          type="button"
                                          disabled={
                                            promotingSfxSceneIndex === sceneIdx
                                          }
                                          title="Salvar este áudio na Biblioteca Global para reutilizar a custo zero"
                                          onClick={() =>
                                            void handlePromoteStoryboardSceneSfx(
                                              sceneIdx
                                            )
                                          }
                                          className="flex items-center gap-1 rounded bg-teal-500/25 hover:bg-teal-500/40 border border-teal-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-teal-200 transition disabled:opacity-50"
                                        >
                                          {promotingSfxSceneIndex ===
                                          sceneIdx ? (
                                            <span className="h-2 w-2 animate-spin rounded-full border border-teal-200 border-t-transparent" />
                                          ) : (
                                            <span>💾 Salvar</span>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          title="Remover áudio customizado"
                                          onClick={() =>
                                            handleRemoveCustomSfx(sceneIdx)
                                          }
                                          className="text-slate-400 hover:text-rose-400 transition text-[10px] ml-0.5"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <select
                                      value={
                                        scene.custom_sfx_url
                                          ? 'custom'
                                          : scene.sfx_suggestion || 'none'
                                      }
                                      onChange={(e) =>
                                        handleSceneSfxOptionChange(
                                          sceneIdx,
                                          e.target.value
                                        )
                                      }
                                      className="flex-1 rounded-lg border border-[#2c2c32] bg-[#1a1a22] py-1.5 px-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
                                    >
                                      <option value="none">
                                        🔇 Sem Efeito
                                      </option>
                                      {scene.custom_sfx_url && (
                                        <option value="custom">
                                          ✨ Áudio Gerado com IA (Ativo)
                                        </option>
                                      )}
                                      {sfxLibraryOptions
                                        .filter((opt) => opt.value !== 'none')
                                        .map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                    </select>

                                    {hasActiveAudio && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handlePlaySfxPreview(
                                            resolvedAudioUrl,
                                            previewKey
                                          )
                                        }
                                        title="Pré-escutar som"
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs transition ${
                                          isPlaying
                                            ? 'border-amber-400 bg-amber-500/20 text-amber-300 animate-pulse'
                                            : 'border-white/10 bg-[#252530] text-slate-200 hover:border-amber-500/50 hover:bg-[#2e2e3c]'
                                        }`}
                                      >
                                        {isPlaying ? '⏹' : '▶'}
                                      </button>
                                    )}
                                  </div>

                                  {hasActiveAudio && (
                                    <div className="rounded-lg bg-[#111115] p-2 space-y-1 border border-white/[0.04]">
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Volume do Efeito</span>
                                        <span className="font-mono text-amber-400 font-bold">
                                          {Math.round(currentVolume * 100)}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={currentVolume}
                                        onChange={(e) =>
                                          handleUpdateSceneSfxVolume(
                                            sceneIdx,
                                            0,
                                            parseFloat(e.target.value)
                                          )
                                        }
                                        className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#252530] rounded-lg"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Linha 2: Prompt Acústico & Botão Gerar */}
                                <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                                  <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                    <span className="text-teal-400">🎧</span>
                                    <span>Prompt Acústico (ElevenLabs):</span>
                                  </label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={scene.sfx_prompt || ''}
                                      onChange={(e) =>
                                        handleSceneFieldChange(
                                          sceneIdx,
                                          'sfx_prompt',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Ex: Sudden dry twig snapping in dead quiet forest..."
                                      className="flex-1 rounded-lg border border-[#2c2c32] bg-[#121216] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none transition italic"
                                    />
                                    <button
                                      type="button"
                                      disabled={
                                        isGeneratingThisSfx ||
                                        !scene.sfx_prompt?.trim()
                                      }
                                      onClick={() =>
                                        void handleGenerateSceneSfx(
                                          sceneIdx,
                                          scene.sfx_prompt || ''
                                        )
                                      }
                                      title="Gerar efeito sonoro exclusivo com a ElevenLabs Sound Effects"
                                      className="flex shrink-0 items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-[11px] font-bold text-teal-300 transition hover:bg-teal-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {isGeneratingThisSfx ? (
                                        <>
                                          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-teal-300 border-t-transparent" />
                                          <span>Gerando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>✨</span>
                                          <span>
                                            {hasActiveAudio
                                              ? 'Gerar'
                                              : '+ Efeito'}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ==============================================================
              BLOCO C: Rodapé Fixo da Sidebar (Abas Inferiores + CTA Global)
             ============================================================== */}
          <div className="shrink-0 flex flex-col mt-auto border-t border-[#2c2c32]/60 bg-[#141418]">
            {/* Linha 1 (Abas Inferiores - Idêntico ao Nav de Cima com Border Top) */}
            <div className="grid grid-cols-3 border-b border-[#2c2c32]/60 bg-[#151519] px-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('audio')}
                className={`flex items-center justify-center gap-1.5 border-t-2 py-3.5 px-3 text-xs font-semibold transition-all -mt-[1px] ${
                  activeTab === 'audio'
                    ? 'border-amber-500 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-[13px]">🎵</span>
                <span>4. Áudio</span>
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 border-t-2 border-transparent py-3.5 px-3 text-xs text-slate-500 opacity-50 cursor-not-allowed select-none -mt-[1px]"
              >
                <span className="text-[12px]">🔒</span>
                <span>5. Efeitos</span>
              </button>
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-1.5 border-t-2 border-transparent py-3.5 px-3 text-xs text-slate-500 opacity-50 cursor-not-allowed select-none -mt-[1px]"
              >
                <span className="text-[12px]">🔒</span>
                <span>6. Config</span>
              </button>
            </div>

            {/* Linha 2 (CTA Principal Global) */}
            <div className="p-3.5">
              <button
                type="button"
                onClick={handleAssembleVideo}
                disabled={!hasScript}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>🎬</span>
                <span>Montar Vídeo</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ------------------------------------------------------------------
            DIVISOR REDIMENSIONÁVEL ENTRE AS COLUNAS (Cursor <-> col-resize)
           ------------------------------------------------------------------ */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Arraste para ajustar a largura das colunas (duplo clique para restaurar)"
          title="Arraste para ajustar a largura das colunas (duplo clique para restaurar)"
          onMouseDown={handleSidebarResizeMouseDown}
          onDoubleClick={() => setSidebarWidth(420)}
          className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center select-none z-20"
        >
          {/* Linha de guia vertical que acende no hover ou durante o arraste */}
          <div
            className={`h-[95%] w-[2px] rounded-full transition-colors duration-150 ${
              isResizingSidebar
                ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]'
                : 'bg-transparent group-hover:bg-amber-500/60'
            }`}
          />
          {/* Pílula central de pega */}
          <div
            className={`absolute flex h-10 w-1.5 items-center justify-center rounded-full transition-all duration-150 ${
              isResizingSidebar
                ? 'bg-amber-400 scale-y-110 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                : 'bg-[#2c2c32]/90 group-hover:bg-amber-400'
            }`}
          />
        </div>

        {/* ------------------------------------------------------------------
            COLUNA DIREITA (Monitor Player 9:16 em cima + Timeline em baixo)
           ------------------------------------------------------------------ */}
        <div className="flex flex-1 min-w-[480px] max-w-[1480px] flex-col gap-3 overflow-hidden">
          {/* ================================================================
              PAINEL DO PLAYER CENTRAL (Vertical 9:16 + Barra Compacta)
             ================================================================ */}
          <section className="relative flex flex-1 min-h-0 flex-col items-center justify-center rounded-2xl border border-[#2c2c32]/50 bg-[#141417] p-4 overflow-hidden shadow-2xl">
            {isPending && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#18181c]/90 px-3 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                <span>Renderizando MP4 no servidor...</span>
              </div>
            )}

            {/* Wrapper Vertical 9:16 Único (Garante Mesma Largura para Vídeo e Controles) */}
            <div
              className="flex h-full max-h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-2xl shadow-black/80"
              style={{ aspectRatio: '9 / 16' }}
            >
              {/* Área Clicável do Vídeo (Clique para Pausar / Despausar) */}
              <div
                ref={videoCanvasRef}
                onClick={togglePlayPause}
                className="group/canvas relative flex-1 min-h-0 w-full cursor-pointer overflow-hidden bg-black"
              >
                <Player
                  ref={playerRef}
                  component={TimeMachineVideo}
                  inputProps={{
                    theme: theme || 'Sem título',
                    durationInFrames: effectiveTotalFrames,
                    backgroundSrc:
                      effectiveBackgroundTimeline[0]?.imageSrc || backgroundSrc,
                    backgroundTimeline: effectiveBackgroundTimeline,
                    audioSrc,
                    bgmVibe: effectiveBgmVibe,
                    bgmVolume,
                    sfxEnabled: true,
                    globalSfxMultiplier,
                    autoDucking,
                    subtitles: effectiveSubtitles,
                    subtitleStyle,
                    avatarTimeline: effectiveAvatarTimeline,
                    storyboard: {
                      durationPreset,
                      scenes,
                      audioGenerated,
                      isAssembled,
                      sceneTimings,
                      avatarConfig,
                      ideationOptions,
                      bgmVibe: effectiveBgmVibe,
                      episodeFormat,
                      seriesContext:
                        episodeFormat === 'series' ? seriesContext : undefined,
                      protagonistAgency,
                      contentBalance,
                    },
                  }}
                  durationInFrames={effectiveTotalFrames}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={30}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  loop
                />

                {/* Alça Interativa para Arrastar a Posição da Legenda sem Pausar/Despausar o Vídeo */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={handleSubtitleDragMouseDown}
                  title="Arraste para posicionar a legenda no vídeo"
                  style={{
                    left: `${subtitleStyle.positionX}%`,
                    top: `${subtitleStyle.positionY}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`group/subdrag absolute z-20 flex w-[82%] min-h-[54px] cursor-grab active:cursor-grabbing items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                    isDraggingSubtitle
                      ? 'border-amber-400 bg-amber-500/15 opacity-100 shadow-lg'
                      : activeTab === 'subtitles'
                        ? 'border-amber-400/55 bg-black/15 opacity-90 hover:border-amber-400 hover:bg-amber-500/10 hover:opacity-100'
                        : 'border-transparent opacity-0 group-hover/canvas:border-white/30 group-hover/canvas:opacity-100 hover:!border-amber-400 hover:!bg-amber-500/10'
                  }`}
                >
                  <span
                    className={`pointer-events-none -mt-11 rounded-md border border-amber-400/50 bg-black/85 px-2 py-0.5 text-[10px] font-semibold text-amber-300 shadow-md backdrop-blur-xs transition-opacity ${
                      isDraggingSubtitle
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/subdrag:opacity-100'
                    }`}
                  >
                    ✥ Arrastar Legenda ({subtitleStyle.positionX}%,{' '}
                    {subtitleStyle.positionY}%)
                  </span>
                </div>

                {/* Overlay Central quando o Vídeo está Pausado */}
                {!isPlaying && !isDraggingSubtitle && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition-opacity">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white shadow-2xl backdrop-blur-md">
                        <svg
                          className="h-6 w-6 translate-x-0.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra Compacta de Reprodução na Mesma Largura do Vídeo */}
              <div className="w-full shrink-0 border-t border-white/[0.08] bg-[#1c1c22] px-3.5 py-2.5">
                {/* Barra de Progresso Fina Clicável */}
                <div
                  onClick={handleTimelineSeek}
                  className="mb-2 h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-slate-200 transition-all duration-75"
                    style={{ width: `${playheadPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Botão Único Play / Pause */}
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      title={isPlaying ? 'Pausar' : 'Reproduzir'}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-200 hover:bg-white/10 hover:text-white transition"
                    >
                      {isPlaying ? (
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Botão Volume / Mute */}
                    <button
                      type="button"
                      onClick={toggleMute}
                      title={isMuted ? 'Ativar som' : 'Silenciar'}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      {isMuted ? (
                        <svg
                          className="h-4 w-4 text-rose-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="font-mono text-[11px] font-medium text-slate-300">
                    <span className="text-slate-100">
                      {formatShortTime(currentFrame)}
                    </span>
                    <span className="mx-1 text-slate-500">/</span>
                    <span className="text-slate-400">
                      {formatShortTime(effectiveTotalFrames)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              3. RODAPÉ DIREITO: LINHA DE TEMPO MULTI-TRACK
             ================================================================ */}
          <footer className="flex h-[225px] shrink-0 flex-col rounded-2xl border border-[#2c2c32]/50 bg-[#18181c] px-5 py-3.5 overflow-hidden shadow-2xl">
            {/* Cabeçalho da Timeline + Indicador ao Vivo do Momento da Agulha */}
            <div className="flex items-center justify-between gap-4 mb-2 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 text-xs font-semibold text-slate-200">
                  Linha de Tempo
                </span>
                {activeSceneIndexAtPlayhead >= 0 && (
                  <div className="flex items-center gap-2 min-w-0 rounded-md border border-white/[0.08] bg-[#121216] px-2.5 py-0.5 text-[11px]">
                    <span className="shrink-0 font-mono font-bold text-red-400">
                      {formatShortTime(currentFrame)}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="shrink-0 font-semibold text-teal-300">
                      Cena #{activeSceneIndexAtPlayhead + 1}
                    </span>
                  </div>
                )}
              </div>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {effectiveBackgroundTimeline.length} cenas •{' '}
                {effectiveSubtitles.length} legendas
              </span>
            </div>

            {/* Corpo das Faixas + Régua */}
            <div className="flex flex-1 min-h-0 flex-row overflow-hidden">
              {/* Coluna Esquerda: Labels das Tracks */}
              <div className="flex w-36 shrink-0 flex-col pr-3 z-20">
                {/* Espaço da Régua */}
                <div className="h-6 shrink-0" />

                {/* Label Track 1: Vídeo */}
                <div className="flex flex-1 items-center gap-2 text-xs font-medium text-slate-300">
                  <span className="text-xs opacity-80">📹</span>
                  <span className="truncate">Cenários</span>
                </div>

                {/* Label Track 2: Áudio */}
                <div className="flex flex-1 items-center gap-2 text-xs font-medium text-slate-300">
                  <span className="text-xs opacity-80">🎵</span>
                  <span className="truncate">Narração</span>
                  
                </div>

                {/* Label Track 3: Legendas */}
                <div className="flex flex-1 items-center gap-2 text-xs font-medium text-slate-300">
                  <span className="text-xs opacity-80">💬</span>
                  <span className="truncate">Legendas</span>
                </div>
              </div>

              {/* Área Direita: Régua de Tempo + 3 Faixas + Agulha Vermelha Arrastável */}
              <div
                ref={timelineContainerRef}
                onMouseDown={handleTimelineMouseDown}
                className={`relative flex flex-1 flex-col select-none ${
                  isScrubbingTimeline ? 'cursor-ew-resize' : 'cursor-pointer'
                }`}
              >
                {/* Agulha de Reprodução Arrastável (Playhead Vermelha Viva) */}
                <div
                  onMouseDown={handleTimelineMouseDown}
                  title="Arraste para navegar pelos cenários e legendas"
                  className="group/playhead absolute top-0 bottom-0 z-30 -ml-2 flex w-4 cursor-ew-resize justify-center"
                  style={{ left: `${playheadPercent}%` }}
                >
                  {/* Linha Vertical Vermelha */}
                  <div className="h-full w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.95)]" />

                  {/* Cabeça da Agulha no Topo */}
                  <div
                    className={`absolute top-0 h-4 w-3 rounded-xs bg-red-500 shadow-md transition-transform ${
                      isScrubbingTimeline
                        ? 'scale-125 ring-2 ring-red-300/70'
                        : 'group-hover/playhead:scale-110'
                    }`}
                  />
                </div>

                {/* Régua de Timecode Superior */}
                <div className="relative h-6 shrink-0 border-b border-white/[0.08]">
                  {rulerMarks.map((mark) => (
                    <div
                      key={mark.second}
                      className="absolute top-0 bottom-0 flex flex-col justify-between"
                      style={{ left: `${mark.pct}%` }}
                    >
                      <span className="-ml-3 font-mono text-[10px] text-slate-400">
                        {mark.label}
                      </span>
                      <span className="h-1.5 w-px bg-slate-500/70" />
                    </div>
                  ))}
                </div>

                {/* FAIXA 1: VÍDEO (Cenários em Teal com Miniatura e Destaque no Momento Atual) */}
                <div className="relative flex-1 my-1">
                  {effectiveBackgroundTimeline.map((seg, idx) => {
                    const leftPct =
                      (seg.frameStart / Math.max(1, effectiveTotalFrames)) *
                      100;
                    const widthPct =
                      ((seg.frameEnd - seg.frameStart + 1) /
                        Math.max(1, effectiveTotalFrames)) *
                      100;
                    const thumbSrc = resolveAssetSrc(
                      seg.imageSrc || 'background.jpg'
                    );
                    const isActiveScene = idx === activeSceneIndexAtPlayhead;
                    return (
                      <div
                        key={idx}
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(1, widthPct - 0.4)}%`,
                        }}
                        className={`absolute inset-y-0 overflow-hidden rounded-lg border flex items-center gap-2 pr-2 shadow-sm transition ${
                          isActiveScene
                            ? 'border-teal-200 bg-[#2f7d75] ring-1 ring-teal-300/40 brightness-110'
                            : 'border-teal-300/40 bg-[#266760] hover:brightness-110'
                        }`}
                      >
                        <img
                          src={thumbSrc}
                          alt={`Cena ${idx + 1}`}
                          draggable={false}
                          className="h-full w-9 shrink-0 object-cover border-r border-teal-300/30"
                        />
                        <span className="truncate text-xs font-semibold text-white drop-shadow-xs">
                          Cena #{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* FAIXA 2: ÁUDIO (Narração em Azul com Ondas Sonoras) */}
                <div className="relative flex-1 my-1">
                  <div className="absolute inset-0 overflow-hidden rounded-lg border border-sky-400/35 bg-[#24537a] flex items-center px-2">
                    {/* Waveform Bars Visual */}
                    <div className="flex w-full items-center justify-between gap-[2px] h-full py-1.5 opacity-85">
                      {WAVEFORM_BARS.map((heightPct, idx) => (
                        <span
                          key={idx}
                          className="flex-1 rounded-full bg-sky-200/80"
                          style={{ height: `${heightPct}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* FAIXA 3: LEGENDAS (Container Escuro com Pílulas Cinzas e Destaque no Momento Atual) */}
                <div className="relative flex-1 my-1 rounded-lg bg-[#232329] border border-white/[0.05] overflow-hidden">
                  {effectiveSubtitles.map((sub, idx) => {
                    const leftPct =
                      (sub.frameStart / Math.max(1, effectiveTotalFrames)) *
                      100;
                    const widthPct =
                      ((sub.frameEnd - sub.frameStart + 1) /
                        Math.max(1, effectiveTotalFrames)) *
                      100;
                    const isActiveSubtitle =
                      idx === activeSubtitleIndexAtPlayhead;
                    return (
                      <div
                        key={idx}
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(1.2, widthPct - 0.5)}%`,
                        }}
                        title={sub.text}
                        className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 flex items-center transition ${
                          isActiveSubtitle
                            ? 'border-amber-400/70 bg-[#5b5b6b] text-white shadow-sm'
                            : 'border-white/10 bg-[#484854] text-slate-100 hover:bg-[#565664]'
                        }`}
                      >
                        <span className="truncate text-[10px] font-medium">
                          {sub.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ====================================================================
          MODAL DE VISUALIZAÇÃO AMPLIADA DO CENÁRIO (B-ROLL 9:16)
         ==================================================================== */}
      {previewBrollModal && (
        <div
          onClick={() => setPreviewBrollModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#18181c] shadow-2xl"
          >
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#141418] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100">
                  Cena #{previewBrollModal.sceneIndex + 1}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  Opção {previewBrollModal.optionIndex + 1}
                </span>
                {scenes[previewBrollModal.sceneIndex]?.selectedImage ===
                  previewBrollModal.imageUrl && (
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    ✓ Aprovada
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPreviewBrollModal(null)}
                title="Fechar visualização (Esc)"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Imagem Vertical 9:16 Ampliada */}
            <div className="relative flex flex-1 min-h-0 items-center justify-center bg-black p-3">
              <img
                src={resolveAssetSrc(previewBrollModal.imageUrl)}
                alt={`Cena ${previewBrollModal.sceneIndex + 1} - Opção ${previewBrollModal.optionIndex + 1}`}
                className="max-h-[72vh] w-auto rounded-xl border border-white/10 object-contain shadow-2xl"
              />
            </div>

            {/* Rodapé do Modal: Trocar entre Opções da Cena ou Selecionar Cenário */}
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#141418] px-4 py-3">
              <div className="flex items-center gap-1.5">
                {scenes[previewBrollModal.sceneIndex]?.candidateImages?.map(
                  (candidateUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setPreviewBrollModal({
                          sceneIndex: previewBrollModal.sceneIndex,
                          optionIndex: idx,
                          imageUrl: candidateUrl,
                        })
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        previewBrollModal.optionIndex === idx
                          ? 'bg-amber-500 text-slate-950'
                          : 'border border-white/10 bg-[#202026] text-slate-300 hover:bg-[#2a2a32]'
                      }`}
                    >
                      Opção {idx + 1}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  handleSelectBrollImage(
                    previewBrollModal.sceneIndex,
                    previewBrollModal.imageUrl
                  );
                }}
                disabled={
                  scenes[previewBrollModal.sceneIndex]?.selectedImage ===
                  previewBrollModal.imageUrl
                }
                className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md transition hover:bg-emerald-400 disabled:cursor-default disabled:bg-emerald-500/25 disabled:text-emerald-300"
              >
                {scenes[previewBrollModal.sceneIndex]?.selectedImage ===
                previewBrollModal.imageUrl
                  ? '✓ Cenário Selecionado'
                  : 'Selecionar este Cenário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          4. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DO VÍDEO ("fragata shorts")
         ==================================================================== */}
      {isDeleteModalOpen && (
        <div
          onClick={() => !isDeletingVideo && setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#18181c] p-6 shadow-2xl shadow-black"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Excluir Vídeo Permanentemente
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Esta ação apagará o projeto, imagens, áudios e o MP4 renderizado.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isDeletingVideo}
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => void handleConfirmDeleteVideo(e)}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-xs text-slate-300">
                  Para confirmar a exclusão, digite{' '}
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono font-bold text-rose-300 select-all">
                    fragata shorts
                  </span>{' '}
                  abaixo:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  disabled={isDeletingVideo}
                  placeholder="fragata shorts"
                  className="mt-2 w-full rounded-xl border border-[#2c2c32] bg-[#121215] px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-600 outline-none transition focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isDeletingVideo}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="rounded-xl border border-[#2c2c32] bg-[#202026] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-[#2a2a32] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isDeleteConfirmationValid || isDeletingVideo}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeletingVideo ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
