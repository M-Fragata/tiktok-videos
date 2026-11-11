import { z } from 'zod';

export const subtitleWordTimingSchema = z.object({
  word: z.string().min(1),
  frameStart: z.number().int().min(0),
  frameEnd: z.number().int().min(1),
});

export const subtitleItemSchema = z
  .object({
    frameStart: z.number().int().min(0),
    frameEnd: z.number().int().min(1),
    text: z.string().min(1, 'O texto da legenda não pode estar vazio'),
    words: z.array(subtitleWordTimingSchema).optional(),
  })
  .refine((data) => data.frameEnd >= data.frameStart, {
    message: 'frameEnd deve ser maior ou igual a frameStart',
    path: ['frameEnd'],
  });

export const subtitleStyleSchema = z.object({
  animationType: z.enum(['karaoke', 'pop', 'hormozi']).optional().default('karaoke'),
  fontFamily: z
    .enum(['impact', 'grotesque', 'script', 'montserrat'])
    .optional()
    .default('impact'),
  fontSize: z.number().min(28).max(120).optional().default(64),
  primaryColor: z.string().optional().default('#FFFFFF'),
  highlightColor: z.string().optional().default('#FBBF24'),
  hasShadow: z.boolean().optional().default(true),
  hasStroke: z.boolean().optional().default(true),
  hasBackground: z.boolean().optional().default(false),
  positionX: z.number().min(5).max(95).optional().default(50),
  positionY: z.number().min(5).max(95).optional().default(88),
});

export const avatarSegmentSchema = z
  .object({
    startSecond: z.number().min(0),
    endSecond: z.number().positive(),
    image: z.string().min(1, 'A imagem do avatar é obrigatória'),
  })
  .refine((data) => data.endSecond > data.startSecond, {
    message: 'endSecond deve ser maior que startSecond',
    path: ['endSecond'],
  });

export const backgroundSegmentSchema = z
  .object({
    imageSrc: z
      .string()
      .min(1, 'O caminho/URL da imagem de cenário é obrigatório'),
    frameStart: z.number().int().min(0),
    frameEnd: z.number().int().min(1),
  })
  .refine((data) => data.frameEnd >= data.frameStart, {
    message: 'frameEnd deve ser maior ou igual a frameStart',
    path: ['frameEnd'],
  });

export const speakerTypeSchema = z.enum([
  'protagonist',
  'character',
  'narrator',
]);

export const durationPresetSchema = z.enum(['short', 'medium', 'long']);

export const bgmVibeSchema = z.enum([
  'auto',
  'epic',
  'dark',
  'fun',
  'hiphop',
  'action',
  'piano',
  'adventure',
  'comedy',
  'none',
]);

export const avatarHairStyleSchema = z.enum([
  'bald',
  'spiky',
  'curly',
  'mohawk',
  'pompadour',
]);

export const avatarAccessorySchema = z.enum([
  'none',
  'forehead_goggles',
  'round_glasses',
  'explorer_hat',
  'knight_helmet',
  'crown',
  'bandana',
]);

export const avatarNeckAccessorySchema = z.enum([
  'none',
  'red_bandana',
]);

export const avatarAngleSchema = z.enum(['front', 'right', 'back', 'left']);

export const avatarConfigSchema = z.object({
  hairStyle: avatarHairStyleSchema.optional().default('spiky'),
  hairColor: z.string().optional().default('#EA580C'),
  strokeColor: z.string().optional().default('#111827'),
  accessory: avatarAccessorySchema.optional().default('forehead_goggles'),
  neckAccessory: avatarNeckAccessorySchema.optional().default('red_bandana'),
  angle: avatarAngleSchema.optional().default('front'),
});

export const storyboardSceneSchema = z.object({
  speaker: speakerTypeSchema,
  text: z.string().min(1, 'O texto da fala não pode estar vazio'),
  avatarSprite: z.string().min(1, 'O sprite do avatar é obrigatório'),
  visual_description: z.string().optional().default(''),
  imagePrompt: z.string().min(1, 'O prompt de imagem é obrigatório'),
  sfx_suggestion: z.string().optional().default(''),
  sfx_prompt: z.string().optional().default(''),
  custom_sfx_url: z.string().nullable().optional().default(null),
  candidateImages: z.array(z.string()).optional().default([]),
  selectedImage: z.string().nullable().optional().default(null),
});

export const ideationOptionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  badge: z.string().optional(),
  description: z.string().optional(),
  bgmVibe: bgmVibeSchema.optional(),
  scenes: z.array(storyboardSceneSchema).default([]),
});

export const sceneFrameTimingSchema = z.object({
  sceneIndex: z.number().int().min(0),
  startSecond: z.number().min(0),
  endSecond: z.number().positive(),
  frameStart: z.number().int().min(0),
  frameEnd: z.number().int().min(1),
});

export const storyboardStateSchema = z.object({
  durationPreset: durationPresetSchema.optional().default('short'),
  scenes: z.array(storyboardSceneSchema).optional().default([]),
  audioGenerated: z.boolean().optional().default(false),
  isAssembled: z.boolean().optional().default(false),
  sceneTimings: z.array(sceneFrameTimingSchema).optional().default([]),
  avatarConfig: avatarConfigSchema.optional(),
  ideationOptions: z.array(ideationOptionSchema).optional(),
  bgmVibe: bgmVibeSchema.optional().default('epic'),
});

/**
 * Schema para criar rascunho inicial (POST /api/videos)
 */
export const createDraftVideoSchema = z.object({
  theme: z
    .string()
    .max(180)
    .optional()
    .default('Novo Vídeo — Fragata Shorts'),
});

/**
 * Etapa 1: Gerar Roteiro / Ideias (POST /api/videos/:id/generate-script)
 */
export const generateScriptSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(4000, 'O briefing deve ter no máximo 4000 caracteres'),
  durationPreset: durationPresetSchema.optional().default('short'),
  avatarConfig: avatarConfigSchema.optional(),
  bgmVibe: bgmVibeSchema.optional().default('epic'),
});

/**
 * Etapa 3A: Gerar 2 Imagens B-Roll por Cena (POST /api/videos/:id/generate-scene-images)
 */
export const generateSceneImagesSchema = z.object({
  sceneIndex: z.number().int().min(0),
  imagePrompt: z
    .string({ required_error: 'O imagePrompt é obrigatório' })
    .min(3, 'O prompt da cena deve ter pelo menos 3 caracteres'),
  scenes: z.array(storyboardSceneSchema).optional(),
});

/**
 * Geração de SFX Customizado com IA ElevenLabs (POST /api/videos/:id/generate-scene-sfx)
 */
export const generateSceneSfxSchema = z.object({
  sceneIndex: z.number().int().min(0),
  sfxPrompt: z
    .string({ required_error: 'O prompt do SFX é obrigatório' })
    .min(2, 'O prompt do SFX deve ter pelo menos 2 caracteres'),
  durationSeconds: z.number().min(0.5).max(22).optional(),
});

/**
 * Etapa 3B: Gravar Narração Multi-Voz Global (POST /api/videos/:id/generate-audio)
 */
export const generateAudioSchema = z.object({
  scenes: z
    .array(storyboardSceneSchema)
    .min(1, 'O roteiro deve conter pelo menos 1 cena'),
});

/**
 * Schema legado para POST /api/generate-video
 */
export const generateVideoSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(180, 'O tema deve ter no máximo 180 caracteres'),
});

/**
 * Schema para as inputProps do Remotion + estado de Storyboard persistido em remotionProps
 */
export const renderVideoSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(180, 'O tema deve ter no máximo 180 caracteres'),
  durationInFrames: z.number().int().min(30).max(5400).optional(),
  backgroundSrc: z.string().optional().default('background.jpg'),
  backgroundTimeline: z.array(backgroundSegmentSchema).optional(),
  audioSrc: z.string().optional().default('audio.mp3'),
  bgmVibe: bgmVibeSchema.optional().default('epic'),
  bgmVolume: z.number().min(0).max(1).optional().default(0.1),
  sfxEnabled: z.boolean().optional().default(true),
  subtitles: z.array(subtitleItemSchema).optional(),
  subtitleStyle: subtitleStyleSchema.optional(),
  avatarTimeline: z.array(avatarSegmentSchema).optional(),
  showAvatarOverlay: z.boolean().optional().default(false),
  storyboard: storyboardStateSchema.optional(),
});

export const uploadSceneImageSchema = z.object({
  sceneIndex: z.number().int().min(0),
  imageBase64: z.string().min(10, 'Imagem base64 inválida'),
  fileName: z.string().optional(),
});

export const updateVideoTitleSchema = z.object({
  theme: z
    .string({ required_error: 'O título é obrigatório' })
    .trim()
    .min(1, 'O título não pode estar vazio')
    .max(240, 'O título é demasiado longo'),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
export type RenderVideoInput = z.infer<typeof renderVideoSchema>;
export type StoryboardSceneInput = z.infer<typeof storyboardSceneSchema>;
export type StoryboardStateInput = z.infer<typeof storyboardStateSchema>;
