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
  fontFamily: 'impact',
  fontSize: 64,
  primaryColor: '#FFFFFF',
  highlightColor: '#FBBF24',
  hasShadow: true,
  hasStroke: true,
  hasBackground: false,
  positionX: 50,
  positionY: 88,
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

export interface StoryboardState {
  durationPreset: DurationPreset;
  scenes: StoryboardScene[];
  audioGenerated: boolean;
  isAssembled: boolean;
  sceneTimings?: SceneFrameTiming[];
}

export type TimeMachineVideoProps = {
  theme: string;
  durationInFrames?: number;
  backgroundSrc?: string;
  backgroundTimeline?: BackgroundSegment[];
  audioSrc?: string;
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
