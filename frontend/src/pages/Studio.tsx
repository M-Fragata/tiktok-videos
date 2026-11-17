import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Player, PlayerRef } from '@remotion/player';
import { TimeMachineVideo } from '../remotion/TimeMachineVideo';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarConfig,
  AvatarSegment,
  BackgroundSegment,
  BgmVibe,
  BGM_VIBE_OPTIONS,
  BriefingBgmOption,
  ContentBalance,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_SPEAKER_STYLES,
  DEFAULT_SUBTITLE_STYLE,
  DurationPreset,
  ensureSubtitleWordTimings,
  EpisodeFormat,
  getSceneDialogues,
  getSceneFullText,
  getSceneSfxList,
  getSceneActionSfx,
  getSceneAmbientSfx,
  resolveSfxAudioUrl,
  SfxItem,
  DialogueItem,
  IdeationOption,
  injectAvatarConfigIntoPrompt,
  ProtagonistAgency,
  resolveAssetSrc,
  resolveSpeakerForSubtitle,
  SceneFrameTiming,
  SeriesContext,
  SeriesSummary,
  SfxOption,
  SFX_OPTIONS,
  SpeakerStyleKey,
  SpeakerType,
  splitSceneTextIntoSubtitleChunks,
  StoryboardScene,
  SubtitleAnimationType,
  SubtitleFontFamily,
  SubtitleItem,
  SubtitleStyleConfig,
  SubtitleWordTiming,
  ThumbnailConfig,
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
import { SceneSfxSlotCard } from '../components/SceneSfxSlotCard';
import { ThumbnailCard } from '../components/ThumbnailCard';
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
  { value: 'long', label: 'Longo (65s)' },
  { value: 'medium', label: 'Médio (30s)' },
  { value: 'short', label: 'Curto (15s)' },
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
    sfx_list?: unknown[];
    custom_sfx_url?: string | null;
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
      sfx_list: sc.sfx_list,
      custom_sfx_url: sc.custom_sfx_url || null,
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

interface ErrorToastData {
  id: number;
  title: string;
  details?: string[];
}

/**
 * Traduz erros retornados pelas rotas da API e schemas do Zod em mensagens claras e amigáveis.
 */
function parseApiError(
  data: unknown,
  fallbackMessage: string
): { title: string; details?: string[] } {
  if (!data || typeof data !== 'object') {
    return { title: fallbackMessage };
  }

  const errObj = data as Record<string, unknown>;
  const rawTitle =
    (typeof errObj.error === 'string' && errObj.error) ||
    (typeof errObj.message === 'string' && errObj.message) ||
    fallbackMessage;
  const rawDetails = errObj.details;

  if (!rawDetails || typeof rawDetails !== 'object') {
    return { title: rawTitle };
  }

  const formattedDetails: string[] = [];

  for (const [fieldPath, errors] of Object.entries(rawDetails)) {
    if (!Array.isArray(errors) || errors.length === 0) continue;
    const errorText = errors.join('; ');

    let friendlyField = fieldPath;

    const sceneMatch = fieldPath.match(/scenes\.(\d+)\.(.+)/);
    if (sceneMatch) {
      const sceneNum = parseInt(sceneMatch[1], 10) + 1;
      const subProp = sceneMatch[2];
      const propLabels: Record<string, string> = {
        imagePrompt: 'Prompt de Imagem',
        avatarSprite: 'Sprite do Avatar',
        text: 'Texto da Fala',
        speaker: 'Locutor',
        sfx_list: 'Efeitos Sonoros',
        selectedImage: 'Imagem Selecionada',
        dialogues: 'Diálogos',
      };
      friendlyField = `Cena #${sceneNum} (${propLabels[subProp] || subProp})`;
    } else if (fieldPath.startsWith('subtitles.')) {
      const subMatch = fieldPath.match(/subtitles\.(\d+)/);
      const subNum = subMatch ? parseInt(subMatch[1], 10) + 1 : '';
      friendlyField = `Legenda #${subNum}`;
    } else if (fieldPath === 'theme') {
      friendlyField = 'Tema';
    } else if (fieldPath === 'title') {
      friendlyField = 'Título';
    }

    formattedDetails.push(`${friendlyField}: ${errorText}`);
  }

  return {
    title: rawTitle,
    details: formattedDetails.length > 0 ? formattedDetails : undefined,
  };
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
  const [thumbnailConfig, setThumbnailConfig] = useState<ThumbnailConfig | undefined>(undefined);
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
  // Dicionário mestre de palavras reais por cena (preserva timestamps da ElevenLabs durante edições de texto)
  const [sceneMasterWordMap, setSceneMasterWordMap] = useState<
    Record<number, SubtitleWordTiming[]>
  >({});
  // Assinatura sincronizada dos blocos de legenda de cada cena
  const [syncedSceneBlocksMap, setSyncedSceneBlocksMap] = useState<
    Record<number, string>
  >({});
  const [isSynchronizingAllSubtitles, setIsSynchronizingAllSubtitles] =
    useState<boolean>(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleConfig>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [characterGenderTab, setCharacterGenderTab] = useState<'male' | 'female'>('male');
  const [avatarTimeline, setAvatarTimeline] = useState<AvatarSegment[]>([]);

  // Estados de Mixagem Global de Áudio (Aba Inferior "Áudio")
  const [globalSfxMultiplier, setGlobalSfxMultiplier] = useState<number>(1.0);
  const [bgmVolume, setBgmVolume] = useState<number>(0.1);
  const [autoDucking, setAutoDucking] = useState<boolean>(true);
  const [playingSfxPreview, setPlayingSfxPreview] = useState<string | null>(null);
  const [detectedSfxDurations, setDetectedSfxDurations] = useState<Record<string, number>>({});
  const activePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const activePreviewTimeoutRef = useRef<number | null>(null);

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

  // Subseção: Regravação de Frases por Cena (Padrão: recolhida)
  const [isAudioPhrasesCollapsed, setIsAudioPhrasesCollapsed] = useState<boolean>(() => {
    if (!id) return true;
    try {
      const saved = localStorage.getItem(`studio_audio_phrases_collapsed_${id}`);
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

  const toggleAudioPhrasesCollapsed = () => {
    setIsAudioPhrasesCollapsed((prev) => {
      const next = !prev;
      if (id) {
        try {
          localStorage.setItem(`studio_audio_phrases_collapsed_${id}`, String(next));
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

  // Controle de recolhimento dos cards de cena em SFX na aba 4. Áudio (Padrão: todas recolhidas)
  const [collapsedSfxScenes, setCollapsedSfxScenes] = useState<
    Record<number, boolean>
  >(() => {
    if (!id) return {};
    try {
      const saved = localStorage.getItem(`studio_collapsed_sfx_scenes_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore storage error */
    }
    return {};
  });

  const toggleSfxSceneCollapse = (sceneIndex: number) => {
    setCollapsedSfxScenes((prev) => {
      const current = prev[sceneIndex] !== undefined ? prev[sceneIndex] : true;
      const next = {
        ...prev,
        [sceneIndex]: !current,
      };
      if (id) {
        try {
          localStorage.setItem(`studio_collapsed_sfx_scenes_${id}`, JSON.stringify(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  // Controle de recolhimento dos cards de cena na regravação de falas (Aba 4. Áudio - Padrão: todas recolhidas)
  const [collapsedNarrationScenes, setCollapsedNarrationScenes] = useState<
    Record<number, boolean>
  >(() => {
    if (!id) return {};
    try {
      const saved = localStorage.getItem(`studio_collapsed_narration_scenes_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore storage error */
    }
    return {};
  });

  const toggleNarrationSceneCollapse = (sceneIndex: number) => {
    setCollapsedNarrationScenes((prev) => {
      const current = prev[sceneIndex] !== undefined ? prev[sceneIndex] : true;
      const next = {
        ...prev,
        [sceneIndex]: !current,
      };
      if (id) {
        try {
          localStorage.setItem(
            `studio_collapsed_narration_scenes_${id}`,
            JSON.stringify(next)
          );
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  // Controle de recolhimento dos cards de cena em Legendas (Aba 3. Legendas - Padrão: todas recolhidas)
  const [collapsedSubtitleScenes, setCollapsedSubtitleScenes] = useState<
    Record<number, boolean>
  >(() => {
    if (!id) return {};
    try {
      const saved = localStorage.getItem(`studio_collapsed_subtitle_scenes_${id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore storage error */
    }
    return {};
  });

  const toggleSubtitleSceneCollapse = (sceneIndex: number) => {
    setCollapsedSubtitleScenes((prev) => {
      const current = prev[sceneIndex] !== undefined ? prev[sceneIndex] : true;
      const next = {
        ...prev,
        [sceneIndex]: !current,
      };
      if (id) {
        try {
          localStorage.setItem(
            `studio_collapsed_subtitle_scenes_${id}`,
            JSON.stringify(next)
          );
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

      const savedPhrases = localStorage.getItem(`studio_audio_phrases_collapsed_${id}`);
      if (savedPhrases !== null) {
        setIsAudioPhrasesCollapsed(savedPhrases === 'true');
      } else {
        setIsAudioPhrasesCollapsed(true);
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

      const savedSfxScenes = localStorage.getItem(`studio_collapsed_sfx_scenes_${id}`);
      if (savedSfxScenes) {
        setCollapsedSfxScenes(JSON.parse(savedSfxScenes));
      } else {
        setCollapsedSfxScenes({});
      }

      const savedNarrationScenes = localStorage.getItem(`studio_collapsed_narration_scenes_${id}`);
      if (savedNarrationScenes) {
        setCollapsedNarrationScenes(JSON.parse(savedNarrationScenes));
      } else {
        setCollapsedNarrationScenes({});
      }

      const savedSubtitleScenes = localStorage.getItem(`studio_collapsed_subtitle_scenes_${id}`);
      if (savedSubtitleScenes) {
        setCollapsedSubtitleScenes(JSON.parse(savedSubtitleScenes));
      } else {
        setCollapsedSubtitleScenes({});
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
  const [generatingSfxKey, setGeneratingSfxKey] = useState<string | null>(null);

  // Estado de Reprodução do Player & Agulha da Timeline
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isScrubbingTimeline, setIsScrubbingTimeline] =
    useState<boolean>(false);
  const [isScrubbingPlayerBar, setIsScrubbingPlayerBar] =
    useState<boolean>(false);
  const wasPlayingBeforePlayerScrubRef = useRef<boolean>(false);
  const [playerBarHover, setPlayerBarHover] = useState<{
    xPercent: number;
    timeText: string;
  } | null>(null);
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
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [simulatedRenderProgress, setSimulatedRenderProgress] = useState<number>(2);
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
  const [errorToast, setErrorToast] = useState<ErrorToastData | null>(null);
  const [successToast, setSuccessToast] = useState<{ id: number; text: string } | null>(null);

  const showErrorToast = useCallback(
    (titleOrError: unknown, details?: string[]) => {
      if (!titleOrError) {
        setErrorToast(null);
        return;
      }
      if (typeof titleOrError === 'string') {
        setErrorToast({ id: Date.now(), title: titleOrError, details });
      } else if (titleOrError instanceof Error) {
        setErrorToast({ id: Date.now(), title: titleOrError.message, details });
      } else if (typeof titleOrError === 'object') {
        const parsed = parseApiError(
          titleOrError,
          'Ocorreu um erro na operação.'
        );
        setErrorToast({
          id: Date.now(),
          title: parsed.title,
          details: parsed.details || details,
        });
      }
    },
    []
  );

  const setErrorMsg = useCallback(
    (msg: string | null) => {
      if (!msg) {
        setErrorToast(null);
      } else {
        showErrorToast(msg);
      }
    },
    [showErrorToast]
  );

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => {
      setErrorToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  const setSuccessMsg = useCallback((msg: string | null) => {
    if (!msg) {
      setSuccessToast(null);
    } else {
      setSuccessToast({ id: Date.now(), text: msg });
    }
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => {
      setSuccessToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [successToast]);
  const pendingAutoDownloadRef = useRef<boolean>(false);
  const renderingSignatureRef = useRef<string | null>(null);
  const shouldSyncInitialRenderedSignatureRef = useRef<boolean>(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleFormRef = useRef<HTMLFormElement>(null);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const playerProgressBarRef = useRef<HTMLDivElement>(null);
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
    rawProps: TimeMachineVideoProps | string,
    recordTheme?: string
  ) => {
    let props = rawProps as TimeMachineVideoProps;
    if (typeof rawProps === 'string') {
      try {
        props = JSON.parse(rawProps) as TimeMachineVideoProps;
      } catch {
        /* ignore */
      }
    }

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
    if (props.subtitles) {
      setSubtitles(props.subtitles);
      if (Array.isArray(props.subtitles)) {
        const timings = props.storyboard?.sceneTimings || [];
        const masterMap: Record<number, SubtitleWordTiming[]> = {};
        props.subtitles.forEach((sub: SubtitleItem) => {
          if (!sub.words || sub.words.length === 0) return;
          const mid = (sub.frameStart + sub.frameEnd) / 2;
          const sIdx = timings.findIndex(
            (t: SceneFrameTiming) => mid >= t.frameStart - 10 && mid <= t.frameEnd + 10
          );
          if (sIdx >= 0) {
            if (!masterMap[sIdx]) masterMap[sIdx] = [];
            masterMap[sIdx].push(...sub.words);
          }
        });
        Object.keys(masterMap).forEach((k) => {
          masterMap[Number(k)].sort((a, b) => a.frameStart - b.frameStart);
        });
        if (Object.keys(masterMap).length > 0) {
          setSceneMasterWordMap(masterMap);
        }
      }
    }
    if (props.subtitleStyle) {
      setSubtitleStyle({
        ...DEFAULT_SUBTITLE_STYLE,
        ...props.subtitleStyle,
        speakerStyles: {
          ...DEFAULT_SPEAKER_STYLES,
          ...(props.subtitleStyle.speakerStyles || {}),
        },
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
      if (props.thumbnailConfig || props.storyboard.thumbnailConfig) {
        setThumbnailConfig(props.thumbnailConfig || props.storyboard.thumbnailConfig);
      }

      const loadedScenes = props.storyboard.scenes || [];
      const loadedSubtitles = props.subtitles || [];
      const loadedTimings = props.storyboard.sceneTimings || [];

      // Reconcilia automaticamente o texto das cenas com as legendas consolidadas mais recentes
      const reconciledScenes = loadedScenes.map((sc, sIdx) => {
        const sceneBlocks = loadedSubtitles.filter((sub) => {
          if (sub.sceneIndex !== undefined) return sub.sceneIndex === sIdx;
          const timing = loadedTimings[sIdx];
          if (!timing) return false;
          const mid = (sub.frameStart + sub.frameEnd) / 2;
          return mid >= timing.frameStart - 2 && mid <= timing.frameEnd + 2;
        });

        if (sceneBlocks.length === 0) return sc;
        const consolidatedText = sceneBlocks
          .map((b) => b.text.trim())
          .filter(Boolean)
          .join(' ');
        if (!consolidatedText || consolidatedText === sc.text) return sc;

        const currentDialogues = getSceneDialogues(sc);
        const updatedDialogues =
          currentDialogues.length <= 1
            ? [
                {
                  id: currentDialogues[0]?.id || `dlg_${sIdx}`,
                  speaker:
                    currentDialogues[0]?.speaker || sc.speaker || 'protagonist',
                  text: consolidatedText,
                  voiceId: currentDialogues[0]?.voiceId,
                  characterName: currentDialogues[0]?.characterName,
                },
              ]
            : currentDialogues;

        return {
          ...sc,
          text: consolidatedText,
          dialogues: updatedDialogues,
        };
      });

      setScenes(reconciledScenes);
      if (reconciledScenes.length > 0 && finalMixScenes.length === 0) {
        setFinalMixScenes(
          reconciledScenes.map((sc, idx) => ({
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

  const handlePromoteStoryboardSceneSfx = async (
    sceneIndex: number,
    slot: 'action' | 'ambient' = 'action'
  ) => {
    if (!id) return;
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const sfxItem =
      slot === 'ambient' ? getSceneAmbientSfx(scene) : getSceneActionSfx(scene);
    const targetUrl = sfxItem?.audio_url || (slot === 'action' ? scene.custom_sfx_url : null);
    if (!targetUrl) return;

    const targetPrompt = sfxItem?.sound_prompt || scene.sfx_prompt || '';
    const targetLabel = sfxItem?.label || scene.sfx_label || '';

    setPromotingSfxSceneIndex(sceneIndex);
    try {
      const res = await fetch('/api/sfx-library/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: id,
          sceneIndex,
          customSfxUrl: targetUrl,
          sfxPrompt: targetPrompt,
          sfxLabel: targetLabel,
          sfxSlot: slot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data);
        return;
      }

      handleUpdateSceneSfxSlot(sceneIndex, slot, {
        audio_url: null,
        sfx_key: data.slug,
        label: data.label || targetLabel,
      });

      if (slot === 'action') {
        handleSceneFieldChange(sceneIndex, 'sfx_suggestion', data.slug);
        handleSceneFieldChange(
          sceneIndex,
          'sfx_label',
          data.label || scene.sfx_label || ''
        );
        handleSceneFieldChange(sceneIndex, 'custom_sfx_url', null);
      }

      await loadSfxLibrary();
      setSuccessMsg('Efeito sonoro salvo na biblioteca global com sucesso!');
    } catch (err) {
      console.error('[Promote SFX Error]', err);
      showErrorToast(
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
        showErrorToast(data);
        return;
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
              scenes: finalMixScenes.map((item) => {
                const actionSfx = getSceneActionSfx(item.scene);
                return {
                  id: item.uid,
                  speaker: item.scene.speaker,
                  text: item.scene.text,
                  dialogues: getSceneDialogues(item.scene),
                  avatarSprite: item.scene.avatarSprite,
                  visual_description: item.scene.visual_description || '',
                  imagePrompt: item.scene.imagePrompt || '',
                  sfx_list: item.scene.sfx_list || (actionSfx ? [actionSfx] : []),
                  sfx_suggestion: item.scene.sfx_suggestion || actionSfx?.sfx_key || '',
                  sfx_prompt: item.scene.sfx_prompt || actionSfx?.sound_prompt || '',
                  sfx_label: item.scene.sfx_label || actionSfx?.label || '',
                  isCustom: item.sourceOptionId === 'custom',
                };
              }),
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
              (revScene: StoryboardScene, idx: number) => {
                const origScene = finalMixScenes[idx]?.scene;
                const origSfxList = origScene?.sfx_list;
                const resolvedSfxList =
                  Array.isArray(revScene.sfx_list) && revScene.sfx_list.length > 0
                    ? revScene.sfx_list
                    : Array.isArray(origSfxList) && origSfxList.length > 0
                      ? origSfxList
                      : [];

                const actionItem =
                  resolvedSfxList.find((s) => s.slot === 'action') ||
                  resolvedSfxList[0] ||
                  origScene?.sfx_action ||
                  null;
                const ambientItem =
                  resolvedSfxList.find((s) => s.slot === 'ambient') ||
                  origScene?.sfx_ambient ||
                  null;

                return {
                  ...revScene,
                  dialogues:
                    revScene.dialogues && revScene.dialogues.length > 0
                      ? revScene.dialogues
                      : getSceneDialogues(origScene),
                  candidateImages:
                    origScene?.candidateImages || [],
                  selectedImage:
                    origScene?.selectedImage || null,
                  sfx_list: resolvedSfxList,
                  sfx_action: actionItem,
                  sfx_ambient: ambientItem,
                  sfx_prompt:
                    revScene.sfx_prompt ||
                    origScene?.sfx_prompt ||
                    actionItem?.sound_prompt ||
                    '',
                  sfx_label:
                    revScene.sfx_label ||
                    origScene?.sfx_label ||
                    actionItem?.label ||
                    '',
                  sfx_suggestion:
                    revScene.sfx_suggestion ||
                    origScene?.sfx_suggestion ||
                    actionItem?.sfx_key ||
                    'none',
                };
              }
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

      const matchedOption = ideationOptions.find(
        (opt) => opt.title === approvedTitle || opt.thumbnail_prompt
      );
      const initialThumbPrompt =
        matchedOption?.thumbnail_prompt ||
        `Mixed media 2D/3D illustration, a 2D cartoon stickman protagonist with a round white head, orange messy spiky hair, aviator goggles and red adventurer scarf, looking shocked and excited pointing at historical elements of ${finalTitle}, realistic 3D background environment with dramatic cinematic lighting, 9:16 vertical composition.`;
      const initialThumbHook =
        matchedOption?.thumbnail_title_hook || finalTitle;

      const effectiveThumbConfig: ThumbnailConfig = thumbnailConfig || {
        prompt: initialThumbPrompt,
        titleHook: initialThumbHook,
        selectedImage: null,
        candidateImages: [],
        textConfig: {
          text: initialThumbHook,
          fontFamily: 'Komika Axis',
          fontSize: 64,
          textColor: '#EF4444',
          strokeColor: '#000000',
          strokeWidth: 12,
          position: 'center',
          xPercent: 50,
          yPercent: 50,
        },
      };
      setThumbnailConfig(effectiveThumbConfig);

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
        thumbnailUrl: effectiveThumbConfig.selectedImage,
        thumbnailConfig: effectiveThumbConfig,
        storyboard: {
          durationPreset,
          scenes: consolidatedScenes,
          audioGenerated: false,
          isAssembled: false,
          sceneTimings: [],
          avatarConfig,
          ideationOptions,
          bgmVibe: effectiveBgmVibe,
          thumbnailConfig: effectiveThumbConfig,
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

  const stopSfxPreview = useCallback(() => {
    if (activePreviewTimeoutRef.current) {
      window.clearTimeout(activePreviewTimeoutRef.current);
      activePreviewTimeoutRef.current = null;
    }
    if (activePreviewAudioRef.current) {
      activePreviewAudioRef.current.pause();
      activePreviewAudioRef.current.currentTime = 0;
      activePreviewAudioRef.current = null;
    }
    setPlayingSfxPreview(null);
  }, []);

  /**
   * Reproduz um efeito sonoro isolado para pré-escuta na aba de Áudio,
   * respeitando a velocidade configurada, o tempo exato do slider e o loop contínuo.
   */
  const handlePlaySfxPreview = (
    audioUrl: string,
    keyId: string,
    options?: {
      targetDurationSec?: number;
      playbackRate?: number;
      volume?: number;
    }
  ) => {
    try {
      stopSfxPreview();
      const audio = new window.Audio(audioUrl);
      activePreviewAudioRef.current = audio;
      setPlayingSfxPreview(keyId);

      const speed = Math.min(2.0, Math.max(0.5, options?.playbackRate ?? 1.0));
      const vol = Math.min(1.0, Math.max(0.0, options?.volume ?? 0.35));
      const targetDurationSec = options?.targetDurationSec ?? 2.0;

      audio.playbackRate = speed;
      audio.volume = vol;
      audio.loop = true;

      // Tempo de reprodução real ajustado pela velocidade
      const playDurationMs = Math.max(
        100,
        Math.round((targetDurationSec / speed) * 1000)
      );
      activePreviewTimeoutRef.current = window.setTimeout(() => {
        stopSfxPreview();
      }, playDurationMs);

      audio.onerror = () => stopSfxPreview();
      void audio.play();
    } catch (e) {
      console.warn('Erro ao reproduzir pré-escuta de SFX:', e);
      stopSfxPreview();
    }
  };

  useEffect(() => {
    return () => {
      stopSfxPreview();
    };
  }, [stopSfxPreview]);

  // Detecção automática da duração original de arquivos de som vinculados
  useEffect(() => {
    scenes.forEach((scene) => {
      const list = getSceneSfxList(scene);
      list.forEach((sfx) => {
        const url = resolveSfxAudioUrl(sfx);
        if (!url || detectedSfxDurations[url]) return;
        if (sfx.original_duration_sec) {
          setDetectedSfxDurations((prev) => ({
            ...prev,
            [url]: sfx.original_duration_sec!,
          }));
          return;
        }
        const audio = new window.Audio(url);
        audio.onloadedmetadata = () => {
          if (
            audio.duration &&
            Number.isFinite(audio.duration) &&
            audio.duration > 0
          ) {
            setDetectedSfxDurations((prev) => ({
              ...prev,
              [url]: Number(audio.duration.toFixed(2)),
            }));
          }
        };
      });
    });
  }, [scenes, detectedSfxDurations]);

  /**
   * Atualiza as propriedades de um slot específico (Ação ou Ambiente) em uma cena
   */
  const handleUpdateSceneSfxSlot = (
    sceneIndex: number,
    slot: 'action' | 'ambient',
    updates: Partial<SfxItem>
  ) => {
    setScenes((prev) =>
      prev.map((scene, idx) => {
        if (idx !== sceneIndex) return scene;
        const timing = sceneTimings[sceneIndex];
        const sceneDuration = timing
          ? Math.max(1, timing.endSecond - timing.startSecond)
          : 4.0;

        const actionItem = getSceneActionSfx(scene) || {
          slot: 'action',
          sound_prompt: scene.sfx_prompt || '',
          match_score: 90,
          start_time_sec: 0.5,
          duration_sec: 2.0,
          suggested_volume: 0.85,
          audio_url: scene.custom_sfx_url || null,
          playback_rate: 1.0,
        };

        const ambientItem = getSceneAmbientSfx(scene) || {
          slot: 'ambient',
          sound_prompt: '',
          match_score: 90,
          start_time_sec: 0,
          duration_sec: sceneDuration,
          suggested_volume: 0.45,
          audio_url: null,
          playback_rate: 1.0,
        };

        const updatedAction =
          slot === 'action'
            ? { ...actionItem, ...updates, slot: 'action' as const }
            : actionItem;
        const updatedAmbient =
          slot === 'ambient'
            ? { ...ambientItem, ...updates, slot: 'ambient' as const }
            : ambientItem;

        const sfxList: SfxItem[] = [];
        if (
          updatedAction &&
          (updatedAction.sound_prompt ||
            updatedAction.audio_url ||
            updatedAction.sfx_key)
        ) {
          sfxList.push(updatedAction);
        }
        if (
          updatedAmbient &&
          (updatedAmbient.sound_prompt ||
            updatedAmbient.audio_url ||
            updatedAmbient.sfx_key)
        ) {
          sfxList.push(updatedAmbient);
        }

        return {
          ...scene,
          sfx_prompt: updatedAction.sound_prompt || scene.sfx_prompt,
          custom_sfx_url: updatedAction.audio_url || scene.custom_sfx_url,
          sfx_list: sfxList,
          sfx_action: updatedAction,
          sfx_ambient: updatedAmbient,
        };
      })
    );
  };

  /**
   * Altera a opção de efeito sonoro selecionada da biblioteca para um slot específico
   */
  const handleSceneSfxSlotOptionChange = (
    sceneIndex: number,
    slot: 'action' | 'ambient',
    optionValue: string
  ) => {
    if (optionValue === 'custom') return;
    if (optionValue === 'none') {
      handleUpdateSceneSfxSlot(sceneIndex, slot, {
        sfx_key: undefined,
        audio_url: null,
      });
      return;
    }
    const selectedOpt = sfxLibraryOptions.find(
      (o) => o.value === optionValue
    );
    handleUpdateSceneSfxSlot(sceneIndex, slot, {
      sfx_key: optionValue,
      sound_prompt: selectedOpt?.label || optionValue,
      label: selectedOpt?.label,
      audio_url: null,
    });
  };

  /**
   * Remove o áudio customizado de um slot específico
   */
  const handleRemoveCustomSfxSlot = (
    sceneIndex: number,
    slot: 'action' | 'ambient'
  ) => {
    handleUpdateSceneSfxSlot(sceneIndex, slot, { audio_url: null });
  };

  /**
   * Gera um efeito sonoro sob demanda na ElevenLabs via Text-to-SFX para o slot especificado
   */
  const handleGenerateSceneSfx = async (
    sceneIndex: number,
    promptText: string,
    durationSeconds?: number,
    slot: 'action' | 'ambient' = 'action'
  ) => {
    if (!id || !promptText.trim()) return;
    const key = `${sceneIndex}-${slot}`;
    setGeneratingSfxKey(key);
    try {
      const res = await fetch(`/api/videos/${id}/generate-scene-sfx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          sfxPrompt: promptText.trim(),
          sfxSlot: slot,
          ...(durationSeconds ? { durationSeconds } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data);
        return;
      }

      const audioUrl = data.audioUrl;
      const realDuration = data.originalDurationSec;
      if (audioUrl && realDuration) {
        setDetectedSfxDurations((prev) => ({
          ...prev,
          [audioUrl]: realDuration,
        }));
      }

      handleUpdateSceneSfxSlot(sceneIndex, slot, {
        sound_prompt: promptText.trim(),
        audio_url: audioUrl,
        original_duration_sec: realDuration,
        ...(durationSeconds ? { duration_sec: durationSeconds } : {}),
      });

      setSuccessMsg(
        `Efeito de ${slot === 'ambient' ? 'Ambiente' : 'Ação'} gerado com sucesso para a Cena #${sceneIndex + 1}!`
      );
    } catch (err: unknown) {
      console.error('[Generate SFX Error]', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao gerar efeito sonoro na ElevenLabs'
      );
    } finally {
      setGeneratingSfxKey(null);
    }
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

  const [regeneratingDialogueKey, setRegeneratingDialogueKey] = useState<
    string | null
  >(null);

  /**
   * Regrava cirurgicamente uma única frase/diálogo na ElevenLabs e atualiza áudio e legendas
   */
  const handleRegenerateDialogueAudio = async (
    sceneIndex: number,
    dialogueIndex: number,
    dialogue: DialogueItem
  ) => {
    if (!id) return;
    const key = `${sceneIndex}-${dialogueIndex}`;
    setRegeneratingDialogueKey(key);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/videos/${id}/regenerate-dialogue-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex,
          dialogueIndex,
          speaker: dialogue.speaker,
          voiceId: dialogue.voiceId,
          characterName: dialogue.characterName,
          text: dialogue.text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao regravar fala na ElevenLabs');
      }

      setAudioSrc(data.audioUrl);
      if (data.durationInFrames) {
        setDurationInFrames(data.durationInFrames);
      }
      if (Array.isArray(data.scenes)) {
        setScenes(data.scenes);
      }
      const incomingTimings = Array.isArray(data.sceneTimings)
        ? (data.sceneTimings as SceneFrameTiming[])
        : [];
      if (incomingTimings.length > 0) {
        setSceneTimings(incomingTimings);

        // Auto-recalcula os cortes visuais das cenas para a nova duração exata da narração
        const updatedBgTimeline: BackgroundSegment[] = (
          data.scenes || scenes
        ).map((sc: StoryboardScene, idx: number) => {
          const t = incomingTimings[idx];
          return {
            imageSrc: sc.selectedImage || 'background.jpg',
            frameStart: t ? t.frameStart : 0,
            frameEnd: t ? t.frameEnd : 450,
          };
        });
        setBackgroundTimeline(updatedBgTimeline);
      }

      if (Array.isArray(data.subtitles)) {
        const { reconciledSubtitles, newMasterMap, newSyncedMap } =
          reconcileSubtitlesWithExistingBlocks(
            data.subtitles,
            incomingTimings.length > 0 ? incomingTimings : sceneTimings,
            subtitles.length > 0 ? subtitles : effectiveSubtitles
          );
        setSubtitles(reconciledSubtitles);
        setSceneMasterWordMap(newMasterMap);
        setSyncedSceneBlocksMap(newSyncedMap);
      }
      setSuccessMsg(
        `Fala #${dialogueIndex + 1} da Cena #${sceneIndex + 1} regravada e áudio sincronizado com sucesso!`
      );
    } catch (err: unknown) {
      console.error('[Regenerate Dialogue Error]', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao regravar fala na ElevenLabs'
      );
    } finally {
      setRegeneratingDialogueKey(null);
    }
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
        ...s,
        dialogues: getSceneDialogues(s),
        sfx_list: s.sfx_list || [],
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
        showErrorToast(data);
        return;
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
        ...s,
        dialogues: getSceneDialogues(s),
        sfx_list: s.sfx_list || [],
      }));

      const res = await fetch(`/api/videos/${id}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: sanitizedScenes }),
      });

      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data);
        return;
      }

      const narration = data.narration;
      if (narration) {
        setAudioSrc(narration.audioUrl);
        setDurationInFrames(narration.durationInFrames);
        const incomingTimings = Array.isArray(narration.sceneTimings)
          ? (narration.sceneTimings as SceneFrameTiming[])
          : [];
        setSceneTimings(incomingTimings);

        // Auto-recalcula cortes visuais das cenas para a nova duração exata da narração
        if (incomingTimings.length > 0) {
          const updatedBgTimeline: BackgroundSegment[] = scenes.map(
            (sc, idx) => {
              const t = incomingTimings[idx];
              return {
                imageSrc: sc.selectedImage || 'background.jpg',
                frameStart: t ? t.frameStart : 0,
                frameEnd: t ? t.frameEnd : 450,
              };
            }
          );
          setBackgroundTimeline(updatedBgTimeline);
        }

        setAvatarTimeline(narration.avatarTimeline || []);
        setAudioGenerated(true);

        if (Array.isArray(narration.subtitles)) {
          const { reconciledSubtitles, newMasterMap, newSyncedMap } =
            reconcileSubtitlesWithExistingBlocks(
              narration.subtitles,
              incomingTimings,
              subtitles.length > 0 ? subtitles : effectiveSubtitles
            );
          setSubtitles(reconciledSubtitles);
          setSceneMasterWordMap(newMasterMap);
          setSyncedSceneBlocksMap(newSyncedMap);
        }
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

  const handleSubtitleStyleChange = <K extends keyof SubtitleStyleConfig>(
    field: K,
    value: SubtitleStyleConfig[K]
  ) => {
    setSubtitleStyle((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSpeakerColorChange = (
    speakerKey: SpeakerStyleKey,
    field: 'primaryColor' | 'highlightColor',
    value: string
  ) => {
    setSubtitleStyle((prev) => {
      const currentSpeakerStyles =
        prev.speakerStyles || DEFAULT_SPEAKER_STYLES;
      const targetSpeaker =
        currentSpeakerStyles[speakerKey] || DEFAULT_SPEAKER_STYLES[speakerKey];

      const updatedSpeakerStyles = {
        ...currentSpeakerStyles,
        [speakerKey]: {
          ...targetSpeaker,
          [field]: value,
        },
      };

      return {
        ...prev,
        speakerStyles: updatedSpeakerStyles,
        ...(speakerKey === 'protagonist' ? { [field]: value } : {}),
      };
    });
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
        const updated = {
          ...item,
          [field]: value,
        };
        if (field === 'text' || field === 'frameStart' || field === 'frameEnd') {
          updated.words = ensureSubtitleWordTimings(updated);
        }
        return updated;
      });
    });
  };

  // ========================================================
  // DADOS DERIVADOS PARA O PLAYER E TIMELINE
  // ========================================================
  const hasScript = scenes.length > 0;
  const isPending = videoRecord?.status === 'PENDING';

  // Progresso simulado contínuo durante a renderização no backend
  useEffect(() => {
    if (!isPending && !isRerendering) {
      setSimulatedRenderProgress(2);
      return;
    }
    const timer = setInterval(() => {
      setSimulatedRenderProgress((prev) => {
        if (prev >= 92) return 92;
        if (prev < 30) return prev + 3;
        if (prev < 60) return prev + 2;
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [isPending, isRerendering]);

  const displayProgress = useMemo(() => {
    if (isDownloadingMp4) {
      return downloadProgress !== null ? downloadProgress : 100;
    }
    if (isRerendering || isPending) {
      if (
        videoRecord?.renderProgress !== undefined &&
        videoRecord?.renderProgress !== null
      ) {
        return Math.max(2, Math.min(99, videoRecord.renderProgress));
      }
      return simulatedRenderProgress;
    }
    return 0;
  }, [
    isDownloadingMp4,
    downloadProgress,
    isRerendering,
    isPending,
    videoRecord?.renderProgress,
    simulatedRenderProgress,
  ]);

  // Cena #0: Capa / Thumbnail do Vídeo (0.5s = 15 frames a 30 FPS)
  const effectiveThumbnailSrc = useMemo(() => {
    return (
      thumbnailConfig?.selectedImage ||
      (videoRecord?.remotionProps as TimeMachineVideoProps | undefined)?.thumbnailUrl ||
      (videoRecord?.remotionProps as TimeMachineVideoProps | undefined)?.thumbnailConfig?.selectedImage ||
      null
    );
  }, [thumbnailConfig, videoRecord?.remotionProps]);

  const thumbnailIntroFrames = useMemo(() => {
    return effectiveThumbnailSrc ? 15 : 0;
  }, [effectiveThumbnailSrc]);

  const baseTotalFrames = useMemo(() => {
    if (durationInFrames && durationInFrames > 0) return durationInFrames;
    if (durationPreset === 'long') return 1800;
    if (durationPreset === 'medium') return 900;
    return 450;
  }, [durationInFrames, durationPreset]);

  const effectiveTotalFrames = useMemo(() => {
    return baseTotalFrames + thumbnailIntroFrames;
  }, [baseTotalFrames, thumbnailIntroFrames]);

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
      const framesPerScene = Math.floor(baseTotalFrames / scenes.length);
      return scenes.map((scene, idx) => {
        const timing = sceneTimings[idx];
        const frameStart = timing ? timing.frameStart : idx * framesPerScene;
        const frameEnd = timing
          ? timing.frameEnd
          : idx === scenes.length - 1
            ? baseTotalFrames
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
  }, [backgroundTimeline, scenes, sceneTimings, baseTotalFrames]);

  const effectiveAvatarTimeline = useMemo<AvatarSegment[]>(() => {
    if (avatarTimeline.length > 0 && avatarTimeline.length === scenes.length) {
      return avatarTimeline.map((seg, idx) => ({
        ...seg,
        image: scenes[idx]?.avatarSprite || seg.image,
      }));
    }
    if (scenes.length > 0) {
      const secPerScene = baseTotalFrames / 30 / scenes.length;
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
  }, [avatarTimeline, scenes, sceneTimings, baseTotalFrames]);

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
        const scene = scenes[idx];
        const sceneDialogues =
          scene?.dialogues && scene.dialogues.length > 0
            ? scene.dialogues
            : [{ text: scene?.text || `Cena ${idx + 1}`, speaker: scene?.speaker }];

        const sceneTotalWords =
          sceneDialogues.reduce((acc, d) => {
            return (
              acc +
              (d.text ? d.text.trim().split(/\s+/).filter(Boolean).length : 0)
            );
          }, 0) || 1;

        const preRoll = idx === 0 ? 0 : 7;
        const postRoll = idx === scenes.length - 1 ? 0 : 7;
        const speechStart = Math.min(seg.frameEnd - 15, seg.frameStart + preRoll);
        const speechEnd = Math.max(speechStart + 15, seg.frameEnd - postRoll);
        const speechFrames = Math.max(1, speechEnd - speechStart + 1);
        const dialogueChunks: SubtitleItem[] = [];
        let accumulatedWords = 0;

        for (let dIdx = 0; dIdx < sceneDialogues.length; dIdx++) {
          const d = sceneDialogues[dIdx];
          const dText = d.text?.trim() || '';
          if (!dText) continue;
          const dWordsCount = dText.split(/\s+/).filter(Boolean).length;

          const dStart =
            dIdx === 0
              ? speechStart
              : Math.min(
                  speechEnd,
                  Math.round(
                    speechStart +
                      (accumulatedWords / sceneTotalWords) * speechFrames
                  )
                );

          const dEnd =
            dIdx === sceneDialogues.length - 1
              ? speechEnd
              : Math.max(
                  dStart,
                  Math.round(
                    speechStart +
                      ((accumulatedWords + dWordsCount) / sceneTotalWords) *
                        speechFrames
                  ) - 1
                );

          const chunks = splitSceneTextIntoSubtitleChunks(dText, dStart, dEnd);
          chunks.forEach((chunk) => {
            chunk.sceneIndex = idx;
            if (d.speaker) {
              chunk.speaker = d.speaker;
            }
          });
          dialogueChunks.push(...chunks);
          accumulatedWords += dWordsCount;
        }

        return dialogueChunks;
      });
    }
    return [];
  }, [subtitles, scenes, effectiveBackgroundTimeline]);

  interface SceneSubtitleGroup {
    sceneIndex: number;
    scene?: StoryboardScene;
    durationSeconds: number;
    items: Array<{
      sub: SubtitleItem;
      globalIndex: number;
    }>;
  }

  const sceneSubtitleGroups = useMemo<SceneSubtitleGroup[]>(() => {
    if (scenes.length === 0) {
      if (effectiveSubtitles.length === 0) return [];
      return [
        {
          sceneIndex: 0,
          durationSeconds: effectiveTotalFrames / 30,
          items: effectiveSubtitles.map((sub, globalIndex) => ({
            sub,
            globalIndex,
          })),
        },
      ];
    }

    const groups: SceneSubtitleGroup[] = scenes.map((scene, idx) => {
      const sceneTiming = sceneTimings[idx];
      const durationSeconds = sceneTiming
        ? Math.max(
            0.5,
            Number((sceneTiming.endSecond - sceneTiming.startSecond).toFixed(1))
          )
        : effectiveBackgroundTimeline[idx]
          ? Math.max(
              0.5,
              Number(
                (
                  (effectiveBackgroundTimeline[idx].frameEnd -
                    effectiveBackgroundTimeline[idx].frameStart +
                    1) /
                  30
                ).toFixed(1)
              )
            )
          : 4.0;

      return {
        sceneIndex: idx,
        scene,
        durationSeconds,
        items: [],
      };
    });

    effectiveSubtitles.forEach((sub, globalIndex) => {
      let targetIdx = -1;

      // 0. Prioridade máxima: vínculo explícito por sceneIndex
      if (
        typeof sub.sceneIndex === 'number' &&
        sub.sceneIndex >= 0 &&
        sub.sceneIndex < groups.length
      ) {
        targetIdx = sub.sceneIndex;
      }

      // 1. Se não tiver sceneIndex definido, tenta pelo ponto médio dentro da cena
      if (targetIdx === -1) {
        const mid = (sub.frameStart + sub.frameEnd) / 2;
        for (let i = 0; i < effectiveBackgroundTimeline.length; i++) {
          const seg = effectiveBackgroundTimeline[i];
          if (mid >= seg.frameStart && mid <= seg.frameEnd) {
            targetIdx = i;
            break;
          }
        }
      }

      // 2. Se não encontrou pelo meio, tenta pelo frameStart
      if (targetIdx === -1) {
        for (let i = 0; i < effectiveBackgroundTimeline.length; i++) {
          const seg = effectiveBackgroundTimeline[i];
          if (sub.frameStart >= seg.frameStart && sub.frameStart <= seg.frameEnd) {
            targetIdx = i;
            break;
          }
        }
      }

      // 3. Fallback: encontra a cena mais próxima
      if (targetIdx === -1 && effectiveBackgroundTimeline.length > 0) {
        let minDist = Infinity;
        for (let i = 0; i < effectiveBackgroundTimeline.length; i++) {
          const seg = effectiveBackgroundTimeline[i];
          const dist = Math.min(
            Math.abs(sub.frameStart - seg.frameStart),
            Math.abs(sub.frameStart - seg.frameEnd)
          );
          if (dist < minDist) {
            minDist = dist;
            targetIdx = i;
          }
        }
      }

      if (targetIdx < 0 || targetIdx >= groups.length) {
        targetIdx = Math.max(
          0,
          Math.min(groups.length - 1, targetIdx === -1 ? 0 : targetIdx)
        );
      }

      groups[targetIdx].items.push({ sub, globalIndex });
    });

    return groups;
  }, [
    scenes,
    sceneTimings,
    effectiveBackgroundTimeline,
    effectiveSubtitles,
    effectiveTotalFrames,
  ]);

  // Normalização fonética/léxica para matching de legendas (sem diacríticos, minúsculas, sem pontuação)
  const normalizeSubtitleWord = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,!?;:…"'—\-()]/g, '')
      .trim();
  };

  const getSceneBlocksSignature = useCallback(
    (items: Array<{ sub: SubtitleItem }>): string => {
      return items.map((it) => it.sub.text.trim()).join('|||');
    },
    []
  );

  useEffect(() => {
    if (sceneSubtitleGroups.length === 0) return;
    setSyncedSceneBlocksMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of sceneSubtitleGroups) {
        if (next[group.sceneIndex] === undefined) {
          next[group.sceneIndex] = getSceneBlocksSignature(group.items);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sceneSubtitleGroups, getSceneBlocksSignature]);

  const isSceneSubtitleUnsynced = useCallback(
    (sceneIdx: number): boolean => {
      const group = sceneSubtitleGroups.find((g) => g.sceneIndex === sceneIdx);
      if (!group || group.items.length === 0) return false;

      const currentSig = getSceneBlocksSignature(group.items);
      const syncedSig = syncedSceneBlocksMap[sceneIdx];

      // Se a cena ainda não foi inicializada no mapa de sincronização, inicia sincronizada
      if (syncedSig === undefined) {
        return false;
      }

      return currentSig !== syncedSig;
    },
    [sceneSubtitleGroups, syncedSceneBlocksMap, getSceneBlocksSignature]
  );

  const performSceneSubtitlesSync = useCallback(
    (
      sceneIdx: number,
      currentSubtitlesList?: SubtitleItem[]
    ): SubtitleItem[] => {
      const currentList =
        currentSubtitlesList ||
        (subtitles.length > 0 ? subtitles : effectiveSubtitles);

      const group = sceneSubtitleGroups.find((g) => g.sceneIndex === sceneIdx);
      if (!group) return currentList;

      let masterWords = sceneMasterWordMap[sceneIdx];
      // 1. Tenta recuperar do mapa em memória
      if (!masterWords || masterWords.length === 0) {
        // 2. Tenta recuperar das legendas salvas intactas do banco de dados (videoRecord)
        const savedSubs = videoRecord?.remotionProps?.subtitles;
        const timing = sceneTimings[sceneIdx];
        if (savedSubs && Array.isArray(savedSubs) && timing) {
          const collectedFromRecord: SubtitleWordTiming[] = [];
          for (const s of savedSubs) {
            const mid = (s.frameStart + s.frameEnd) / 2;
            if (mid >= timing.frameStart - 10 && mid <= timing.frameEnd + 10) {
              if (s.words && s.words.length > 0) {
                collectedFromRecord.push(...s.words);
              }
            }
          }
          if (collectedFromRecord.length > 0) {
            collectedFromRecord.sort((a, b) => a.frameStart - b.frameStart);
            masterWords = collectedFromRecord;
            setSceneMasterWordMap((prev) => ({
              ...prev,
              [sceneIdx]: collectedFromRecord,
            }));
          }
        }
      }

      // 3. Fallback final caso ainda não haja
      if (!masterWords || masterWords.length === 0) {
        masterWords = group.items.flatMap((item) =>
          item.sub.words && item.sub.words.length > 0
            ? item.sub.words
            : ensureSubtitleWordTimings(item.sub)
        );
        if (masterWords.length > 0) {
          setSceneMasterWordMap((prev) => ({
            ...prev,
            [sceneIdx]: masterWords,
          }));
        }
      }

      if (masterWords.length === 0) {
        return currentList;
      }

      const normalizedMasterWords = masterWords.map((mw) => ({
        ...mw,
        norm: normalizeSubtitleWord(mw.word),
      }));

      const sceneBlockIndexes = group.items.map((i) => i.globalIndex);
      const sceneBlocks = sceneBlockIndexes
        .map((idx) => currentList[idx])
        .filter(Boolean);

      // Filtra blocos vazios (Suporte a blocos flexíveis)
      const activeBlocks = sceneBlocks.filter(
        (b) => b.text.trim().length > 0
      );

      if (activeBlocks.length === 0) {
        return currentList.filter((_, idx) => !sceneBlockIndexes.includes(idx));
      }

      const sceneTiming = sceneTimings[sceneIdx];
      const bgSegment = effectiveBackgroundTimeline[sceneIdx];
      const sceneStartFrame = bgSegment
        ? bgSegment.frameStart
        : sceneTiming
          ? sceneTiming.frameStart
          : 0;
      const maxAllowedSceneEnd = bgSegment
        ? bgSegment.frameEnd
        : sceneTiming?.frameEnd;
      const sceneEndFrame =
        maxAllowedSceneEnd ??
        sceneTiming?.frameEnd ??
        normalizedMasterWords[normalizedMasterWords.length - 1]?.frameEnd;

      let masterPointer = 0;
      const updatedSceneBlocks: SubtitleItem[] = [];

      for (let bIdx = 0; bIdx < activeBlocks.length; bIdx++) {
        const block = activeBlocks[bIdx];
        const rawWords = block.text.trim().split(/\s+/).filter(Boolean);
        const assignedWords: SubtitleWordTiming[] = [];

        for (const rawW of rawWords) {
          const normW = normalizeSubtitleWord(rawW);
          let matchedIdx = -1;

          // 1. Busca exata a partir de masterPointer
          for (let m = masterPointer; m < normalizedMasterWords.length; m++) {
            if (normalizedMasterWords[m].norm === normW) {
              matchedIdx = m;
              break;
            }
          }

          // 2. Se não encontrou, busca aproximada (prefixo de pelo menos 2 letras)
          if (matchedIdx === -1 && normW.length >= 2) {
            for (let m = masterPointer; m < normalizedMasterWords.length; m++) {
              const mn = normalizedMasterWords[m].norm;
              if (mn.startsWith(normW) || normW.startsWith(mn)) {
                matchedIdx = m;
                break;
              }
            }
          }

          if (matchedIdx >= 0) {
            const mw = normalizedMasterWords[matchedIdx];
            // Restaura palavra completa caso o texto do bloco estivesse truncado/cortado
            const resolvedWord =
              mw.norm.startsWith(normW) && mw.norm.length > normW.length
                ? mw.word
                : rawW;
            assignedWords.push({
              word: resolvedWord,
              frameStart: mw.frameStart,
              frameEnd: mw.frameEnd,
            });
            // Avança o ponteiro além da palavra encontrada (suporte a palavras deletadas/ocultadas)
            masterPointer = matchedIdx + 1;
          } else {
            // Palavra não encontrada no áudio original: interpola frames
            const prevAssigned = assignedWords[assignedWords.length - 1];
            const fallbackStart = prevAssigned
              ? prevAssigned.frameEnd + 1
              : normalizedMasterWords[masterPointer]?.frameStart ?? block.frameStart;
            const fallbackEnd = fallbackStart + 12;
            assignedWords.push({
              word: rawW,
              frameStart: fallbackStart,
              frameEnd: fallbackEnd,
            });
          }
        }

        // Se for o último bloco da cena e restaram palavras master no áudio, estende a última palavra até a última masterWord
        if (
          bIdx === activeBlocks.length - 1 &&
          masterPointer < normalizedMasterWords.length &&
          assignedWords.length > 0
        ) {
          const lastMaster =
            normalizedMasterWords[normalizedMasterWords.length - 1];
          if (
            lastMaster.frameEnd >
            assignedWords[assignedWords.length - 1].frameEnd
          ) {
            assignedWords[assignedWords.length - 1].frameEnd =
              lastMaster.frameEnd;
          }
        }

        if (assignedWords.length > 0) {
          // Calibração de Sincronia: antecipa 10 frames (~333ms) em todas as palavras e no bloco
          // para casar a leitura visual e o realce do karaokê com o ataque vocal acústico
          const SUBTITLE_LEAD_IN_FRAMES = 10;
          const minAllowedStart = sceneStartFrame ?? 0;
          assignedWords.forEach((w) => {
            const calibratedWordStart = Math.max(
              minAllowedStart,
              w.frameStart - SUBTITLE_LEAD_IN_FRAMES
            );
            const calibratedWordEnd = Math.max(
              calibratedWordStart + 1,
              w.frameEnd - SUBTITLE_LEAD_IN_FRAMES
            );
            w.frameStart = calibratedWordStart;
            w.frameEnd = calibratedWordEnd;
          });
          const blockStart = assignedWords[0].frameStart;
          const blockEnd = Math.max(
            blockStart + 1,
            assignedWords[assignedWords.length - 1].frameEnd
          );

          const targetScene = scenes[sceneIdx];
          const restoredText = assignedWords.map((w) => w.word).join(' ');
          const blockSpeakerInfo = resolveSpeakerForSubtitle(
            { ...block, text: restoredText },
            targetScene
          );

          updatedSceneBlocks.push({
            frameStart: blockStart,
            frameEnd: blockEnd,
            text: restoredText,
            words: assignedWords,
            sceneIndex: sceneIdx,
            speaker: blockSpeakerInfo.speaker,
            ...(blockSpeakerInfo.characterGender
              ? { characterGender: blockSpeakerInfo.characterGender }
              : {}),
          });
        }
      }

      // Estende cada bloco confortavelmente até o início do próximo bloco ou até o fim da fala da cena

      // Detecta anomalia de tempo (blocos colidindo no mesmo frameStart, frameEnd <= frameStart ou ordem invertida)
      const hasTimingAnomaly = updatedSceneBlocks.some((b, i) => {
        if (b.frameEnd <= b.frameStart) return true;
        if (i < updatedSceneBlocks.length - 1) {
          const nextB = updatedSceneBlocks[i + 1];
          return nextB.frameStart <= b.frameStart;
        }
        return false;
      });

      if (hasTimingAnomaly && updatedSceneBlocks.length > 0) {
        const totalWords =
          updatedSceneBlocks.reduce((acc, b) => {
            const count = b.text.trim().split(/\s+/).filter(Boolean).length;
            return acc + (count > 0 ? count : 1);
          }, 0) || 1;
        const targetSceneEnd = sceneEndFrame ?? sceneStartFrame + 120;
        const availableFrames = Math.max(
          updatedSceneBlocks.length * 15,
          targetSceneEnd - sceneStartFrame + 1
        );

        let curStart = sceneStartFrame;
        let consumedSceneWords = 0;

        for (let i = 0; i < updatedSceneBlocks.length; i++) {
          const b = updatedSceneBlocks[i];
          const bWordsCount =
            b.text.trim().split(/\s+/).filter(Boolean).length || 1;
          const isLast = i === updatedSceneBlocks.length - 1;
          const bEnd = isLast
            ? targetSceneEnd
            : Math.min(
                targetSceneEnd - (updatedSceneBlocks.length - 1 - i) * 15,
                Math.round(
                  sceneStartFrame +
                    ((consumedSceneWords + bWordsCount) / totalWords) *
                      availableFrames
                ) - 1
              );
          b.frameStart = curStart;
          b.frameEnd = Math.max(curStart + 14, bEnd);
          b.words = ensureSubtitleWordTimings(b);
          consumedSceneWords += bWordsCount;
          curStart = b.frameEnd + 1;
        }
      } else {
        for (let i = 0; i < updatedSceneBlocks.length; i++) {
          if (i < updatedSceneBlocks.length - 1) {
            // Bloco intermediário: permanece visível até 1 frame antes do próximo bloco começar
            const nextStart = updatedSceneBlocks[i + 1].frameStart;
            if (nextStart > updatedSceneBlocks[i].frameStart) {
              updatedSceneBlocks[i].frameEnd = Math.max(
                updatedSceneBlocks[i].frameEnd,
                nextStart - 1
              );
            }
          } else {
            // Último bloco da cena: estende até o final da fala da cena
            if (sceneEndFrame && sceneEndFrame > updatedSceneBlocks[i].frameStart) {
              updatedSceneBlocks[i].frameEnd = Math.max(
                updatedSceneBlocks[i].frameEnd,
                sceneEndFrame
              );
            }
          }

          // Clamp estrito: nenhum bloco pode ultrapassar o limite final da cena
          if (maxAllowedSceneEnd && updatedSceneBlocks[i].frameEnd > maxAllowedSceneEnd) {
            updatedSceneBlocks[i].frameEnd = maxAllowedSceneEnd;
          }
        }

        // Previne sobreposição de frames entre blocos consecutivos sem esmagar nenhum bloco
        for (let i = 0; i < updatedSceneBlocks.length - 1; i++) {
          const cur = updatedSceneBlocks[i];
          const next = updatedSceneBlocks[i + 1];
          if (next.frameStart <= cur.frameStart) {
            next.frameStart = cur.frameStart + 15;
          }
          if (cur.frameEnd >= next.frameStart) {
            cur.frameEnd = Math.max(cur.frameStart + 10, next.frameStart - 1);
            if (cur.frameEnd >= next.frameStart) {
              next.frameStart = cur.frameEnd + 1;
            }
          }
          cur.words = ensureSubtitleWordTimings(cur);
        }
        if (updatedSceneBlocks.length > 0) {
          const last = updatedSceneBlocks[updatedSceneBlocks.length - 1];
          last.words = ensureSubtitleWordTimings(last);
        }
      }

      const minIndex =
        sceneBlockIndexes.length > 0 ? Math.min(...sceneBlockIndexes) : -1;
      const maxIndex =
        sceneBlockIndexes.length > 0 ? Math.max(...sceneBlockIndexes) : -1;

      if (minIndex === -1) {
        const timing = sceneTimings[sceneIdx];
        const targetFrame = timing ? timing.frameStart : 0;
        const insertAt = currentList.findIndex((s) => s.frameStart >= targetFrame);
        if (insertAt === -1) {
          return [...currentList, ...updatedSceneBlocks];
        } else {
          const copy = [...currentList];
          copy.splice(insertAt, 0, ...updatedSceneBlocks);
          return copy;
        }
      } else {
        return [
          ...currentList.slice(0, minIndex),
          ...updatedSceneBlocks,
          ...currentList.slice(maxIndex + 1),
        ];
      }
    },
    [
      subtitles,
      effectiveSubtitles,
      sceneSubtitleGroups,
      sceneMasterWordMap,
      sceneTimings,
      effectiveBackgroundTimeline,
      videoRecord,
      scenes,
    ]
  );

  const handleSynchronizeSceneSubtitles = (sceneIdx: number) => {
    const updated = performSceneSubtitlesSync(sceneIdx);
    setSubtitles(updated);

    const sceneTiming = sceneTimings[sceneIdx];
    const frameStartThreshold = sceneTiming ? sceneTiming.frameStart : 0;
    const frameEndThreshold = sceneTiming ? sceneTiming.frameEnd : Infinity;
    const updatedSceneSubs = updated.filter(
      (s) =>
        s.frameStart >= frameStartThreshold && s.frameStart <= frameEndThreshold
    );
    const newSig = getSceneBlocksSignature(
      updatedSceneSubs.map((sub) => ({ sub, globalIndex: 0 }))
    );
    setSyncedSceneBlocksMap((prev) => ({
      ...prev,
      [sceneIdx]: newSig,
    }));

    setSuccessMsg('Legenda sincronizada com o áudio da cena!');
  };

  const handleSynchronizeAllScenesSubtitles = async () => {
    setIsSynchronizingAllSubtitles(true);
    try {
      const currentList = subtitles.length > 0 ? subtitles : effectiveSubtitles;
      if (currentList.length === 0) {
        showErrorToast({ message: 'Nenhuma legenda encontrada para sincronizar.' });
        return;
      }

      // 1. Remove blocos vazios (ex: bloco #4 vazio deixado pelo usuário)
      let cleanedList = currentList.filter(
        (sub) => sub.text && sub.text.trim().length > 0
      );

      // 2. Executa a sincronização cena por cena
      for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        cleanedList = performSceneSubtitlesSync(sIdx, cleanedList);
      }

      // 3. Garante ordenação cronológica estrita e de-overlap
      cleanedList.sort((a, b) => a.frameStart - b.frameStart);
      for (let i = 0; i < cleanedList.length - 1; i++) {
        const cur = cleanedList[i];
        const next = cleanedList[i + 1];
        if (next.frameStart <= cur.frameStart) {
          next.frameStart = cur.frameStart + 12;
        }
        if (cur.frameEnd >= next.frameStart) {
          cur.frameEnd = Math.max(cur.frameStart + 8, next.frameStart - 1);
        }
        cur.words = ensureSubtitleWordTimings(cur);
      }
      if (cleanedList.length > 0) {
        const last = cleanedList[cleanedList.length - 1];
        last.words = ensureSubtitleWordTimings(last);
      }

      // 4. Atualiza estado local
      setSubtitles(cleanedList);

      // 5. Atualiza o mapa de assinaturas de todas as cenas para marcar como sincronizadas
      const updatedSyncedMap: Record<number, string> = {};
      scenes.forEach((_, sIdx) => {
        const sceneTiming = sceneTimings[sIdx];
        const frameStartThreshold = sceneTiming ? sceneTiming.frameStart : 0;
        const frameEndThreshold = sceneTiming ? sceneTiming.frameEnd : Infinity;
        const sceneSubs = cleanedList.filter(
          (s) =>
            s.frameStart >= frameStartThreshold && s.frameStart <= frameEndThreshold
        );
        updatedSyncedMap[sIdx] = getSceneBlocksSignature(
          sceneSubs.map((sub) => ({ sub, globalIndex: 0 }))
        );
      });
      setSyncedSceneBlocksMap(updatedSyncedMap);

      // 6. Persiste no banco de dados
      if (id) {
        await fetch(`/api/videos/${id}/storyboard`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: theme || 'Sem tema',
            audioSrc: audioSrc && audioSrc !== 'audio.mp3' ? audioSrc : undefined,
            subtitles: cleanedList,
          }),
        });
      }

      setSuccessMsg(
        `✓ ${cleanedList.length} blocos sincronizados com precisão acústica (-2f calibração e limpeza de vazios)!`
      );
    } catch (err: unknown) {
      console.error('[Sync All Subtitles Error]', err);
      showErrorToast({
        message:
          err instanceof Error
            ? err.message
            : 'Erro ao sincronizar todas as legendas',
      });
    } finally {
      setIsSynchronizingAllSubtitles(false);
    }
  };

  /**
   * Reconcilia as legendas retornadas pela ElevenLabs com os blocos de legenda existentes,
   * preservando a organização de quebras e blocos customizados pelo usuário na Aba Legendas.
   */
  const reconcileSubtitlesWithExistingBlocks = useCallback(
    (
      incomingSubtitles: SubtitleItem[],
      incomingSceneTimings: SceneFrameTiming[],
      _currentExistingSubtitles: SubtitleItem[]
    ): {
      reconciledSubtitles: SubtitleItem[];
      newMasterMap: Record<number, SubtitleWordTiming[]>;
      newSyncedMap: Record<number, string>;
    } => {
      const newMasterMap: Record<number, SubtitleWordTiming[]> = {};
      const newSyncedMap: Record<number, string> = {};

      // 1. Extrai as palavras novas da ElevenLabs por cena
      incomingSceneTimings.forEach((timing, sIdx) => {
        const sceneWords: SubtitleWordTiming[] = [];
        incomingSubtitles.forEach((sub) => {
          const mid = (sub.frameStart + sub.frameEnd) / 2;
          if (mid >= timing.frameStart - 8 && mid <= timing.frameEnd + 8) {
            if (sub.words && sub.words.length > 0) {
              sceneWords.push(...sub.words);
            }
          }
        });
        sceneWords.sort((a, b) => a.frameStart - b.frameStart);
        newMasterMap[sIdx] = sceneWords;
      });

      const reconciledSubtitles: SubtitleItem[] = [];

      // 2. Para cada cena, verifica se é possível preservar os blocos do usuário
      incomingSceneTimings.forEach((timing, sIdx) => {
        const sceneMasterWords = newMasterMap[sIdx] || [];
        const incomingSceneSubs = incomingSubtitles.filter((sub) => {
          const mid = (sub.frameStart + sub.frameEnd) / 2;
          return mid >= timing.frameStart - 8 && mid <= timing.frameEnd + 8;
        });

        // Localiza os blocos existentes da cena anterior
        const existingGroup = sceneSubtitleGroups.find(
          (g) => g.sceneIndex === sIdx
        );
        const existingBlocks =
          existingGroup && existingGroup.items.length > 0
            ? existingGroup.items.map((it) => it.sub)
            : [];

        if (existingBlocks.length > 0 && sceneMasterWords.length > 0) {
          const userText = existingBlocks
            .map((b) => b.text.trim())
            .filter(Boolean)
            .join(' ');
          const userWords = userText
            .split(/\s+/)
            .filter(Boolean)
            .map(normalizeSubtitleWord);
          const newWords = sceneMasterWords.map((w) =>
            normalizeSubtitleWord(w.word)
          );

          // Verifica se pelo menos 60% das palavras coincidem (mesma fala com voz/tom diferente)
          let matchCount = 0;
          userWords.forEach((uw) => {
            if (
              newWords.some(
                (nw) => nw === uw || nw.startsWith(uw) || uw.startsWith(nw)
              )
            ) {
              matchCount++;
            }
          });
          const isCompatible =
            userWords.length > 0 && matchCount / userWords.length >= 0.6;

          if (isCompatible) {
            const normalizedMaster = sceneMasterWords.map((mw) => ({
              ...mw,
              norm: normalizeSubtitleWord(mw.word),
            }));

            let masterPointer = 0;
            const updatedBlocks: SubtitleItem[] = [];

            for (let bIdx = 0; bIdx < existingBlocks.length; bIdx++) {
              const block = existingBlocks[bIdx];
              const rawWords = block.text.trim().split(/\s+/).filter(Boolean);
              if (rawWords.length === 0) continue;

              const assignedWords: SubtitleWordTiming[] = [];

              for (const rawW of rawWords) {
                const normW = normalizeSubtitleWord(rawW);
                let matchedIdx = -1;

                for (let m = masterPointer; m < normalizedMaster.length; m++) {
                  if (normalizedMaster[m].norm === normW) {
                    matchedIdx = m;
                    break;
                  }
                }

                if (matchedIdx === -1 && normW.length >= 2) {
                  for (let m = masterPointer; m < normalizedMaster.length; m++) {
                    const mn = normalizedMaster[m].norm;
                    if (mn.startsWith(normW) || normW.startsWith(mn)) {
                      matchedIdx = m;
                      break;
                    }
                  }
                }

                if (matchedIdx >= 0) {
                  const mw = normalizedMaster[matchedIdx];
                  // Restaura palavra completa caso o texto do bloco estivesse truncado/cortado
                  const resolvedWord =
                    mw.norm.startsWith(normW) && mw.norm.length > normW.length
                      ? mw.word
                      : rawW;
                  assignedWords.push({
                    word: resolvedWord,
                    frameStart: mw.frameStart,
                    frameEnd: mw.frameEnd,
                  });
                  masterPointer = matchedIdx + 1;
                } else {
                  const prevW = assignedWords[assignedWords.length - 1];
                  const fbStart = prevW
                    ? prevW.frameEnd + 1
                    : normalizedMaster[masterPointer]?.frameStart ??
                      timing.frameStart;
                  const fbEnd = fbStart + 12;
                  assignedWords.push({
                    word: rawW,
                    frameStart: fbStart,
                    frameEnd: fbEnd,
                  });
                }
              }

              // Se for o último bloco da cena e restaram masterWords não consumidas
              if (
                bIdx === existingBlocks.length - 1 &&
                masterPointer < normalizedMaster.length &&
                assignedWords.length > 0
              ) {
                const lastMaster =
                  normalizedMaster[normalizedMaster.length - 1];
                if (
                  lastMaster.frameEnd >
                  assignedWords[assignedWords.length - 1].frameEnd
                ) {
                  assignedWords[assignedWords.length - 1].frameEnd =
                    lastMaster.frameEnd;
                }
              }

              if (assignedWords.length > 0) {
                // Calibração de Sincronia: antecipa 10 frames (~333ms) em todas as palavras e no bloco
                // para casar a leitura visual e o realce do karaokê com o ataque vocal acústico
                const SUBTITLE_LEAD_IN_FRAMES = 10;
                const minAllowedStart = timing.frameStart;
                assignedWords.forEach((w) => {
                  const calibratedWordStart = Math.max(
                    minAllowedStart,
                    w.frameStart - SUBTITLE_LEAD_IN_FRAMES
                  );
                  const calibratedWordEnd = Math.max(
                    calibratedWordStart + 1,
                    w.frameEnd - SUBTITLE_LEAD_IN_FRAMES
                  );
                  w.frameStart = calibratedWordStart;
                  w.frameEnd = calibratedWordEnd;
                });
                const bStart = assignedWords[0].frameStart;
                const bEnd = Math.max(
                  bStart + 1,
                  assignedWords[assignedWords.length - 1].frameEnd
                );
                const targetScene = scenes[sIdx];
                const restoredText = assignedWords.map((w) => w.word).join(' ');
                const blockSpeakerInfo = resolveSpeakerForSubtitle(
                  { ...block, text: restoredText },
                  targetScene
                );
                updatedBlocks.push({
                  frameStart: bStart,
                  frameEnd: bEnd,
                  text: restoredText,
                  words: assignedWords,
                  sceneIndex: sIdx,
                  speaker: blockSpeakerInfo.speaker,
                  ...(blockSpeakerInfo.characterGender
                    ? { characterGender: blockSpeakerInfo.characterGender }
                    : {}),
                });
              }
            }

            // Estende confortavelmente os blocos para evitar sumiços precoces
            for (let i = 0; i < updatedBlocks.length; i++) {
              if (i < updatedBlocks.length - 1) {
                const nextStart = updatedBlocks[i + 1].frameStart;
                if (nextStart > updatedBlocks[i].frameStart) {
                  updatedBlocks[i].frameEnd = Math.max(
                    updatedBlocks[i].frameEnd,
                    nextStart - 1
                  );
                }
              } else {
                if (timing.frameEnd > updatedBlocks[i].frameStart) {
                  updatedBlocks[i].frameEnd = Math.max(
                    updatedBlocks[i].frameEnd,
                    timing.frameEnd
                  );
                }
              }
            }

            // Previne sobreposição de frames sem esmagar nenhum bloco
            for (let i = 0; i < updatedBlocks.length - 1; i++) {
              const cur = updatedBlocks[i];
              const next = updatedBlocks[i + 1];
              if (next.frameStart <= cur.frameStart) {
                next.frameStart = cur.frameStart + 15;
              }
              if (cur.frameEnd >= next.frameStart) {
                cur.frameEnd = Math.max(cur.frameStart + 10, next.frameStart - 1);
                if (cur.frameEnd >= next.frameStart) {
                  next.frameStart = cur.frameEnd + 1;
                }
              }
              cur.words = ensureSubtitleWordTimings(cur);
            }
            if (updatedBlocks.length > 0) {
              const last = updatedBlocks[updatedBlocks.length - 1];
              last.words = ensureSubtitleWordTimings(last);
            }

            reconciledSubtitles.push(...updatedBlocks);
            newSyncedMap[sIdx] = getSceneBlocksSignature(
              updatedBlocks.map((b) => ({ sub: b, globalIndex: 0 }))
            );
            return;
          }
        }

        // Se não é compatível ou é cena nova, usa os blocos vindos da ElevenLabs garantindo sceneIndex e speaker
        const ensuredSceneSubs = incomingSceneSubs.map((sub) => {
          const targetScene = scenes[sIdx];
          const speakerInfo = resolveSpeakerForSubtitle(sub, targetScene);
          return {
            ...sub,
            sceneIndex: sIdx,
            speaker: speakerInfo.speaker,
            ...(speakerInfo.characterGender
              ? { characterGender: speakerInfo.characterGender }
              : {}),
          };
        });
        reconciledSubtitles.push(...ensuredSceneSubs);
        newSyncedMap[sIdx] = getSceneBlocksSignature(
          ensuredSceneSubs.map((b) => ({ sub: b, globalIndex: 0 }))
        );
      });

      reconciledSubtitles.sort((a, b) => a.frameStart - b.frameStart);

      return {
        reconciledSubtitles,
        newMasterMap,
        newSyncedMap,
      };
    },
    [sceneSubtitleGroups, getSceneBlocksSignature, scenes]
  );

  const handleAddSubtitleBlock = (sceneIdx: number) => {
    const group = sceneSubtitleGroups.find((g) => g.sceneIndex === sceneIdx);
    const bgSegment = effectiveBackgroundTimeline[sceneIdx];
    const sceneTiming = sceneTimings[sceneIdx];

    // Limites estritos da cena atual
    const sceneStart = bgSegment
      ? bgSegment.frameStart
      : sceneTiming
        ? sceneTiming.frameStart
        : 0;
    const sceneEnd = bgSegment
      ? bgSegment.frameEnd
      : sceneTiming
        ? sceneTiming.frameEnd
        : sceneStart + 120;

    let newStart: number;
    let newEnd: number;

    if (group && group.items.length > 0) {
      const lastItem = group.items[group.items.length - 1];
      const lastEnd = lastItem.sub.frameEnd;

      if (lastEnd + 15 <= sceneEnd) {
        // Cabe um novo bloco de pelo menos 15 frames após o último bloco
        newStart = lastEnd + 1;
        newEnd = Math.min(sceneEnd, newStart + 30);
      } else {
        // O último bloco já ocupa o fim da cena: reparte os frames finais da cena com o novo bloco
        const splitFrame = Math.max(
          lastItem.sub.frameStart + 10,
          sceneEnd - 25
        );
        lastItem.sub.frameEnd = Math.max(
          lastItem.sub.frameStart + 1,
          splitFrame - 1
        );
        newStart = splitFrame;
        newEnd = sceneEnd;
      }
    } else {
      // Cena sem blocos: inicia no primeiro frame da cena
      newStart = sceneStart;
      newEnd = Math.min(sceneEnd, sceneStart + 30);
    }

    const targetScene = scenes[sceneIdx];
    const defaultSpeakerInfo = resolveSpeakerForSubtitle({}, targetScene);

    const newBlock: SubtitleItem = {
      text: '',
      frameStart: newStart,
      frameEnd: newEnd,
      sceneIndex: sceneIdx,
      speaker: defaultSpeakerInfo.speaker,
      ...(defaultSpeakerInfo.characterGender
        ? { characterGender: defaultSpeakerInfo.characterGender }
        : {}),
      words: [],
    };

    setSubtitles((prev) => {
      const base = prev.length > 0 ? prev : effectiveSubtitles;
      if (!group || group.items.length === 0) {
        const insertIdx = base.findIndex((s) => s.frameStart >= newStart);
        if (insertIdx === -1) return [...base, newBlock];
        const copy = [...base];
        copy.splice(insertIdx, 0, newBlock);
        return copy;
      } else {
        const lastGlobalIndex = Math.max(
          ...group.items.map((i) => i.globalIndex)
        );
        const copy = [...base];
        const prevItem = group.items[group.items.length - 1];
        copy[prevItem.globalIndex] = { ...prevItem.sub };
        copy.splice(lastGlobalIndex + 1, 0, newBlock);
        return copy;
      }
    });
  };

  const handleDeleteSubtitleBlock = (globalIndex: number) => {
    setSubtitles((prev) => {
      const base = prev.length > 0 ? prev : effectiveSubtitles;
      return base.filter((_, idx) => idx !== globalIndex);
    });
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

    const totalFrames = Math.max(30, baseTotalFrames);
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

    // Auto-sincroniza legendas de qualquer cena que possua edições pendentes
    let finalSubtitles = subtitles.length > 0 ? subtitles : effectiveSubtitles;
    let hadAutoSync = false;
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      if (isSceneSubtitleUnsynced(sIdx)) {
        finalSubtitles = performSceneSubtitlesSync(sIdx, finalSubtitles);
        hadAutoSync = true;
      }
    }
    if (hadAutoSync) {
      setSubtitles(finalSubtitles);
    }
    setSyncedSceneBlocksMap((prev) => {
      const next = { ...prev };
      for (const grp of sceneSubtitleGroups) {
        next[grp.sceneIndex] = getSceneBlocksSignature(grp.items);
      }
      return next;
    });

    const subtitlesToPersist = finalSubtitles.map((sub) => {
      let resolvedSceneIndex = sub.sceneIndex;
      if (resolvedSceneIndex === undefined) {
        const mid = (sub.frameStart + sub.frameEnd) / 2;
        for (let i = 0; i < assembledBackgroundTimeline.length; i++) {
          const seg = assembledBackgroundTimeline[i];
          if (mid >= seg.frameStart && mid <= seg.frameEnd) {
            resolvedSceneIndex = i;
            break;
          }
        }
      }
      const targetScene =
        resolvedSceneIndex !== undefined ? scenes[resolvedSceneIndex] : undefined;
      const speakerInfo = resolveSpeakerForSubtitle(sub, targetScene);

      return {
        ...sub,
        sceneIndex: resolvedSceneIndex,
        speaker: speakerInfo.speaker,
        ...(speakerInfo.characterGender
          ? { characterGender: speakerInfo.characterGender }
          : {}),
        words: ensureSubtitleWordTimings(sub),
      };
    });

    // Sincroniza o texto das falas das cenas com as legendas consolidadas da Aba 3
    const synchronizedScenes: StoryboardScene[] = scenes.map((sc, sIdx) => {
      const sceneBlocks = finalSubtitles.filter((sub) => {
        if (sub.sceneIndex !== undefined) return sub.sceneIndex === sIdx;
        const timing = sceneTimings[sIdx];
        if (!timing) return false;
        const mid = (sub.frameStart + sub.frameEnd) / 2;
        return mid >= timing.frameStart - 2 && mid <= timing.frameEnd + 2;
      });

      if (sceneBlocks.length === 0) return sc;
      const consolidatedText = sceneBlocks
        .map((b) => b.text.trim())
        .filter(Boolean)
        .join(' ');
      if (!consolidatedText) return sc;

      const currentDialogues = getSceneDialogues(sc);
      const updatedDialogues =
        currentDialogues.length <= 1
          ? [
              {
                id: currentDialogues[0]?.id || `dlg_${sIdx}`,
                speaker:
                  currentDialogues[0]?.speaker || sc.speaker || 'protagonist',
                text: consolidatedText,
                voiceId: currentDialogues[0]?.voiceId,
                characterName: currentDialogues[0]?.characterName,
              },
            ]
          : currentDialogues;

      return {
        ...sc,
        text: consolidatedText,
        dialogues: updatedDialogues,
      };
    });

    setScenes(synchronizedScenes);

    const currentViralTitle =
      (videoRecord?.remotionProps as TimeMachineVideoProps | undefined)?.title || theme || 'Vlog de Viagem no Tempo';
    const recStoryboard = (videoRecord?.remotionProps as TimeMachineVideoProps | undefined)?.storyboard;

    const payload: TimeMachineVideoProps = {
      theme: theme || 'Vlog de Viagem no Tempo',
      title: currentViralTitle,
      durationInFrames: effectiveTotalFrames,
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
      thumbnailUrl: effectiveThumbnailSrc,
      thumbnailConfig,
      storyboard: {
        durationPreset,
        scenes: synchronizedScenes,
        audioGenerated,
        isAssembled: true,
        sceneTimings,
        avatarConfig,
        ideationOptions,
        bgmVibe: effectiveBgmVibe,
        thumbnailConfig,
        episodeFormat,
        seriesContext: episodeFormat === 'series' ? seriesContext : undefined,
        protagonistAgency,
        contentBalance,
        narrative_plan: recStoryboard?.narrative_plan,
        description: recStoryboard?.description,
      },
    };

    try {
      const res = await fetch(`/api/videos/${id}/storyboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showErrorToast(data);
        return;
      }
      if (data.video) {
        setVideoRecord(data.video);
      }
      setSuccessMsg('Vídeo montado!');
    } catch (err) {
      console.error('Erro ao persistir montagem no banco:', err);
      showErrorToast(
        err instanceof Error
          ? err.message
          : 'Erro ao persistir montagem no banco de dados.'
      );
    }
  };

  // Função para disparar o download real do arquivo .mp4 diretamente na pasta Downloads do navegador
  const triggerDirectMp4Download = async (
    videoUrl: string,
    currentTheme: string
  ) => {
    const fileName = buildMp4DownloadFileName(currentTheme);
    setIsDownloadingMp4(true);
    setDownloadProgress(0);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error('Falha ao obter o arquivo MP4 renderizado.');
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let blob: Blob;
      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            setDownloadProgress(
              Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
            );
          }
        }
        blob = new Blob(chunks, { type: 'video/mp4' });
      } else {
        setDownloadProgress(50);
        blob = await response.blob();
        setDownloadProgress(100);
      }

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
      setTimeout(() => {
        setIsDownloadingMp4(false);
        setDownloadProgress(null);
      }, 700);
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
      thumbnailUrl: effectiveThumbnailSrc,
      thumbnailConfig,
      storyboard: {
        durationPreset,
        scenes,
        audioGenerated,
        isAssembled: true,
        sceneTimings,
        avatarConfig,
        ideationOptions,
        bgmVibe: effectiveBgmVibe,
        thumbnailConfig,
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

  const seekPlayerBarByClientX = (clientX: number) => {
    const bar = playerProgressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? offsetX / rect.width : 0;
    const targetFrame = Math.round(
      ratio * Math.max(0, effectiveTotalFrames - 1)
    );
    const clamped = Math.max(0, Math.min(targetFrame, effectiveTotalFrames - 1));
    setCurrentFrame(clamped);
    playerRef.current?.seekTo(clamped);
  };

  const handlePlayerBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    wasPlayingBeforePlayerScrubRef.current = isPlaying;
    if (isPlaying) {
      playerRef.current?.pause();
    }
    setIsScrubbingPlayerBar(true);
    seekPlayerBarByClientX(e.clientX);
  };

  const handlePlayerBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = playerProgressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? offsetX / rect.width : 0;
    const targetFrame = Math.round(
      ratio * Math.max(0, effectiveTotalFrames - 1)
    );
    setPlayerBarHover({
      xPercent: ratio * 100,
      timeText: formatShortTime(targetFrame),
    });
  };

  const handlePlayerBarMouseLeave = () => {
    if (!isScrubbingPlayerBar) {
      setPlayerBarHover(null);
    }
  };

  useEffect(() => {
    if (!isScrubbingPlayerBar) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      seekPlayerBarByClientX(e.clientX);
      const bar = playerProgressBarRef.current;
      if (bar) {
        const rect = bar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const ratio = rect.width > 0 ? offsetX / rect.width : 0;
        const targetFrame = Math.round(
          ratio * Math.max(0, effectiveTotalFrames - 1)
        );
        setPlayerBarHover({
          xPercent: ratio * 100,
          timeText: formatShortTime(targetFrame),
        });
      }
    };

    const handleWindowMouseUp = () => {
      setIsScrubbingPlayerBar(false);
      setPlayerBarHover(null);
      if (wasPlayingBeforePlayerScrubRef.current) {
        playerRef.current?.play();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrubbingPlayerBar, effectiveTotalFrames]);

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

  // Identifica se a agulha está nos primeiros 0.5s da Cena #0 (Capa)
  const isCenaZeroActive = useMemo(() => {
    return thumbnailIntroFrames > 0 && currentFrame < thumbnailIntroFrames;
  }, [thumbnailIntroFrames, currentFrame]);

  // Identifica qual Cena e qual Legenda estão ativas no frame atual da agulha
  const activeSceneIndexAtPlayhead = useMemo(() => {
    if (isCenaZeroActive) return -1;
    const shiftedFrame = currentFrame - thumbnailIntroFrames;
    return effectiveBackgroundTimeline.findIndex(
      (seg) => shiftedFrame >= seg.frameStart && shiftedFrame <= seg.frameEnd
    );
  }, [effectiveBackgroundTimeline, currentFrame, isCenaZeroActive, thumbnailIntroFrames]);

  const activeSubtitleIndexAtPlayhead = useMemo(() => {
    if (isCenaZeroActive) return -1;
    const shiftedFrame = currentFrame - thumbnailIntroFrames;
    return effectiveSubtitles.findIndex(
      (sub) => shiftedFrame >= sub.frameStart && shiftedFrame <= sub.frameEnd
    );
  }, [effectiveSubtitles, currentFrame, isCenaZeroActive, thumbnailIntroFrames]);

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
          <span>FSS - Fragata Short Studio</span>
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
        </div>

        {/* Direita: Menu de 3 Pontos Verticais */}
        <div className="relative flex items-center gap-2.5" ref={optionsMenuRef}>
          <button
            type="button"
            onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
            title="Mais opções"
            aria-label="Mais opções"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2c2c32]/80 bg-[#1c1c22] text-slate-200 transition hover:border-white/20 hover:bg-[#24242c] hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
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
                    {/* Bloco de Capa / Thumbnail do Vídeo (Topo da Aba 2) */}
                    <ThumbnailCard
                      videoId={id || ''}
                      theme={theme}
                      thumbnailConfig={thumbnailConfig}
                      onUpdateThumbnailConfig={(newConf) => setThumbnailConfig(newConf)}
                      resolveAssetSrc={resolveAssetSrc}
                    />

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
                        Estilo &amp; Animação
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Alterações aplicadas em tempo real no vídeo
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 transition-transform">
                      {isSubtitleStyleCollapsed ? '⌄' : '⌃'}
                    </span>
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

                      {/* 4. Paleta de Cores por Personagem (3 Linhas: Protagonista, Narrador, Personagens) */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Cores por Personagem
                          </label>
                          <span className="text-[10px] text-slate-500">
                            Principal / Destaque
                          </span>
                        </div>

                        {/* Linha 1: Protagonista */}
                        {(() => {
                          const pair =
                            subtitleStyle.speakerStyles?.protagonist ||
                            DEFAULT_SPEAKER_STYLES.protagonist;
                          return (
                            <div className="rounded-lg border border-[#2c2c32]/70 bg-[#141418] p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-300">
                                  <span>🧑</span> Protagonista (Billy)
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Destaque: <strong className="text-red-400 font-semibold">Vermelho</strong>
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Cor Principal */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Principal</span>
                                  <div className="flex items-center gap-1.5">
                                    {['#FFFFFF', '#FEF08A'].map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange('protagonist', 'primaryColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.primaryColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-amber-400 ring-1 ring-amber-400/50'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.primaryColor}
                                      onChange={(e) => handleSpeakerColorChange('protagonist', 'primaryColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor principal"
                                    />
                                  </div>
                                </div>
                                {/* Cor de Destaque */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Destaque</span>
                                  <div className="flex items-center gap-1.5">
                                    {['#EF4444', '#FBBF24', '#22C55E'].map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange('protagonist', 'highlightColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.highlightColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-white ring-1 ring-red-400/70'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.highlightColor}
                                      onChange={(e) => handleSpeakerColorChange('protagonist', 'highlightColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor de destaque"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Linha 2: Narrador */}
                        {(() => {
                          const pair =
                            subtitleStyle.speakerStyles?.narrator ||
                            DEFAULT_SPEAKER_STYLES.narrator;
                          return (
                            <div className="rounded-lg border border-[#2c2c32]/70 bg-[#141418] p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                                  <span>🎙️</span> Narrador
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Destaque: <strong className="text-amber-400 font-semibold">Amarelo</strong>
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Cor Principal */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Principal</span>
                                  <div className="flex items-center gap-1.5">
                                    {['#FFFFFF', '#FEF08A'].map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange('narrator', 'primaryColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.primaryColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-amber-400 ring-1 ring-amber-400/50'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.primaryColor}
                                      onChange={(e) => handleSpeakerColorChange('narrator', 'primaryColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor principal"
                                    />
                                  </div>
                                </div>
                                {/* Cor de Destaque */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Destaque</span>
                                  <div className="flex items-center gap-1.5">
                                    {['#FBBF24', '#38BDF8', '#22C55E'].map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange('narrator', 'highlightColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.highlightColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-white ring-1 ring-amber-400/70'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.highlightColor}
                                      onChange={(e) => handleSpeakerColorChange('narrator', 'highlightColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor de destaque"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Linha 3: Personagens com Segmentação Interna (Tabs Masc/Fem) */}
                        {(() => {
                          const activeKey: SpeakerStyleKey =
                            characterGenderTab === 'male'
                              ? 'character_male'
                              : 'character_female';
                          const pair =
                            subtitleStyle.speakerStyles?.[activeKey] ||
                            DEFAULT_SPEAKER_STYLES[activeKey];
                          return (
                            <div className="rounded-lg border border-[#2c2c32]/70 bg-[#141418] p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                                  <span>🎭</span> Personagens
                                </span>
                                {/* Tabs / Chips Masc e Fem */}
                                <div className="flex items-center rounded-md bg-[#1f1f26] p-0.5 border border-white/10">
                                  <button
                                    type="button"
                                    onClick={() => setCharacterGenderTab('male')}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
                                      characterGenderTab === 'male'
                                        ? 'bg-blue-600/80 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    ⚔️ Masc (Azul)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCharacterGenderTab('female')}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
                                      characterGenderTab === 'female'
                                        ? 'bg-pink-600/80 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    👑 Fem (Rosa)
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Cor Principal */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Principal</span>
                                  <div className="flex items-center gap-1.5">
                                    {['#FFFFFF', '#FEF08A'].map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange(activeKey, 'primaryColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.primaryColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-amber-400 ring-1 ring-amber-400/50'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.primaryColor}
                                      onChange={(e) => handleSpeakerColorChange(activeKey, 'primaryColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor principal"
                                    />
                                  </div>
                                </div>
                                {/* Cor de Destaque */}
                                <div className="flex items-center justify-between rounded bg-[#1b1b22] px-2 py-1 border border-white/5">
                                  <span className="text-[10px] text-slate-400 font-medium">Destaque</span>
                                  <div className="flex items-center gap-1.5">
                                    {(characterGenderTab === 'male'
                                      ? ['#38BDF8', '#3B82F6', '#22C55E']
                                      : ['#F472B6', '#EC4899', '#A855F7']
                                    ).map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => handleSpeakerColorChange(activeKey, 'highlightColor', hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`h-4 w-4 rounded-full border transition ${
                                          pair.highlightColor.toLowerCase() === hex.toLowerCase()
                                            ? 'scale-110 border-white ring-1 ring-blue-400/70'
                                            : 'border-white/20 opacity-75'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={pair.highlightColor}
                                      onChange={(e) => handleSpeakerColorChange(activeKey, 'highlightColor', e.target.value)}
                                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                                      title="Escolher cor de destaque"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
                        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1.5 custom-scrollbar">
                          {/* Botão Sincronizar Legenda/Voz (w-full acima da cena #1) */}
                          <button
                            type="button"
                            onClick={handleSynchronizeAllScenesSubtitles}
                            disabled={isSynchronizingAllSubtitles}
                            className="w-full mb-2 flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border border-amber-500/35 px-4 py-2.5 text-xs font-bold text-amber-300 hover:from-amber-500/30 hover:to-orange-500/25 hover:border-amber-500/60 hover:text-white transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 select-none cursor-pointer"
                            title="Audita todas as legendas, remove blocos vazios, restaura falas cortadas e calibra os tempos com o áudio"
                          >
                            <span>
                              {isSynchronizingAllSubtitles
                                ? 'Sincronizando...'
                                : 'Sincronizar Legenda/Voz'}
                            </span>
                          </button>

                          {sceneSubtitleGroups.map((group) => {
                            const isCollapsed =
                              collapsedSubtitleScenes[group.sceneIndex] !== undefined
                                ? collapsedSubtitleScenes[group.sceneIndex]
                                : true;
                            const hasActiveSubtitle = group.items.some(
                              (item) => item.globalIndex === activeSubtitleIndexAtPlayhead
                            );

                            return (
                              <div
                                key={`subtitle-scene-${group.sceneIndex}`}
                                className={`rounded-xl border bg-[#16161b] p-3 space-y-2.5 transition-all ${
                                  hasActiveSubtitle
                                    ? 'border-amber-500/40'
                                    : 'border-white/[0.06] hover:border-white/[0.12]'
                                }`}
                              >
                                {/* Cabeçalho Clicável da Cena (Accordion) */}
                                <div
                                  onClick={() => toggleSubtitleSceneCollapse(group.sceneIndex)}
                                  className={`flex cursor-pointer flex-col gap-1 select-none transition-colors ${
                                    isCollapsed ? '' : 'border-b border-white/[0.04] pb-2'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                                        <span>🎬</span>
                                        <span>Cena #{group.sceneIndex + 1}</span>
                                      </span>
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded bg-[#1e2029] border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-300"
                                        title={`Duração estimada desta cena: ~${group.durationSeconds.toFixed(1)}s`}
                                      >
                                        ~{group.durationSeconds.toFixed(1)}s
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isSceneSubtitleUnsynced(group.sceneIndex) && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSynchronizeSceneSubtitles(group.sceneIndex);
                                          }}
                                          title="Sincronizar tempos das palavras desta cena com o áudio"
                                          className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[9px] font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-sm animate-pulse"
                                        >
                                          <span>Sincronizar</span>
                                        </button>
                                      )}
                                      <span className="text-[9px] font-medium text-slate-400">
                                        {group.items.length}{' '}
                                        {group.items.length === 1 ? 'bloco' : 'blocos'}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold text-slate-400 transition-transform duration-200 inline-block ${
                                          isCollapsed ? '' : 'rotate-180'
                                        }`}
                                      >
                                        ▼
                                      </span>
                                    </div>
                                  </div>

                                  {group.scene?.text && (
                                    <span
                                      className="text-[10px] text-slate-400 line-clamp-1 truncate"
                                      title={group.scene.text}
                                    >
                                      {group.scene.text}
                                    </span>
                                  )}
                                </div>

                                {/* Conteúdo Expandido com Lista de Blocos de Fala da Cena */}
                                {!isCollapsed && (
                                  <div className="space-y-2 pt-0.5">
                                    {group.items.length === 0 ? (
                                      <p className="text-[11px] text-slate-500 italic py-1 pl-1">
                                        Nenhum bloco de fala nesta cena.
                                      </p>
                                    ) : (
                                      group.items.map(({ sub, globalIndex }) => {
                                        const isCurrentBlock =
                                          globalIndex === activeSubtitleIndexAtPlayhead;
                                        return (
                                          <div
                                            key={globalIndex}
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
                                                #{globalIndex + 1}
                                              </button>

                                              <input
                                                type="text"
                                                value={sub.text}
                                                onChange={(e) =>
                                                  handleSubtitleChange(
                                                    globalIndex,
                                                    'text',
                                                    e.target.value
                                                  )
                                                }
                                                className="w-full rounded-lg border border-[#2c2c32]/80 bg-[#121214] px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                              />

                                              <button
                                                type="button"
                                                onClick={() => handleDeleteSubtitleBlock(globalIndex)}
                                                title="Remover este bloco de legenda"
                                                className="shrink-0 rounded-md p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                              >
                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
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
                                                      globalIndex,
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
                                                      globalIndex,
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
                                      })
                                    )}

                                    {/* Botão para Adicionar Novo Bloco na Cena */}
                                    <div className="flex justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleAddSubtitleBlock(group.sceneIndex)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:border-amber-500/40 hover:text-amber-300 transition"
                                      >
                                        <span>+</span>
                                        <span>Novo Bloco</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
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
                        Grave a narração das falas do roteiro com ElevenLabs
                      </p>
                      
                    </span>
                    <span className="text-xs text-slate-400 transition-transform">
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

                      {/* Subseção Recolhível: Regravação Pontual de Falas por Cena */}
                      {audioGenerated && (
                        <div className="pt-2 border-t border-white/[0.06] space-y-2">
                          <div
                            onClick={toggleAudioPhrasesCollapsed}
                            className="flex cursor-pointer select-none items-center justify-between gap-2 py-0.5 hover:opacity-90 transition-opacity"
                          >
                            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <span>💬</span>
                              <span>Regravação de Frases por Cena</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-teal-400 font-medium">
                                Ajuste Fino
                              </span>
                              <span className="text-xs text-slate-400 transition-transform">
                                {isAudioPhrasesCollapsed ? '⌄' : '⌃'}
                              </span>
                            </div>
                          </div>

                          {!isAudioPhrasesCollapsed && (
                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar pt-1">
                              {scenes.map((scene, sceneIdx) => {
                              const dialogues = getSceneDialogues(scene);
                              const isCollapsed =
                                collapsedNarrationScenes[sceneIdx] !== undefined
                                  ? collapsedNarrationScenes[sceneIdx]
                                  : true;
                              const sceneTiming = sceneTimings[sceneIdx];
                              const sceneDuration = sceneTiming
                                ? Math.max(
                                    0.5,
                                    Number(
                                      (
                                        sceneTiming.endSecond -
                                        sceneTiming.startSecond
                                      ).toFixed(1)
                                    )
                                  )
                                : 4.0;

                              return (
                                <div
                                  key={`narration-scene-${sceneIdx}`}
                                  className="rounded-xl border border-white/[0.06] bg-[#16161b] p-2.5 space-y-2 transition-all hover:border-white/[0.12]"
                                >
                                  {/* Cabeçalho Accordion da Cena */}
                                  <div
                                    onClick={() =>
                                      toggleNarrationSceneCollapse(sceneIdx)
                                    }
                                    className={`flex cursor-pointer flex-col gap-1 select-none transition-colors ${
                                      isCollapsed
                                        ? ''
                                        : 'border-b border-white/[0.04] pb-2'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1">
                                          <span>🎬</span>
                                          <span>Cena #{sceneIdx + 1}</span>
                                        </span>
                                        <span
                                          className="inline-flex items-center gap-0.5 rounded bg-[#1e2029] border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-300"
                                          title={`Duração estimada desta cena: ~${sceneDuration.toFixed(1)}s`}
                                        >
                                          ~{sceneDuration.toFixed(1)}s
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-medium text-slate-400">
                                          {dialogues.length}{' '}
                                          {dialogues.length === 1
                                            ? 'fala'
                                            : 'falas'}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold text-slate-400 transition-transform duration-200 inline-block ${
                                            isCollapsed ? '' : 'rotate-180'
                                          }`}
                                        >
                                          ▼
                                        </span>
                                      </div>
                                    </div>

                                    <span
                                      className="text-[10px] text-slate-400 line-clamp-1 truncate"
                                      title={scene.text}
                                    >
                                      {scene.text || 'Sem fala'}
                                    </span>
                                  </div>

                                  {/* Conteúdo Expandido com Lista de Falas */}
                                  {!isCollapsed && (
                                    <div className="space-y-2.5 pt-0.5">
                                      {dialogues.map((dialogue, dIdx) => {
                                        const isCharacter =
                                          dialogue.speaker === 'character';
                                        const currentCharVoice =
                                          voiceCatalog.characters.find(
                                            (v) => v.id === dialogue.voiceId
                                          ) || voiceCatalog.characters[0];
                                        const rolePreviewUrl =
                                          dialogue.speaker === 'protagonist'
                                            ? voiceCatalog.protagonist
                                                .preview_url
                                            : dialogue.speaker === 'narrator'
                                              ? voiceCatalog.narrator
                                                  .preview_url
                                              : currentCharVoice?.preview_url;
                                        const roleVoiceName =
                                          dialogue.speaker === 'protagonist'
                                            ? voiceCatalog.protagonist.name
                                            : dialogue.speaker === 'narrator'
                                              ? voiceCatalog.narrator.name
                                              : currentCharVoice?.name;

                                        const isThisRegenerating =
                                          regeneratingDialogueKey ===
                                          `${sceneIdx}-${dIdx}`;

                                        return (
                                          <div
                                            key={
                                              dialogue.id ||
                                              `dlg-${sceneIdx}-${dIdx}`
                                            }
                                            className="rounded-lg bg-[#111115] p-2.5 border border-white/[0.04] space-y-2"
                                          >
                                            {/* Linha 1: Seletor de Orador & Preview de Voz */}
                                            <div className="space-y-1.5">
                                              <div className="flex items-center gap-1.5">
                                                <select
                                                  value={dialogue.speaker}
                                                  onChange={(e) =>
                                                    handleUpdateDialogueInStudio(
                                                      sceneIdx,
                                                      dialogue.id,
                                                      'speaker',
                                                      e.target.value
                                                    )
                                                  }
                                                  className="flex-1 rounded-md border border-[#30303c] bg-[#1a1a22] px-2 py-1.5 text-[11px] font-bold text-amber-300 focus:border-amber-500 focus:outline-none"
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

                                              {/* Se for Personagem: Dropdown de Vozes e Nome */}
                                              {isCharacter && (
                                                <div className="space-y-1 rounded bg-[#181820] p-1.5 border border-[#2a2a36]">
                                                  <select
                                                    value={
                                                      dialogue.voiceId ||
                                                      currentCharVoice?.id
                                                    }
                                                    onChange={(e) =>
                                                      handleUpdateDialogueInStudio(
                                                        sceneIdx,
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

                                                  <input
                                                    type="text"
                                                    value={
                                                      dialogue.characterName ||
                                                      ''
                                                    }
                                                    onChange={(e) =>
                                                      handleUpdateDialogueInStudio(
                                                        sceneIdx,
                                                        dialogue.id,
                                                        'characterName',
                                                        e.target.value
                                                      )
                                                    }
                                                    placeholder="Nome do Personagem (ex: Cleópatra)"
                                                    className="w-full rounded border border-[#323242] bg-[#14141a] px-1.5 py-0.5 text-[10px] text-amber-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            {/* Linha 2: Texto da Fala Editável para Regravação */}
                                            <div className="space-y-1">
                                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span className="font-medium text-slate-300">
                                                  Texto da fala para regravar:
                                                </span>
                                                <span className="text-[9px] font-mono text-amber-400/90">
                                                  {dialogue.text
                                                    ?.trim()
                                                    .split(/\s+/)
                                                    .filter(Boolean).length || 0}{' '}
                                                  palavras
                                                </span>
                                              </div>
                                              <textarea
                                                rows={2}
                                                value={dialogue.text || ''}
                                                onChange={(e) =>
                                                  handleUpdateDialogueInStudio(
                                                    sceneIdx,
                                                    dialogue.id,
                                                    'text',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="Digite o texto da fala a ser regravada na ElevenLabs..."
                                                className="w-full resize-none rounded-lg border border-[#30303c] bg-[#14141a] p-2 text-[11px] text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none transition-colors"
                                              />
                                            </div>

                                            {/* Linha 3: Botão Regravar Frase */}
                                            <div className="flex justify-end pt-0.5">
                                              <button
                                                type="button"
                                                disabled={
                                                  isThisRegenerating ||
                                                  !dialogue.text?.trim()
                                                }
                                                onClick={() =>
                                                  void handleRegenerateDialogueAudio(
                                                    sceneIdx,
                                                    dIdx,
                                                    dialogue
                                                  )
                                                }
                                                title="Regravar cirurgicamente esta frase na ElevenLabs e atualizar o áudio e as legendas"
                                                className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-[11px] font-bold text-teal-300 transition hover:bg-teal-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                              >
                                                {isThisRegenerating ? (
                                                  <>
                                                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-teal-300 border-t-transparent" />
                                                    <span>Regravando...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span>🎙️</span>
                                                    <span>Regravar Frase</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        </div>
                      )}
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
                    <span className="text-xs text-slate-400 transition-transform">
                      {isAudioMixerCollapsed ? '⌄' : '⌃'}
                    </span>
                  </div>

                  {!isAudioMixerCollapsed && (
                    <>
                      {/* 1. Seletor de Trilha Sonora BGM com Pré-Escuta */}
                      <div className="space-y-1.5 pb-2 border-b border-[#2c2c32]/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <span>🎵</span>
                            <span>Trilha Sonora</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 min-w-0">
                            <select
                              value={effectiveBgmVibe}
                              onChange={(e) => {
                                const newVibe = e.target.value as BgmVibe;
                                setBgmVibe(newVibe);
                                if (playingSfxPreview === 'bgm-preview') {
                                  stopSfxPreview();
                                }
                              }}
                              className="w-full rounded-lg border border-[#2c2c32] bg-[#121216] px-2.5 py-2 text-xs font-medium text-slate-200 focus:border-amber-500 focus:outline-none transition truncate"
                            >
                              {BGM_VIBE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label.replace(/\s*\(\d+%\)/, '')}
                                </option>
                              ))}
                            </select>
                          </div>

                          {effectiveBgmVibe !== 'none' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (playingSfxPreview === 'bgm-preview') {
                                  stopSfxPreview();
                                } else {
                                  const selectedOption = BGM_VIBE_OPTIONS.find(
                                    (b) => b.value === effectiveBgmVibe
                                  );
                                  if (selectedOption?.file) {
                                    handlePlaySfxPreview(
                                      resolveAssetSrc(selectedOption.file),
                                      'bgm-preview',
                                      {
                                        targetDurationSec: 20.0,
                                        volume: Math.max(0.25, bgmVolume),
                                      }
                                    );
                                  }
                                }
                              }}
                              title={
                                playingSfxPreview === 'bgm-preview'
                                  ? 'Pausar pré-escuta da trilha sonora'
                                  : 'Ouvir prévia desta trilha sonora'
                              }
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition active:scale-95 ${
                                playingSfxPreview === 'bgm-preview'
                                  ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse'
                                  : 'border-white/10 bg-[#16161c] text-slate-300 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300'
                              }`}
                            >
                              {playingSfxPreview === 'bgm-preview' ? '⏹' : '▶'}
                            </button>
                          )}
                        </div>
                      </div>

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
                    <span className="text-xs text-slate-400 transition-transform">
                      {isAudioSfxCollapsed ? '⌄' : '⌃'}
                    </span>
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
                            const actionItem = getSceneActionSfx(scene);
                            const ambientItem = getSceneAmbientSfx(scene);
                            const hasAction = Boolean(
                              actionItem?.audio_url ||
                                actionItem?.sfx_key ||
                                actionItem?.sound_prompt?.trim()
                            );
                            const hasAmbient = Boolean(
                              ambientItem?.audio_url ||
                                ambientItem?.sfx_key ||
                                ambientItem?.sound_prompt?.trim()
                            );

                            const isCollapsed =
                              collapsedSfxScenes[sceneIdx] !== undefined
                                ? collapsedSfxScenes[sceneIdx]
                                : true;

                            const sceneTiming = sceneTimings[sceneIdx];
                            const sceneDuration = sceneTiming
                              ? Math.max(
                                  0.5,
                                  Number(
                                    (
                                      sceneTiming.endSecond -
                                      sceneTiming.startSecond
                                    ).toFixed(1)
                                  )
                                )
                              : 4.0;

                            return (
                              <div
                                key={`scene-sfx-group-${sceneIdx}`}
                                className="rounded-xl border border-white/[0.06] bg-[#16161b] p-3 space-y-2.5 transition-all hover:border-white/[0.12] overflow-hidden"
                              >
                                {/* Cabeçalho Clicável da Cena (Accordion) */}
                                <div
                                  onClick={() => toggleSfxSceneCollapse(sceneIdx)}
                                  className={`flex cursor-pointer flex-col gap-1 select-none transition-colors ${
                                    isCollapsed
                                      ? ''
                                      : 'border-b border-white/[0.04] pb-2'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1.5">
                                        <span>🎬</span>
                                        <span>Cena #{sceneIdx + 1}</span>
                                      </span>
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded bg-[#1e2029] border border-white/[0.06] px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-300"
                                        title={`Duração estimada desta cena: ~${sceneDuration.toFixed(1)}s`}
                                      >
                                        ⏱️ ~{sceneDuration.toFixed(1)}s
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {hasAction && (
                                        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                                          💥 Ação
                                        </span>
                                      )}
                                      {hasAmbient && (
                                        <span className="rounded bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">
                                          🌿 Ambiente
                                        </span>
                                      )}
                                      {!hasAction && !hasAmbient && (
                                        <span className="rounded bg-slate-800/80 border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">
                                          🔇 Sem Efeito
                                        </span>
                                      )}

                                      <span
                                        className={`text-[10px] font-bold text-slate-400 transition-transform duration-200 inline-block ${
                                          isCollapsed ? '' : 'rotate-180'
                                        }`}
                                      >
                                        ▼
                                      </span>
                                    </div>
                                  </div>

                                  <span
                                    className="text-[10px] text-slate-400 line-clamp-1 truncate"
                                    title={scene.text}
                                  >
                                    {scene.text || 'Sem fala'}
                                  </span>
                                </div>

                                {!isCollapsed && (
                                  <div className="space-y-3 pt-1">
                                    <SceneSfxSlotCard
                                      slot="action"
                                      title="Ação"
                                      icon="💥"
                                      sceneIdx={sceneIdx}
                                      sfxItem={actionItem}
                                      sceneDuration={sceneDuration}
                                      sfxLibraryOptions={sfxLibraryOptions}
                                      detectedSfxDurations={detectedSfxDurations}
                                      playingSfxPreview={playingSfxPreview}
                                      generatingSfxKey={generatingSfxKey}
                                      promotingSfxSceneIndex={promotingSfxSceneIndex}
                                      onUpdate={(updates) =>
                                        handleUpdateSceneSfxSlot(sceneIdx, 'action', updates)
                                      }
                                      onOptionChange={(opt) =>
                                        handleSceneSfxSlotOptionChange(sceneIdx, 'action', opt)
                                      }
                                      onGenerate={(prompt, duration) =>
                                        void handleGenerateSceneSfx(
                                          sceneIdx,
                                          prompt,
                                          duration,
                                          'action'
                                        )
                                      }
                                      onPlayPreview={handlePlaySfxPreview}
                                      onStopPreview={stopSfxPreview}
                                      onRemoveCustom={() =>
                                        handleRemoveCustomSfxSlot(sceneIdx, 'action')
                                      }
                                      onPromote={() =>
                                        void handlePromoteStoryboardSceneSfx(sceneIdx, 'action')
                                      }
                                    />

                                    <SceneSfxSlotCard
                                      slot="ambient"
                                      title="Ambiente"
                                      icon="🌿"
                                      sceneIdx={sceneIdx}
                                      sfxItem={ambientItem}
                                      sceneDuration={sceneDuration}
                                      sfxLibraryOptions={sfxLibraryOptions}
                                      detectedSfxDurations={detectedSfxDurations}
                                      playingSfxPreview={playingSfxPreview}
                                      generatingSfxKey={generatingSfxKey}
                                      promotingSfxSceneIndex={promotingSfxSceneIndex}
                                      onUpdate={(updates) =>
                                        handleUpdateSceneSfxSlot(sceneIdx, 'ambient', updates)
                                      }
                                      onOptionChange={(opt) =>
                                        handleSceneSfxSlotOptionChange(sceneIdx, 'ambient', opt)
                                      }
                                      onGenerate={(prompt, duration) =>
                                        void handleGenerateSceneSfx(
                                          sceneIdx,
                                          prompt,
                                          duration,
                                          'ambient'
                                        )
                                      }
                                      onPlayPreview={handlePlaySfxPreview}
                                      onStopPreview={stopSfxPreview}
                                      onRemoveCustom={() =>
                                        handleRemoveCustomSfxSlot(sceneIdx, 'ambient')
                                      }
                                      onPromote={() =>
                                        void handlePromoteStoryboardSceneSfx(sceneIdx, 'ambient')
                                      }
                                    />
                                  </div>
                                )}
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
            {(isPending || isRerendering || isDownloadingMp4) && (
              <div className="absolute top-4 right-4 z-30 flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-[#18181c]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md min-w-[200px] animate-fadeIn">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-amber-300">
                  <span>{isDownloadingMp4 ? 'Baixando MP4' : 'Renderizando MP4'}</span>
                  <span className="font-mono text-[11px] font-bold text-amber-400">
                    {displayProgress !== null ? `${displayProgress}%` : ''}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-300 ease-out"
                    style={{
                      width: `${displayProgress !== null ? Math.max(3, displayProgress) : 0}%`,
                    }}
                  />
                </div>
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
                    thumbnailUrl: effectiveThumbnailSrc,
                    thumbnailConfig,
                    storyboard: {
                      durationPreset,
                      scenes,
                      audioGenerated,
                      isAssembled,
                      sceneTimings,
                      avatarConfig,
                      ideationOptions,
                      bgmVibe: effectiveBgmVibe,
                      thumbnailConfig,
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
                {/* Barra de Progresso Fina Clicável e Arrastável com Thumb e Tooltip */}
                <div
                  ref={playerProgressBarRef}
                  onMouseDown={handlePlayerBarMouseDown}
                  onMouseMove={handlePlayerBarMouseMove}
                  onMouseLeave={handlePlayerBarMouseLeave}
                  className="group/progress relative mb-2 flex h-3.5 w-full cursor-pointer items-center select-none"
                >
                  {/* Tooltip com timecode flutuante ao passar mouse ou arrastar */}
                  {playerBarHover && (
                    <div
                      className="pointer-events-none absolute -top-6 -translate-x-1/2 z-30 rounded bg-slate-900/95 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white shadow-xl border border-white/20 whitespace-nowrap"
                      style={{
                        left: `${Math.max(4, Math.min(96, playerBarHover.xPercent))}%`,
                      }}
                    >
                      {playerBarHover.timeText}
                    </div>
                  )}

                  {/* Trilha da Barra */}
                  <div className="relative h-1 w-full rounded-full bg-white/15 transition-all duration-150 group-hover/progress:h-1.5">
                    {/* Barra de Preenchimento */}
                    <div
                      className={`h-full rounded-full bg-slate-200 ${
                        isScrubbingPlayerBar ? '' : 'transition-all duration-75'
                      }`}
                      style={{ width: `${playheadPercent}%` }}
                    />
                    {/* Thumb / Bolinha Indicadora Arrastável */}
                    <div
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-transform duration-100 ${
                        isScrubbingPlayerBar
                          ? 'scale-100 ring-2 ring-white/50'
                          : 'scale-0 group-hover/progress:scale-100'
                      }`}
                      style={{ left: `${playheadPercent}%` }}
                    />
                  </div>
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
                {isCenaZeroActive ? (
                  <div className="flex items-center gap-2 min-w-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px]">
                    <span className="shrink-0 font-mono font-bold text-red-400">
                      {formatShortTime(currentFrame)}
                    </span>
                    <span className="text-amber-500/40">•</span>
                    <span className="shrink-0 font-semibold text-amber-300">
                      Cena #0 - Capa
                    </span>
                  </div>
                ) : activeSceneIndexAtPlayhead >= 0 ? (
                  <div className="flex items-center gap-2 min-w-0 rounded-md border border-white/[0.08] bg-[#121216] px-2.5 py-0.5 text-[11px]">
                    <span className="shrink-0 font-mono font-bold text-red-400">
                      {formatShortTime(currentFrame)}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="shrink-0 font-semibold text-teal-300">
                      Cena #{activeSceneIndexAtPlayhead + 1}
                    </span>
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                {thumbnailIntroFrames > 0 ? '1 capa + ' : ''}
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
                  {/* Cena #0: Capa / Thumbnail (0.5s) */}
                  {thumbnailIntroFrames > 0 && effectiveThumbnailSrc && (
                    <div
                      style={{
                        left: '0%',
                        width: `${Math.max(1, (thumbnailIntroFrames / Math.max(1, effectiveTotalFrames)) * 100 - 0.4)}%`,
                      }}
                      className={`absolute inset-y-0 overflow-hidden rounded-lg border flex items-center gap-1.5 pr-1.5 shadow-sm transition ${
                        isCenaZeroActive
                          ? 'border-amber-300 bg-[#8c5e26] ring-1 ring-amber-300/50 brightness-110'
                          : 'border-amber-500/40 bg-[#63441a] hover:brightness-110'
                      }`}
                      title="Cena #0 - Capa (0.5s)"
                    >
                      <img
                        src={resolveAssetSrc(effectiveThumbnailSrc)}
                        alt="Cena #0 - Capa"
                        draggable={false}
                        className="h-full w-8 shrink-0 object-cover border-r border-amber-300/30"
                      />
                      <span className="truncate text-xs font-semibold text-amber-200 drop-shadow-xs">
                        Capa
                      </span>
                    </div>
                  )}

                  {effectiveBackgroundTimeline.map((seg, idx) => {
                    const leftPct =
                      ((thumbnailIntroFrames + seg.frameStart) /
                        Math.max(1, effectiveTotalFrames)) *
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
                  <div
                    style={{
                      left: `${(thumbnailIntroFrames / Math.max(1, effectiveTotalFrames)) * 100}%`,
                      width: `${((effectiveTotalFrames - thumbnailIntroFrames) / Math.max(1, effectiveTotalFrames)) * 100}%`,
                    }}
                    className="absolute inset-y-0 overflow-hidden rounded-lg border border-sky-400/35 bg-[#24537a] flex items-center px-2"
                  >
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
                      ((thumbnailIntroFrames + sub.frameStart) /
                        Math.max(1, effectiveTotalFrames)) *
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

      {/* Toasts Flutuantes Empilhados (Sucesso e Erro Detalhado) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 items-end pointer-events-none">
        {successToast && (
          <div
            key={successToast.id}
            className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-emerald-300 shadow-2xl shadow-black/80 backdrop-blur-md animate-toast-fly pointer-events-auto"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-slate-100">{successToast.text}</span>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
              title="Fechar notificação"
            >
              ✕
            </button>
          </div>
        )}

        {errorToast && (
          <div
            key={errorToast.id}
            className="flex max-w-md items-start gap-3 rounded-xl border border-rose-500/40 bg-slate-900/95 p-4 text-xs font-semibold text-rose-300 shadow-2xl shadow-black/80 backdrop-blur-md animate-toast-fly pointer-events-auto"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 mt-0.5">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-slate-100 font-bold">{errorToast.title}</p>
              {errorToast.details && errorToast.details.length > 0 && (
                <ul className="mt-1 space-y-1 text-[11px] font-normal text-slate-300 list-disc list-inside">
                  {errorToast.details.map((d, dIdx) => (
                    <li key={`err-detail-${dIdx}`}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setErrorToast(null)}
              className="ml-2 text-slate-400 hover:text-white transition-colors"
              title="Fechar notificação de erro"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
