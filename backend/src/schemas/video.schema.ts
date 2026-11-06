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
    imageSrc: z.string().min(1, 'O caminho/URL da imagem de cenário é obrigatório'),
    frameStart: z.number().int().min(0),
    frameEnd: z.number().int().min(1),
  })
  .refine((data) => data.frameEnd >= data.frameStart, {
    message: 'frameEnd deve ser maior ou igual a frameStart',
    path: ['frameEnd'],
  });

/**
 * Schema para a rota POST /api/generate-video (pipeline de IA completa)
 */
export const generateVideoSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(180, 'O tema deve ter no máximo 180 caracteres'),
});

/**
 * Schema para as inputProps do Remotion (usado em POST /api/videos/:id/rerender e POST /api/render-video)
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
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
export type RenderVideoInput = z.infer<typeof renderVideoSchema>;
