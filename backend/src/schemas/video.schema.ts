import { z } from 'zod';

export const subtitleItemSchema = z
  .object({
    frameStart: z.number().int().min(0),
    frameEnd: z.number().int().min(1),
    text: z.string().min(1, 'O texto da legenda não pode estar vazio'),
  })
  .refine((data) => data.frameEnd >= data.frameStart, {
    message: 'frameEnd deve ser maior ou igual a frameStart',
    path: ['frameEnd'],
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

export const storyboardSceneSchema = z.object({
  speaker: speakerTypeSchema,
  text: z.string().min(1, 'O texto da fala não pode estar vazio'),
  avatarSprite: z.string().min(1, 'O sprite do avatar é obrigatório'),
  imagePrompt: z.string().min(1, 'O prompt de imagem é obrigatório'),
  sfx_suggestion: z.string().optional().default(''),
  candidateImages: z.array(z.string()).optional().default([]),
  selectedImage: z.string().nullable().optional().default(null),
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
});

/**
 * Schema para criar rascunho inicial (POST /api/videos)
 */
export const createDraftVideoSchema = z.object({
  theme: z
    .string()
    .max(180)
    .optional()
    .default('Novo Vídeo — Máquina do Tempo'),
});

/**
 * Etapa 1: Gerar Roteiro (POST /api/videos/:id/generate-script)
 */
export const generateScriptSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(180, 'O tema deve ter no máximo 180 caracteres'),
  durationPreset: durationPresetSchema.optional().default('short'),
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
  subtitles: z.array(subtitleItemSchema).optional(),
  avatarTimeline: z.array(avatarSegmentSchema).optional(),
  storyboard: storyboardStateSchema.optional(),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
export type RenderVideoInput = z.infer<typeof renderVideoSchema>;
export type StoryboardSceneInput = z.infer<typeof storyboardSceneSchema>;
export type StoryboardStateInput = z.infer<typeof storyboardStateSchema>;
