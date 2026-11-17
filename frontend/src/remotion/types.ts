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

export type EpisodeFormat = 'single' | 'series';
export type ProtagonistAgency = 'chaos_agent' | 'observer';
export type ContentBalance = 'balanced' | 'comedy_action' | 'historical_focus';

export interface SeriesContext {
  isContinuation?: boolean;
  seriesId?: string;
  seriesTitle?: string;
  episodeNumber: number;
  previousContext?: string;
}

export interface SeriesSummary {
  id: string;
  title: string;
  description?: string | null;
  episodeCount: number;
  lastEpisodeNumber: number;
  nextEpisodeNumber: number;
  lastVideoTheme?: string;
  lastHookPreview?: string;
  updatedAt: string;
}

export const EPISODE_FORMAT_OPTIONS: Array<{
  value: EpisodeFormat;
  label: string;
  description: string;
}> = [
  {
    value: 'single',
    label: '🎬 Único',
    description: 'Arco fechado e completo com mistério revelado',
  },
  {
    value: 'series',
    label: '📺 Série',
    description: 'Arco episódico com gancho de suspense para o próximo capítulo',
  },
];

export const PROTAGONIST_AGENCY_OPTIONS: Array<{
  value: ProtagonistAgency;
  label: string;
  description: string;
}> = [
  {
    value: 'chaos_agent',
    label: '💥 Caos',
    description: 'Billy toca em tudo, provoca desastres e interage diretamente',
  },
  {
    value: 'observer',
    label: '👁️ Observador',
    description: 'Billy reage à margem, comenta com ironia sem intervir fisicamente',
  },
];

export const CONTENT_BALANCE_OPTIONS: Array<{
  value: ContentBalance;
  label: string;
  description: string;
}> = [
  {
    value: 'balanced',
    label: '⚖️ Equilibrado',
    description: '50% história pelo Narrador, 50% gags e reações do Billy',
  },
  {
    value: 'comedy_action',
    label: '🤣 Comédia',
    description: 'Mais gags visuais, tropeços e efeitos sonoros expressivos',
  },
  {
    value: 'historical_focus',
    label: '🏛️ Histórico',
    description: 'Mais fatos reais e datas aprofundadas com humor pontual',
  },
];

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
    label: '🤖 IA (Recomendado)',
  },
  ...BGM_VIBE_OPTIONS.map((opt) => ({
    value: opt.value as BriefingBgmOption,
    label: opt.label,
  })),
];

export interface SfxOption {
  value: string;
  label: string;
  file: string | null;
  prompt?: string;
  isCustom?: boolean;
}

export const SFX_OPTIONS: SfxOption[] = [
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
  sceneIndex?: number;
  speaker?: 'protagonist' | 'character' | 'narrator';
  characterGender?: 'male' | 'female';
}

export type SubtitleAnimationType = 'karaoke' | 'pop' | 'hormozi';

export type SubtitleFontFamily =
  | 'impact'
  | 'grotesque'
  | 'script'
  
  | 'montserrat';

export type SpeakerStyleKey =
  | 'protagonist'
  | 'narrator'
  | 'character_male'
  | 'character_female';

export interface SpeakerStylePair {
  primaryColor: string;
  highlightColor: string;
}

export type SpeakerStylesConfig = Record<SpeakerStyleKey, SpeakerStylePair>;

export const DEFAULT_SPEAKER_STYLES: SpeakerStylesConfig = {
  protagonist: {
    primaryColor: '#FFFFFF',
    highlightColor: '#EF4444', // Vermelho
  },
  narrator: {
    primaryColor: '#FFFFFF',
    highlightColor: '#FBBF24', // Amarelo
  },
  character_male: {
    primaryColor: '#FFFFFF',
    highlightColor: '#38BDF8', // Azul
  },
  character_female: {
    primaryColor: '#FFFFFF',
    highlightColor: '#F472B6', // Rosa
  },
};

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
  speakerStyles?: SpeakerStylesConfig;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleConfig = {
  animationType: 'karaoke',
  fontFamily: 'montserrat',
  fontSize: 54,
  primaryColor: '#FFFFFF',
  highlightColor: '#EF4444',
  hasShadow: true,
  hasStroke: true,
  hasBackground: false,
  positionX: 50,
  positionY: 92,
  speakerStyles: DEFAULT_SPEAKER_STYLES,
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
  characterName?: string;
  voiceId?: string;
  text: string;
}

export interface VoiceDefinition {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age?: string;
  style?: string;
  description: string;
  preview_url?: string;
}

export interface VoiceCatalog {
  narrator: VoiceDefinition;
  protagonist: VoiceDefinition;
  characters: VoiceDefinition[];
}

export interface SfxItem {
  slot?: 'action' | 'ambient';
  label?: string;
  sound_prompt: string;
  match_score: number;
  start_time_sec: number;
  duration_sec: number;
  suggested_volume: number;
  sfx_key?: string;
  audio_url?: string | null;
  playback_rate?: number;
  original_duration_sec?: number;
}

export interface StoryboardScene {
  id?: string;
  speaker?: SpeakerType;
  text?: string;
  dialogues?: DialogueItem[];
  avatarSprite: AvatarSpritePath;
  visual_description?: string;
  imagePrompt: string;
  sfx_list?: SfxItem[];
  sfx_action?: SfxItem | null;
  sfx_ambient?: SfxItem | null;
  sfx_suggestion?: string;
  sfx_prompt?: string;
  sfx_label?: string;
  custom_sfx_url?: string | null;
  candidateImages: string[];
  selectedImage: string | null;
}

export const getSceneActionSfx = (
  scene: Partial<StoryboardScene> | null | undefined
): SfxItem | null => {
  if (!scene) return null;
  if (scene.sfx_action) {
    return { ...scene.sfx_action, slot: 'action' };
  }
  if (Array.isArray(scene.sfx_list) && scene.sfx_list.length > 0) {
    const found = scene.sfx_list.find((s) => s.slot === 'action');
    if (found) return found;
    return scene.sfx_list[0];
  }
  const key = scene.sfx_suggestion?.trim();
  const hasAudioUrl = Boolean(scene.custom_sfx_url);
  if (hasAudioUrl || (key && key !== 'none') || scene.sfx_prompt) {
    return {
      slot: 'action',
      label: scene.sfx_label || undefined,
      sound_prompt:
        scene.sfx_prompt || scene.sfx_label || key || 'Efeito de ação',
      match_score: 90,
      start_time_sec: 0,
      duration_sec: 1.5,
      suggested_volume: 0.8,
      sfx_key: key && key !== 'none' ? key : undefined,
      audio_url: scene.custom_sfx_url || null,
    };
  }
  return null;
};

export const getSceneAmbientSfx = (
  scene: Partial<StoryboardScene> | null | undefined
): SfxItem | null => {
  if (!scene) return null;
  if (scene.sfx_ambient) {
    return { ...scene.sfx_ambient, slot: 'ambient' };
  }
  if (Array.isArray(scene.sfx_list) && scene.sfx_list.length > 1) {
    const found = scene.sfx_list.find((s) => s.slot === 'ambient');
    if (found) return found;
    return scene.sfx_list[1];
  }
  return null;
};

export const getSceneSfxList = (
  scene: Partial<StoryboardScene> | null | undefined
): SfxItem[] => {
  if (!scene) return [];
  const action = getSceneActionSfx(scene);
  const ambient = getSceneAmbientSfx(scene);
  const items: SfxItem[] = [];
  if (action && (action.sound_prompt?.trim() || action.audio_url || action.sfx_key)) {
    items.push(action);
  }
  if (ambient && (ambient.sound_prompt?.trim() || ambient.audio_url || ambient.sfx_key)) {
    items.push(ambient);
  }
  if (items.length > 0) return items;

  if (Array.isArray(scene.sfx_list) && scene.sfx_list.length > 0) {
    return scene.sfx_list;
  }
  return [];
};

export const resolveSfxAudioUrl = (sfx: SfxItem): string | null => {
  if (sfx.audio_url) {
    return resolveAssetSrc(sfx.audio_url);
  }
  if (sfx.sfx_key && sfx.sfx_key !== 'none') {
    const matched = SFX_OPTIONS.find((opt) => opt.value === sfx.sfx_key);
    if (matched?.file) {
      return resolveAssetSrc(matched.file);
    }
    return resolveAssetSrc(`bgm/effects/${sfx.sfx_key}.mp3`);
  }
  return null;
};

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

export const KNOWN_FEMALE_VOICE_IDS = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'EXAVITQu4vr4xnSDxMaL', // Bella / Sarah
  'AZnzlk1XvdvUeBnXmlld', // Domi
  'MF3mGyEYCl7XYWbV9V6O', // Elli
  'cgSgspJ2msm6clMCkdW9', // Jessica
  'hpp4J3VqNfWAUOO0d1Us', // Bella
  'Xb7hH8MSUJpSbSDYk0k2', // Alice
]);

function normalizeSubtitleTextForMatching(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export function resolveSpeakerForSubtitle(
  sub: Partial<SubtitleItem>,
  scene?: Partial<StoryboardScene> | null
): { speaker: SpeakerType; characterGender?: 'male' | 'female' } {
  // 1. Se já possui speaker definido no próprio bloco, preserva
  if (sub.speaker) {
    const isFemale = sub.characterGender === 'female';
    return {
      speaker: sub.speaker,
      ...(sub.speaker === 'character' ? { characterGender: isFemale ? 'female' : 'male' } : {}),
    };
  }

  // 2. Se não temos a cena, fallback seguro para protagonista
  if (!scene) {
    return { speaker: 'protagonist' };
  }

  const dialogues = getSceneDialogues(scene);
  if (dialogues.length === 1) {
    const d = dialogues[0];
    const spk = (d.speaker as SpeakerType) || (scene.speaker as SpeakerType) || 'protagonist';
    const isFemale = Boolean(d.voiceId && KNOWN_FEMALE_VOICE_IDS.has(d.voiceId));
    return {
      speaker: spk,
      ...(spk === 'character' ? { characterGender: isFemale ? 'female' : 'male' } : {}),
    };
  }

  // 3. Múltiplos diálogos: encontra o melhor diálogo que corresponde ao texto do bloco
  const textNorm = normalizeSubtitleTextForMatching(sub.text || '');
  const subWords = textNorm.split(/\s+/).filter(Boolean);

  let bestScore = -1;
  let bestDialogue = dialogues[0];

  dialogues.forEach((d) => {
    const dNorm = normalizeSubtitleTextForMatching(d.text || '');
    const dWordsSet = new Set(dNorm.split(/\s+/).filter(Boolean));

    let score: number;

    if (dNorm.includes(textNorm) && textNorm.length > 0) {
      score = 200 + textNorm.length;
      if (dNorm.startsWith(textNorm)) {
        score += 50;
      }
    } else {
      let matches = 0;
      subWords.forEach((bw) => {
        if (dWordsSet.has(bw)) matches++;
      });
      const ratio = subWords.length > 0 ? matches / subWords.length : 0;
      score = matches * 10 + ratio * 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDialogue = d;
    }
  });

  const spk = (bestDialogue.speaker as SpeakerType) || (scene.speaker as SpeakerType) || 'protagonist';
  const isFemale = Boolean(bestDialogue.voiceId && KNOWN_FEMALE_VOICE_IDS.has(bestDialogue.voiceId));
  return {
    speaker: spk,
    ...(spk === 'character' ? { characterGender: isFemale ? 'female' : 'male' } : {}),
  };
}

export type NarrativeArchitecture =
  | 'in_media_res'
  | 'myth_buster'
  | 'witness_pov'
  | 'ticking_clock';

export type BridgeSpeaker = 'protagonist' | 'narrator';

export interface NarrativePlan {
  architecture_id: NarrativeArchitecture;
  hook_type?: string;
  core_revelation?: string;
  bridge_speaker?: BridgeSpeaker;
  bridge_full_sentence?: string;
  loop_closing_fragment?: string;
  loop_opening_fragment?: string;
}

export interface ThumbnailTextConfig {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  position?: 'top' | 'center' | 'bottom' | 'custom';
  xPercent?: number; // 0 a 100% (padrão 50)
  yPercent?: number; // 0 a 100% (padrão 50)
}

export const AVAILABLE_THUMBNAIL_FONTS = [
  { id: 'Komika Axis', label: 'Komika Axis (Estilo HQ / Padrão)', family: '"Komika Axis", Impact, sans-serif', weight: 'normal' },
  { id: 'The Bold Font', label: 'The Bold Font (Impactante)', family: '"The Bold Font", Impact, sans-serif', weight: 'bold' },
  { id: 'Impact', label: 'Impact (Clássico Memes / Shorts)', family: 'Impact, sans-serif', weight: 'normal' },
  { id: 'Montserrat', label: 'Montserrat 900 (Moderno)', family: '"Montserrat", sans-serif', weight: '900' },
  { id: 'Anton', label: 'Anton (Vertical Condensado)', family: '"Anton", sans-serif', weight: 'normal' },
  { id: 'Bebas Neue', label: 'Bebas Neue (Cinematográfico)', family: '"Bebas Neue", sans-serif', weight: 'normal' },
  { id: 'Russo One', label: 'Russo One (Gamer / Épico)', family: '"Russo One", sans-serif', weight: 'normal' },
  { id: 'Luckiest Guy', label: 'Luckiest Guy (Cartoon Divertido)', family: '"Luckiest Guy", cursive', weight: 'normal' },
];

export interface ThumbnailConfig {
  prompt?: string;
  titleHook?: string;
  selectedImage?: string | null;
  candidateImages?: string[];
  textConfig?: ThumbnailTextConfig;
}

export interface IdeationOption {
  id: NarrativeArchitecture | string;
  title: string;
  badge?: string;
  description?: string;
  bgmVibe?: BgmVibe;
  thumbnail_prompt?: string;
  thumbnail_title_hook?: string;
  narrative_plan?: NarrativePlan;
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
  thumbnailConfig?: ThumbnailConfig;
  episodeFormat?: EpisodeFormat;
  seriesContext?: SeriesContext;
  protagonistAgency?: ProtagonistAgency;
  contentBalance?: ContentBalance;
  narrative_plan?: NarrativePlan;
  description?: string;
}

export type TimeMachineVideoProps = {
  theme: string;
  title?: string;
  durationInFrames?: number;
  backgroundSrc?: string;
  backgroundTimeline?: BackgroundSegment[];
  audioSrc?: string;
  bgmVibe?: BgmVibe;
  bgmVolume?: number;
  sfxEnabled?: boolean;
  globalSfxMultiplier?: number;
  autoDucking?: boolean;
  subtitles?: SubtitleItem[];
  subtitleStyle?: SubtitleStyleConfig;
  avatarTimeline?: AvatarSegment[];
  showAvatarOverlay?: boolean;
  storyboard?: StoryboardState;
  thumbnailUrl?: string | null;
  thumbnailConfig?: ThumbnailConfig;
};

export interface VideoRecord {
  id: string;
  theme: string;
  status: 'DRAFT' | 'PENDING' | 'RENDERED' | 'FAILED' | string;
  videoUrl: string | null;
  remotionProps?: TimeMachineVideoProps | null;
  renderProgress?: number | null;
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
  sfxEnabled: true,
  globalSfxMultiplier: 1.0,
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
    const existingWords = item.words;
    const isMatching = existingWords.every(
      (w, idx) =>
        normalizeSubtitleTextForMatching(w.word) ===
        normalizeSubtitleTextForMatching(rawWords[idx])
    );
    const boundsMatch =
      existingWords[0]?.frameStart === item.frameStart &&
      existingWords[existingWords.length - 1]?.frameEnd === item.frameEnd;

    if (isMatching) {
      if (boundsMatch) {
        return existingWords;
      }
      // Preserva os timestamps acústicos reais da ElevenLabs ajustando com precisão as bordas do bloco
      return existingWords.map((w, idx) => ({
        ...w,
        frameStart: idx === 0 ? item.frameStart : Math.max(item.frameStart, w.frameStart),
        frameEnd: idx === existingWords.length - 1 ? item.frameEnd : Math.min(item.frameEnd, w.frameEnd),
      }));
    }
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

export const WEAK_END_WORDS = new Set([
  // Preposições & Contrações
  'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'a', 'ao', 'aos', 'à', 'às',
  'com', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'para', 'pra', 'pro', 'pras', 'pros',
  'sem', 'sob', 'sobre', 'até', 'contra', 'desde', 'entre',
  'dum', 'duma', 'duns', 'dumas', 'num', 'numa', 'nuns', 'numas',
  // Conjunções & Conectivos
  'que', 'e', 'mas', 'ou', 'se', 'porque', 'pois', 'como', 'quando', 'enquanto',
  // Artigos & Demonstrativos / Possessivos
  'o', 'os', 'um', 'uma', 'uns', 'umas',
  'meu', 'minha', 'meus', 'minhas',
  'seu', 'sua', 'seus', 'suas',
  'nosso', 'nossa', 'nossos', 'nossas',
  'este', 'esta', 'estes', 'estas',
  'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas'
]);

export function isTerminalPunctuation(word: string): boolean {
  return /[.!?…;:]+$/.test(word.trim());
}

export function isClausePausePunctuation(word: string): boolean {
  return /[,–—]+$/.test(word.trim());
}

export function isWeakEndingWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return WEAK_END_WORDS.has(clean);
}

function getItemWordText<T extends string | { word: string }>(item: T): string {
  return typeof item === 'string' ? item : item.word;
}

export function splitClauseIntoSemanticChunks<T extends string | { word: string }>(words: T[]): T[][] {
  const N = words.length;
  if (N === 0) return [];
  if (N <= 5) return [words];

  // Se tem 6 palavras, divide em 3 + 3 caso a palavra divisora não seja fraca
  if (N === 6) {
    const wordAt2 = getItemWordText(words[2]);
    if (!isWeakEndingWord(wordAt2)) {
      return [words.slice(0, 3), words.slice(3)];
    }
    return [words];
  }

  const k = Math.max(2, Math.round(N / 4.2));

  if (k === 2) {
    let bestSplit = Math.round(N / 2);
    let bestScore = -Infinity;

    for (let split = 3; split <= N - 3; split++) {
      let score = 0;
      const leftLen = split;
      const rightLen = N - split;

      const diff = Math.abs(leftLen - rightLen);
      score -= diff * 1.5;

      if (leftLen > 5) score -= (leftLen - 5) * 1.0;
      if (rightLen > 5) score -= (rightLen - 5) * 1.0;

      const lastLeftWord = getItemWordText(words[split - 1]);
      if (isWeakEndingWord(lastLeftWord)) {
        score -= 5.0;
      }

      const nextWord = getItemWordText(words[split]);
      if (isWeakEndingWord(nextWord)) {
        score += 2.0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSplit = split;
      }
    }

    return [words.slice(0, bestSplit), words.slice(bestSplit)];
  }

  // k >= 3:
  let bestFirstSize = Math.round(N / k);
  let bestFirstScore = -Infinity;

  for (let size = 3; size <= Math.min(5, N - (k - 1) * 3); size++) {
    let score = 0;
    const remaining = N - size;
    const remainingTarget = (k - 1) * 4;
    score -= Math.abs(remaining - remainingTarget) * 1.2;

    const endWord = getItemWordText(words[size - 1]);
    if (isWeakEndingWord(endWord)) score -= 5.0;

    const nextWord = getItemWordText(words[size]);
    if (isWeakEndingWord(nextWord)) score += 2.0;

    if (score > bestFirstScore) {
      bestFirstScore = score;
      bestFirstSize = size;
    }
  }

  const firstChunk = words.slice(0, bestFirstSize);
  const remainingChunks = splitClauseIntoSemanticChunks(words.slice(bestFirstSize));
  return [firstChunk, ...remainingChunks];
}

export function splitWordsSemantically<T extends string | { word: string }>(words: T[]): T[][] {
  if (!words || words.length === 0) return [];

  const sentences: T[][] = [];
  let currentSentence: T[] = [];

  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    const text = getItemWordText(item);
    currentSentence.push(item);
    if (isTerminalPunctuation(text) || i === words.length - 1) {
      sentences.push(currentSentence);
      currentSentence = [];
    }
  }

  const chunks: T[][] = [];

  for (const sentence of sentences) {
    if (sentence.length === 0) continue;

    if (sentence.length <= 5) {
      chunks.push(sentence);
      continue;
    }

    const pauseIndices: number[] = [];
    for (let i = 0; i < sentence.length - 1; i++) {
      if (isClausePausePunctuation(getItemWordText(sentence[i]))) {
        pauseIndices.push(i);
      }
    }

    let chosenPause = -1;
    for (const pIdx of pauseIndices) {
      const leftLen = pIdx + 1;
      const rightLen = sentence.length - leftLen;
      if (leftLen >= 3 && rightLen >= 3) {
        chosenPause = pIdx;
        break;
      }
    }

    if (chosenPause !== -1) {
      const leftClause = sentence.slice(0, chosenPause + 1);
      const rightClause = sentence.slice(chosenPause + 1);
      chunks.push(...splitClauseIntoSemanticChunks(leftClause));
      chunks.push(...splitClauseIntoSemanticChunks(rightClause));
    } else {
      chunks.push(...splitClauseIntoSemanticChunks(sentence));
    }
  }

  return chunks;
}

/**
 * Divide uma fala longa (ex: texto bruto de uma cena no modo DRAFT antes de gravar áudio)
 * em blocos semânticos e equilibrados (3 a 5 palavras por tela, respeitando pontuações e pausas),
 * já com os tempos simulados por palavra para o efeito Karaokê / Pop / Hormozi.
 */
export const splitSceneTextIntoSubtitleChunks = (
  text: string,
  frameStart: number,
  frameEnd: number,
  _wordsPerChunk = 4
): SubtitleItem[] => {
  const cleanWords = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleanWords.length === 0) {
    return [];
  }

  const chunks = splitWordsSemantically(cleanWords);
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
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src;
  }
  if (src.startsWith('/storage/')) {
    const isViteDev =
      typeof window !== 'undefined' &&
      window.location &&
      window.location.port === '5173';
    return isViteDev ? src : `http://127.0.0.1:3333${src}`;
  }
  const normalizedPath = src.replace(/^\/+/, '');
  return staticFile(normalizedPath);
};
