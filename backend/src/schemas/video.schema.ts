import { z } from 'zod';

export const subtitleItemSchema = z
  .object({
    frameStart: z.number().int().min(0),
    frameEnd: z.number().int().max(450),
    text: z.string().min(1, 'O texto da legenda não pode estar vazio'),
  })
  .refine((data) => data.frameEnd > data.frameStart, {
    message: 'frameEnd deve ser maior que frameStart',
    path: ['frameEnd'],
  });

export const avatarSegmentSchema = z
  .object({
    startSecond: z.number().min(0),
    endSecond: z.number().max(15),
    image: z.string().min(1, 'A imagem do avatar é obrigatória'),
  })
  .refine((data) => data.endSecond > data.startSecond, {
    message: 'endSecond deve ser maior que startSecond',
    path: ['endSecond'],
  });

export const renderVideoSchema = z.object({
  theme: z
    .string({ required_error: 'O campo theme é obrigatório' })
    .min(3, 'O tema deve ter pelo menos 3 caracteres')
    .max(180, 'O tema deve ter no máximo 180 caracteres'),
  backgroundSrc: z.string().optional().default('background.jpg'),
  audioSrc: z.string().optional().default('audio.mp3'),
  subtitles: z.array(subtitleItemSchema).optional(),
  avatarTimeline: z.array(avatarSegmentSchema).optional(),
});

export type RenderVideoInput = z.infer<typeof renderVideoSchema>;

