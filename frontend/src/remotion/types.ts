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

export type AvatarSpritePath = (typeof AVAILABLE_AVATAR_SPRITES)[number] | string;

export interface SubtitleItem {
  frameStart: number;
  frameEnd: number;
  text: string;
}

export interface AvatarSegment {
  startSecond: number;
  endSecond: number;
  image: AvatarSpritePath;
}

export type TimeMachineVideoProps = {
  theme: string;
  backgroundSrc?: string;
  audioSrc?: string;
  subtitles?: SubtitleItem[];
  avatarTimeline?: AvatarSegment[];
};

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

export const defaultTimeMachineProps: TimeMachineVideoProps = {
  theme: 'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  backgroundSrc: 'background.jpg',
  audioSrc: 'audio.mp3',
  subtitles: DEFAULT_SUBTITLES,
  avatarTimeline: DEFAULT_AVATAR_TIMELINE,
};

/**
 * Resolve o caminho de um asset: se for URL externa (http/https), retorna diretamente;
 * caso contrário, utiliza staticFile() do Remotion apontando para frontend/public/.
 */
export const resolveAssetSrc = (src: string): string => {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  const normalizedPath = src.replace(/^\/+/, '');
  return staticFile(normalizedPath);
};
