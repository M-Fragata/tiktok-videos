import { staticFile } from 'remotion';

export const AVAILABLE_AVATAR_SPRITES = [
  'avatars/avatar_greeting.png',
  'avatars/avatar_neutral.png',
  'avatars/avatar_shocked.png',
  'avatars/avatar_excited.png',
  'avatars/avatar_determined.png',
  'avatars/avatar_happy.png',
  'avatars/avatar_confused.png',
  'avatars/avatar_worried.png',
  'avatars/avatar_panicked.png',
  'avatars/avatar_awkward.png',
  'avatars/avatar_mad.png',
  'avatars/avatar_sad.png',
] as const;

export type AvatarSpritePath =
  | (typeof AVAILABLE_AVATAR_SPRITES)[number]
  | string;

export type SpeakerType = 'protagonist' | 'character' | 'narrator';

export type DurationPreset = 'short' | 'medium' | 'long';

export type BgmVibe = 'epic' | 'dark' | 'fun' | 'none';

export const BGM_VIBE_OPTIONS: Array<{
  value: BgmVibe;
  label: string;
  file: string | null;
}> = [
  { value: 'epic', label: '🎻 Épico & Cinematográfico (10%)', file: 'bgm/epic.mp3' },
  { value: 'dark', label: '🌑 Sombrio & Mistério (10%)', file: 'bgm/dark.mp3' },
  { value: 'fun', label: '🎪 Divertido & Curioso (10%)', file: 'bgm/fun.mp3' },
  { value: 'none', label: '🔇 Sem Música de Fundo', file: null },
];

export type AvatarHairStyle =
  | 'bald'
  | 'spiky'
  | 'curly'
  | 'mohawk'
  | 'pompadour';

export type AvatarAccessory =
  | 'none'
  | 'round_glasses'
  | 'explorer_hat'
  | 'knight_helmet'
  | 'crown'
  | 'bandana';

export type AvatarAngle = 'front' | 'right' | 'back' | 'left';

export interface AvatarConfig {
  hairStyle: AvatarHairStyle;
  hairColor?: string;
  strokeColor: string;
  accessory: AvatarAccessory;
  angle: AvatarAngle;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  hairStyle: 'spiky',
  hairColor: '#EA580C',
  strokeColor: '#111827',
  accessory: 'round_glasses',
  angle: 'front',
};

export const AVATAR_HAIR_PROMPT_MAP: Record<AvatarHairStyle, string> = {
  bald: 'smooth bald head with no hair',
  spiky: 'messy spiky 2D drawn hair',
  curly: 'voluminous curly 2D drawn hair',
  mohawk: 'bold punk mohawk 2D drawn hair',
  pompadour: 'stylish retro pompadour 2D drawn hair',
};

export const AVATAR_ACCESSORY_PROMPT_MAP: Record<AvatarAccessory, string> = {
  none: 'no headwear or glasses',
  round_glasses: 'wearing iconic round wireframe glasses',
  explorer_hat: 'wearing a classic weathered safari explorer hat',
  knight_helmet: 'wearing a medieval knight visor helmet on his round 2D head',
  crown: 'wearing a golden royal crown tilted on his 2D head',
  bandana: 'wearing a rugged adventurer bandana tied around his forehead',
};

export const buildClientAvatarPromptDescriptor = (
  config: AvatarConfig = DEFAULT_AVATAR_CONFIG
): string => {
  const hair = AVATAR_HAIR_PROMPT_MAP[config.hairStyle || 'spiky'];
  const hairColor = config.hairColor || config.strokeColor || '#111827';
  const accessory =
    AVATAR_ACCESSORY_PROMPT_MAP[config.accessory || 'round_glasses'];
  const strokeColor = config.strokeColor || '#111827';
  return `2D cartoon stickman protagonist with a smooth round white head, ${hair} in ${hairColor} color, ${accessory}, expressive simple facial features, and thin stick-figure limbs outlined in ${strokeColor} ink`;
};

export const injectAvatarConfigIntoPrompt = (
  rawPrompt: string,
  config: AvatarConfig
): string => {
  const descriptor = buildClientAvatarPromptDescriptor(config);
  const genericPattern =
    /2D cartoon stickman (?:character|protagonist) with a smooth round white head,[^.]+?limbs(?: outlined in #[0-9a-fA-F]{3,6} ink)?/i;

  if (genericPattern.test(rawPrompt)) {
    return rawPrompt.replace(genericPattern, descriptor);
  }
  return `Mixed media 2D/3D illustration, a ${descriptor}. ${rawPrompt}`;
};

export interface SubtitleWordTiming {
  word: string;
  frameStart: number;
  frameEnd: number;
}

export interface SubtitleItem {
  frameStart: number;
  frameEnd: number;
  text: string;
  words?: SubtitleWordTiming[];
}

export type SubtitleAnimationType = 'karaoke' | 'pop' | 'hormozi';

export type SubtitleFontFamily =
  | 'impact'
  | 'grotesque'
  | 'script'
  | 'montserrat';

export interface SubtitleStyleConfig {
  animationType: SubtitleAnimationType;
  fontFamily: SubtitleFontFamily;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  hasShadow: boolean;
  hasStroke: boolean;
  hasBackground: boolean;
  positionX: number;
  positionY: number;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  animationType: 'karaoke',
  fontFamily: 'montserrat',
  fontSize: 55,
  primaryColor: '#FFFFFF',
  highlightColor: '#FBBF24',
  hasShadow: true,
  hasStroke: true,
  hasBackground: false,
  positionX: 50,
  positionY: 92,
};

export interface AvatarSegment {
  startSecond: number;
  endSecond: number;
  image: AvatarSpritePath;
}

export interface BackgroundSegment {
  imageSrc: string;
  frameStart: number;
  frameEnd: number;
}

export interface SceneFrameTiming {
  sceneIndex: number;
  startSecond: number;
  endSecond: number;
  frameStart: number;
  frameEnd: number;
}

export interface StoryboardScene {
  speaker: SpeakerType;
  text: string;
  avatarSprite: AvatarSpritePath;
  imagePrompt: string;
  sfx_suggestion?: string;
  candidateImages: string[];
  selectedImage: string | null;
}

export interface IdeationOption {
  id: string;
  title: string;
  badge?: string;
  description?: string;
  scenes: StoryboardScene[];
}

export interface StoryboardState {
  durationPreset: DurationPreset;
  scenes: StoryboardScene[];
  audioGenerated: boolean;
  isAssembled: boolean;
  sceneTimings?: SceneFrameTiming[];
  avatarConfig?: AvatarConfig;
  ideationOptions?: IdeationOption[];
  bgmVibe?: BgmVibe;
}

export type TimeMachineVideoProps = {
  theme: string;
  durationInFrames?: number;
  backgroundSrc?: string;
  backgroundTimeline?: BackgroundSegment[];
  audioSrc?: string;
  bgmVibe?: BgmVibe;
  bgmVolume?: number;
  sfxEnabled?: boolean;
  subtitles?: SubtitleItem[];
  subtitleStyle?: SubtitleStyleConfig;
  avatarTimeline?: AvatarSegment[];
  showAvatarOverlay?: boolean;
  storyboard?: StoryboardState;
};

export interface VideoRecord {
  id: string;
  theme: string;
  status: 'DRAFT' | 'PENDING' | 'RENDERED' | 'FAILED' | string;
  videoUrl: string | null;
  remotionProps?: TimeMachineVideoProps | null;
  createdAt: string;
}

export const DEFAULT_SUBTITLES: SubtitleItem[] = [
  {
    frameStart: 0,
    frameEnd: 74,
    text: 'Viajante! Acabámos de aterrar em Pompeia no ano 79 d.C.!',
  },
  {
    frameStart: 75,
    frameEnd: 149,
    text: 'Olha à tua volta: as ruas estão cheias e ninguém imagina o que vem aí...',
  },
  {
    frameStart: 150,
    frameEnd: 224,
    text: 'Durante séculos, os romanos acharam que o Vesúvio era apenas uma montanha calma.',
  },
  {
    frameStart: 225,
    frameEnd: 299,
    text: 'Mas a pressão subterrânea já estava prestes a libertar uma nuvem piroclástica!',
  },
  {
    frameStart: 300,
    frameEnd: 374,
    text: 'O chão está a tremer! O topo do vulcão acabou de explodir!',
  },
  {
    frameStart: 375,
    frameEnd: 450,
    text: 'Rápido, entra na Máquina do Tempo antes que a cinza cubra tudo!',
  },
];

export const DEFAULT_AVATAR_TIMELINE: AvatarSegment[] = [
  {
    startSecond: 0,
    endSecond: 5,
    image: 'avatars/avatar_greeting.png',
  },
  {
    startSecond: 5,
    endSecond: 10,
    image: 'avatars/avatar_neutral.png',
  },
  {
    startSecond: 10,
    endSecond: 15,
    image: 'avatars/avatar_shocked.png',
  },
];

export const DEFAULT_BACKGROUND_TIMELINE: BackgroundSegment[] = [
  {
    imageSrc: 'background.jpg',
    frameStart: 0,
    frameEnd: 149,
  },
  {
    imageSrc: 'background.jpg',
    frameStart: 150,
    frameEnd: 299,
  },
  {
    imageSrc: 'background.jpg',
    frameStart: 300,
    frameEnd: 450,
  },
];

export const defaultTimeMachineProps: TimeMachineVideoProps = {
  theme: 'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  durationInFrames: 450,
  backgroundSrc: 'background.jpg',
  backgroundTimeline: DEFAULT_BACKGROUND_TIMELINE,
  audioSrc: 'audio.mp3',
  subtitles: DEFAULT_SUBTITLES,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  avatarTimeline: DEFAULT_AVATAR_TIMELINE,
};

/**
 * Garante que um SubtitleItem possua o array `words` com os intervalos de frame
 * de cada palavra (usando os timestamps reais da ElevenLabs se presentes, ou
 * dividindo proporcionalmente o intervalo do bloco entre as palavras no modo DRAFT/Preview).
 */
export const ensureSubtitleWordTimings = (
  item: SubtitleItem
): SubtitleWordTiming[] => {
  const rawWords = item.text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (rawWords.length === 0) {
    return [];
  }

  if (item.words && item.words.length === rawWords.length) {
    return item.words;
  }

  const totalFrames = Math.max(1, item.frameEnd - item.frameStart + 1);
  const framesPerWord = totalFrames / rawWords.length;

  return rawWords.map((word, idx) => {
    const wStart = Math.round(item.frameStart + idx * framesPerWord);
    const wEnd =
      idx === rawWords.length - 1
        ? item.frameEnd
        : Math.max(
            wStart,
            Math.round(item.frameStart + (idx + 1) * framesPerWord) - 1
          );
    return {
      word,
      frameStart: wStart,
      frameEnd: wEnd,
    };
  });
};

/**
 * Divide uma fala longa (ex: texto bruto de uma cena no modo DRAFT antes de gravar áudio)
 * em blocos dinâmicos curtos de 3 a 4 palavras distribuídos ao longo de [frameStart, frameEnd],
 * já com os tempos simulados por palavra para o efeito Karaokê / Pop / Hormozi.
 */
export const splitSceneTextIntoSubtitleChunks = (
  text: string,
  frameStart: number,
  frameEnd: number,
  wordsPerChunk = 4
): SubtitleItem[] => {
  const cleanWords = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleanWords.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let i = 0; i < cleanWords.length; i += wordsPerChunk) {
    chunks.push(cleanWords.slice(i, i + wordsPerChunk));
  }

  const totalFrames = Math.max(chunks.length, frameEnd - frameStart + 1);
  const totalWords = cleanWords.length;

  const result: SubtitleItem[] = [];
  let consumedWords = 0;

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunkWords = chunks[cIdx];
    const startRatio = consumedWords / totalWords;
    const endRatio = (consumedWords + chunkWords.length) / totalWords;

    const cStart =
      cIdx === 0
        ? frameStart
        : Math.min(frameEnd, Math.round(frameStart + startRatio * totalFrames));
    const cEnd =
      cIdx === chunks.length - 1
        ? frameEnd
        : Math.max(
            cStart,
            Math.round(frameStart + endRatio * totalFrames) - 1
          );

    const chunkItem: SubtitleItem = {
      frameStart: cStart,
      frameEnd: cEnd,
      text: chunkWords.join(' '),
    };
    chunkItem.words = ensureSubtitleWordTimings(chunkItem);
    result.push(chunkItem);

    consumedWords += chunkWords.length;
  }

  return result;
};

/**
 * Resolve o caminho de um asset: se for URL externa (http/https) ou rota servida pelo backend (/storage/...),
 * retorna diretamente; caso contrário, utiliza staticFile() do Remotion apontando para frontend/public/.
 */
export const resolveAssetSrc = (src: string): string => {
  if (
    /^https?:\/\//i.test(src) ||
    src.startsWith('/storage/') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src;
  }
  const normalizedPath = src.replace(/^\/+/, '');
  return staticFile(normalizedPath);
};
