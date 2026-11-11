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

export type BgmVibe =
  | 'epic'
  | 'dark'
  | 'fun'
  | 'hiphop'
  | 'action'
  | 'piano'
  | 'adventure'
  | 'comedy'
  | 'none';

export type BriefingBgmOption = 'auto' | BgmVibe;

export const BGM_VIBE_OPTIONS: Array<{
  value: BgmVibe;
  label: string;
  file: string | null;
}> = [
  {
    value: 'epic',
    label: '🎻 Épico & Cinematográfico (10%)',
    file: 'bgm/music/epic.mp3',
  },
  {
    value: 'dark',
    label: '🌑 Sombrio & Mistério (10%)',
    file: 'bgm/music/dark.mp3',
  },
  {
    value: 'fun',
    label: '🎪 Divertido & Curioso (10%)',
    file: 'bgm/music/fun-light.mp3',
  },
  {
    value: 'hiphop',
    label: '⚡ Épico & Hip-Hop Beat (10%)',
    file: 'bgm/music/epic-hiphop.mp3',
  },
  {
    value: 'action',
    label: '⚔️ Ação & Corrida (10%)',
    file: 'bgm/music/action-run.mp3',
  },
  {
    value: 'piano',
    label: '🎹 Piano Rápido & Mistério (10%)',
    file: 'bgm/music/fast-piano.mp3',
  },
  {
    value: 'adventure',
    label: '🏔️ Aventura & Expedição (10%)',
    file: 'bgm/music/mountain-intro.mp3',
  },
  {
    value: 'comedy',
    label: '🎭 Comédia & Ironia (10%)',
    file: 'bgm/music/funny-vlog.mp3',
  },
  { value: 'none', label: '🔇 Sem Música de Fundo', file: null },
];

export const BRIEFING_BGM_OPTIONS: Array<{
  value: BriefingBgmOption;
  label: string;
}> = [
  {
    value: 'auto',
    label: '🤖 Decisão da IA (Recomendado por Ângulo)',
  },
  ...BGM_VIBE_OPTIONS.map((opt) => ({
    value: opt.value as BriefingBgmOption,
    label: opt.label,
  })),
];

export const SFX_OPTIONS: Array<{
  value: string;
  label: string;
  file: string | null;
}> = [
  {
    value: 'whoosh',
    label: '💨 Whoosh (Transição Padrão)',
    file: 'bgm/effects/whoosh.mp3',
  },
  {
    value: 'swoosh',
    label: '⚡ Swoosh (Corte Rápido)',
    file: 'bgm/effects/swoosh.wav',
  },
  {
    value: 'cannon-artillery',
    label: '💥 Tiro de Canhão / Artilharia',
    file: 'bgm/effects/cannon-artillery.wav',
  },
  {
    value: 'record-scratch',
    label: '🛑 Quebra de 4ª Parede (Scratch)',
    file: 'bgm/effects/record-scratch.wav',
  },
  {
    value: 'cartoon-blink',
    label: '👀 Efeito Cômico (Blink)',
    file: 'bgm/effects/cartoon-blink.mp3',
  },
  {
    value: 'riser-hit',
    label: '🔥 Gancho Tenso (Riser Hit)',
    file: 'bgm/effects/riser-hit.wav',
  },
  {
    value: 'heartbeat',
    label: '💓 Tensão Máxima (Heartbeat)',
    file: 'bgm/effects/heartbeat.wav',
  },
  {
    value: 'metal-hits',
    label: '🔨 Impacto de Metal / Bigorna',
    file: 'bgm/effects/metal-hits.mp3',
  },
  {
    value: 'sword-clash',
    label: '⚔️ Choque de Espadas',
    file: 'bgm/effects/sword-clash.wav',
  },
  {
    value: 'sword-draw',
    label: '🗡️ Desembainhar Lâmina',
    file: 'bgm/effects/sword-draw.wav',
  },
  {
    value: 'footsteps-stone',
    label: '👣 Passos em Pedra / Tumba',
    file: 'bgm/effects/footsteps-stone.wav',
  },
  {
    value: 'piano-flourish',
    label: '🎹 Floreio de Piano Dramático',
    file: 'bgm/effects/piano-flourish.wav',
  },
  {
    value: 'trex-roar',
    label: '🦖 Rugido de Criatura / T-Rex',
    file: 'bgm/effects/trex-roar.wav',
  },
  {
    value: 'trex-roar-fight',
    label: '🐲 Rugido Feroz de Batalha',
    file: 'bgm/effects/trex-roar-fight.wav',
  },
  {
    value: 'dog-bark',
    label: '🐶 Latido de Alerta',
    file: 'bgm/effects/dog-bark.wav',
  },
  { value: 'none', label: '🔇 Sem Efeito Sonoro', file: null },
];

export type AvatarHairStyle =
  | 'bald'
  | 'spiky'
  | 'curly'
  | 'mohawk'
  | 'pompadour';

export type AvatarAccessory =
  | 'none'
  | 'forehead_goggles'
  | 'round_glasses'
  | 'explorer_hat'
  | 'knight_helmet'
  | 'crown'
  | 'bandana';

export type AvatarNeckAccessory = 'none' | 'red_bandana';

export type AvatarAngle = 'front' | 'right' | 'back' | 'left';

export interface AvatarConfig {
  hairStyle: AvatarHairStyle;
  hairColor?: string;
  strokeColor: string;
  accessory: AvatarAccessory;
  neckAccessory?: AvatarNeckAccessory;
  angle: AvatarAngle;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  hairStyle: 'spiky',
  hairColor: '#EA580C',
  strokeColor: '#111827',
  accessory: 'forehead_goggles',
  neckAccessory: 'red_bandana',
  angle: 'front',
};

export const AVATAR_HAIR_PROMPT_MAP: Record<AvatarHairStyle, string> = {
  bald: 'smooth bald head with no hair',
  spiky: 'messy spiky 2D drawn hair with sharp distinct tufts',
  curly: 'voluminous curly 2D drawn hair',
  mohawk: 'bold punk mohawk 2D drawn hair',
  pompadour: 'stylish retro pompadour 2D drawn hair',
};

export const AVATAR_ACCESSORY_PROMPT_MAP: Record<AvatarAccessory, string> = {
  none: 'no headwear or goggles',
  forehead_goggles:
    'wearing retro aviator goggles with light cyan reflective lenses and brown leather strap resting on his forehead',
  round_glasses: 'wearing iconic round wireframe glasses',
  explorer_hat: 'wearing a classic weathered safari explorer hat',
  knight_helmet: 'wearing a medieval knight visor helmet on his round 2D head',
  crown: 'wearing a golden royal crown tilted on his 2D head',
  bandana: 'wearing a rugged adventurer bandana tied around his forehead',
};

export const AVATAR_NECK_ACCESSORY_PROMPT_MAP: Record<
  AvatarNeckAccessory,
  string
> = {
  none: '',
  red_bandana:
    'a vibrant red adventurer scarf bandana knotted around his neck with folded fabric and fluttering ends',
};

export const buildClientAvatarPromptDescriptor = (
  config: AvatarConfig = DEFAULT_AVATAR_CONFIG
): string => {
  const hair = AVATAR_HAIR_PROMPT_MAP[config.hairStyle || 'spiky'];
  const hairColor = config.hairColor || config.strokeColor || '#EA580C';
  const headAccessory =
    AVATAR_ACCESSORY_PROMPT_MAP[config.accessory || 'forehead_goggles'];
  const neckAccessory =
    AVATAR_NECK_ACCESSORY_PROMPT_MAP[config.neckAccessory || 'red_bandana'];
  const strokeColor = config.strokeColor || '#111827';
  const neckPhrase = neckAccessory ? `, ${neckAccessory}` : '';

  return `2D cartoon stickman protagonist with a smooth round white head, a distinct solid white capsule torso with smooth thickness outlined in clean ${strokeColor} ink (NOT a stick-line torso), thin stick-figure arms and legs, ${hair} in vibrant ${hairColor} color, ${headAccessory}${neckPhrase}`;
};

export const sanitizePromptArtifacts = (prompt: string): string => {
  if (!prompt) return '';
  // Remove repeticoes espurias herdadas de regex anteriores
  let cleaned = prompt.replace(
    /(?:,\s*and thin stick-figure limbs)?(?: with hands on hips outlined in #[0-9a-fA-F]{3,6} ink)+/gi,
    ''
  );
  cleaned = cleaned.replace(
    /(?:,\s*)?expressive winking facial expression with a confident cocky smirk/gi,
    ''
  );
  cleaned = cleaned.replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').trim();
  return cleaned;
};

export const injectAvatarConfigIntoPrompt = (
  rawPrompt: string,
  config: AvatarConfig
): string => {
  if (!rawPrompt) return '';
  const sanitized = sanitizePromptArtifacts(rawPrompt);
  const descriptor = buildClientAvatarPromptDescriptor(config);

  if (sanitized.includes(descriptor)) {
    return sanitized;
  }

  const genericPattern =
    /2D cartoon stickman (?:character|protagonist) with a smooth round white head.+?(?=,\s*(?:expressive|wearing|standing|climbing|running|peeking|pointing|falling|looking|facing|holding|integrated|all secondary))/i;

  if (genericPattern.test(sanitized)) {
    return sanitized.replace(genericPattern, descriptor);
  }

  if (/^Mixed media 2D\/3D illustration/i.test(sanitized)) {
    return sanitized.replace(
      /^Mixed media 2D\/3D illustration(?:,\s*a 2D cartoon stickman[^,]+)?/i,
      `Mixed media 2D/3D illustration, a ${descriptor}`
    );
  }

  return `Mixed media 2D/3D illustration, a ${descriptor}. ${sanitized}`;
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

export interface DialogueItem {
  id: string;
  speaker: SpeakerType;
  text: string;
}

export interface StoryboardScene {
  id?: string;
  speaker?: SpeakerType;
  text?: string;
  dialogues?: DialogueItem[];
  avatarSprite: AvatarSpritePath;
  visual_description?: string;
  imagePrompt: string;
  sfx_suggestion?: string;
  sfx_prompt?: string;
  custom_sfx_url?: string | null;
  candidateImages: string[];
  selectedImage: string | null;
}

export const getSceneDialogues = (
  scene: Partial<StoryboardScene> | null | undefined
): DialogueItem[] => {
  if (!scene) {
    return [{ id: 'd_default', speaker: 'protagonist', text: '' }];
  }
  if (scene.dialogues && scene.dialogues.length > 0) {
    return scene.dialogues;
  }
  return [
    {
      id: 'd_default',
      speaker: (scene.speaker as SpeakerType) || 'protagonist',
      text: scene.text || '',
    },
  ];
};

export const getSceneFullText = (
  scene: Partial<StoryboardScene> | null | undefined
): string => {
  const dials = getSceneDialogues(scene);
  return dials
    .map((d) => d.text.trim())
    .filter(Boolean)
    .join(' ');
};

export interface IdeationOption {
  id: string;
  title: string;
  badge?: string;
  description?: string;
  bgmVibe?: BgmVibe;
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
