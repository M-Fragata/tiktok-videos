import path from 'node:path';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import {
  generateVideoSchema,
  renderVideoSchema,
  type RenderVideoInput,
} from '../schemas/video.schema.ts';
import {
  renderTimeMachineVideoOnDisk,
  STORAGE_OUTPUT_DIR,
} from '../services/remotion.service.ts';
import { generateTimeMachineScript } from '../services/gemini.service.ts';
import { generateNarrationWithTimestamps } from '../services/elevenlabs.service.ts';
import { generateAllSceneBackgrounds } from '../services/imagen.service.ts';

/**
 * Flag temporária de MOCK:
 * Enquanto true, POST /api/generate-video utiliza os ficheiros locais em backend/storage/teste/
 * (scene_0.jpg, scene_1.jpg, scene_2.jpg e audio.mp3) sem chamar Gemini, ElevenLabs ou Imagen.
 * Mude para false quando quiser usar as APIs reais.
 */
const USE_AI_MOCK = true;

function getPublicBaseUrl(): string {
  const port = Number(process.env.PORT) || 3333;
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(
    /\/+$/,
    ''
  );
}

/**
 * Objeto remotionProps fixo de MOCK apontando para backend/storage/teste/
 */
function buildMockRemotionProps(
  theme: string,
  publicBaseUrl: string
): RenderVideoInput {
  return {
    theme,
    durationInFrames: 450,
    backgroundSrc: `${publicBaseUrl}/storage/teste/scene_0.jpg`,
    backgroundTimeline: [
      {
        imageSrc: `${publicBaseUrl}/storage/teste/scene_0.jpg`,
        frameStart: 0,
        frameEnd: 149,
      },
      {
        imageSrc: `${publicBaseUrl}/storage/teste/scene_1.jpg`,
        frameStart: 150,
        frameEnd: 299,
      },
      {
        imageSrc: `${publicBaseUrl}/storage/teste/scene_2.jpg`,
        frameStart: 300,
        frameEnd: 450,
      },
    ],
    audioSrc: `${publicBaseUrl}/storage/teste/audio.mp3`,
    avatarTimeline: [
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
    ],
    subtitles: [
      {
        frameStart: 0,
        frameEnd: 49,
        text: 'Viajante! Aterrámos em Pompeia',
      },
      {
        frameStart: 50,
        frameEnd: 99,
        text: 'no ano 79 depois',
      },
      {
        frameStart: 100,
        frameEnd: 149,
        text: 'de Cristo! Olha só!',
      },
      {
        frameStart: 150,
        frameEnd: 199,
        text: 'Os romanos achavam que',
      },
      {
        frameStart: 200,
        frameEnd: 249,
        text: 'o Vesúvio era apenas',
      },
      {
        frameStart: 250,
        frameEnd: 299,
        text: 'uma montanha totalmente adormecida.',
      },
      {
        frameStart: 300,
        frameEnd: 349,
        text: 'Mas o chão tremeu!',
      },
      {
        frameStart: 350,
        frameEnd: 399,
        text: 'O vulcão acabou de',
      },
      {
        frameStart: 400,
        frameEnd: 450,
        text: 'explodir! Volta para a máquina!',
      },
    ],
  };
}

/**
 * POST /api/generate-video
 * Orquestra os 3 pilares de IA (ou usa o MOCK local em storage/teste/ quando USE_AI_MOCK = true).
 */
export async function generateVideoController(
  req: Request,
  res: Response
): Promise<void> {
  const parsedBody = generateVideoSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Dados de entrada inválidos',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { theme } = parsedBody.data;

  try {
    const videoRecord = await prisma.video.create({
      data: {
        theme,
        status: 'PENDING',
      },
    });

    void (async () => {
      try {
        const publicBaseUrl = getPublicBaseUrl();
        let remotionProps: RenderVideoInput;

        if (USE_AI_MOCK) {
          console.log(
            `[AI Pipeline - MOCK] Usando ficheiros locais de backend/storage/teste/ para o Job ${videoRecord.id}...`
          );
          remotionProps = buildMockRemotionProps(theme, publicBaseUrl);
        } else {
          const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, videoRecord.id);

          console.log(
            `[AI Pipeline] (1/4) Gerando roteiro estruturado no Gemini para "${theme}" (Job ${videoRecord.id})...`
          );
          const { scenes } = await generateTimeMachineScript(theme);

          console.log(
            `[AI Pipeline] (2/4) Executando Promise.all: ElevenLabs (/with-timestamps) + ${scenes.length} cenários no Imagen...`
          );
          const [narrationResult, sceneImageUrls] = await Promise.all([
            generateNarrationWithTimestamps(
              videoRecord.id,
              scenes,
              storageVideoDir,
              publicBaseUrl
            ),
            generateAllSceneBackgrounds(
              videoRecord.id,
              scenes,
              storageVideoDir,
              publicBaseUrl
            ),
          ]);

          const backgroundTimeline = narrationResult.sceneTimings.map(
            (timing, idx) => ({
              imageSrc: sceneImageUrls[idx] ?? 'background.jpg',
              frameStart: timing.frameStart,
              frameEnd: timing.frameEnd,
            })
          );

          remotionProps = {
            theme,
            durationInFrames: narrationResult.durationInFrames,
            backgroundSrc: sceneImageUrls[0] ?? 'background.jpg',
            backgroundTimeline,
            audioSrc: narrationResult.audioUrl,
            subtitles: narrationResult.subtitles,
            avatarTimeline: narrationResult.avatarTimeline,
          };
        }

        console.log(
          `[AI Pipeline] Salvando remotionProps no PostgreSQL (${remotionProps.durationInFrames} frames)...`
        );
        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            remotionProps,
          },
        });

        console.log(
          `[AI Pipeline] Renderizando MP4 com @remotion/renderer para o Job ${videoRecord.id}...`
        );
        const { outputFilePath, publicVideoUrl } =
          await renderTimeMachineVideoOnDisk(videoRecord.id, remotionProps);

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'RENDERED',
            videoUrl: publicVideoUrl,
          },
        });

        console.log(
          `[AI Pipeline] Vídeo ${videoRecord.id} concluído com sucesso em: ${outputFilePath}`
        );
      } catch (pipelineError) {
        console.error(
          `[AI Pipeline] Erro ao processar vídeo ${videoRecord.id}:`,
          pipelineError
        );

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'FAILED',
          },
        });
      }
    })();

    res.status(202).json({
      message:
        'Pipeline iniciada em background. Consulte GET /api/videos/:id para acompanhar o status.',
      video: videoRecord,
    });
  } catch (dbError) {
    console.error('[Prisma] Erro ao criar registo para geração:', dbError);
    res.status(500).json({
      error: 'Erro interno ao criar o registo do vídeo na base de dados.',
    });
  }
}

/**
 * POST /api/videos/:id/rerender
 * Recebe as remotionProps editadas no @remotion/player do front-end,
 * atualiza o JSON no Prisma e re-renderiza o .mp4 usando os assets já retidos em /storage/ (sem custo de IA).
 */
export async function rerenderVideoController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = renderVideoSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Propriedades remotionProps inválidas para re-renderização',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const updatedProps = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });

    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const updatedRecord = await prisma.video.update({
      where: { id },
      data: {
        theme: updatedProps.theme,
        status: 'PENDING',
        remotionProps: updatedProps,
      },
    });

    void (async () => {
      try {
        console.log(
          `[Remotion] Re-renderizando vídeo ${id} sem custo de IA...`
        );

        const { outputFilePath, publicVideoUrl } =
          await renderTimeMachineVideoOnDisk(id, updatedProps);

        await prisma.video.update({
          where: { id },
          data: {
            status: 'RENDERED',
            videoUrl: publicVideoUrl,
          },
        });

        console.log(
          `[Remotion] Re-renderização do vídeo ${id} concluída em: ${outputFilePath}`
        );
      } catch (renderError) {
        console.error(
          `[Remotion] Falha ao re-renderizar o vídeo ${id}:`,
          renderError
        );

        await prisma.video.update({
          where: { id },
          data: {
            status: 'FAILED',
          },
        });
      }
    })();

    res.status(202).json({
      message:
        'Re-renderização iniciada em background. Consulte GET /api/videos/:id para acompanhar o status.',
      video: updatedRecord,
    });
  } catch (dbError) {
    console.error('[Prisma] Erro ao iniciar re-renderização:', dbError);
    res.status(500).json({
      error: 'Erro interno ao atualizar o vídeo para re-renderização.',
    });
  }
}

/**
 * POST /api/render-video
 * Renderização direta a partir de remotionProps enviadas manualmente.
 */
export async function renderVideoController(
  req: Request,
  res: Response
): Promise<void> {
  const parsedBody = renderVideoSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Dados de entrada inválidos',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const inputData = parsedBody.data;

  try {
    const videoRecord = await prisma.video.create({
      data: {
        theme: inputData.theme,
        status: 'PENDING',
        remotionProps: inputData,
      },
    });

    void (async () => {
      try {
        console.log(
          `[Remotion] Iniciando renderização manual do vídeo ${videoRecord.id} (Tema: "${inputData.theme}")...`
        );

        const { outputFilePath, publicVideoUrl } =
          await renderTimeMachineVideoOnDisk(videoRecord.id, inputData);

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'RENDERED',
            videoUrl: publicVideoUrl,
          },
        });

        console.log(
          `[Remotion] Vídeo ${videoRecord.id} renderizado com sucesso em: ${outputFilePath}`
        );
      } catch (renderError) {
        console.error(
          `[Remotion] Falha ao renderizar o vídeo ${videoRecord.id}:`,
          renderError
        );

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'FAILED',
          },
        });
      }
    })();

    res.status(202).json({
      message:
        'Renderização iniciada em background. Consulte GET /api/videos/:id para acompanhar o status.',
      video: videoRecord,
    });
  } catch (dbError) {
    console.error('[Prisma] Erro ao registar pedido de vídeo:', dbError);
    res.status(500).json({
      error: 'Erro interno ao criar o registo do vídeo na base de dados.',
    });
  }
}

/**
 * GET /api/videos/:id
 * Permite ao frontend fazer polling do status ('PENDING' -> 'RENDERED' | 'FAILED') e obter remotionProps
 */
export async function getVideoByIdController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    res.status(200).json(video);
  } catch (error) {
    console.error('[Prisma] Erro ao buscar vídeo:', error);
    res.status(500).json({ error: 'Erro interno ao consultar o vídeo.' });
  }
}

/**
 * GET /api/videos
 * Lista o histórico de vídeos gerados
 */
export async function listVideosController(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(videos);
  } catch (error) {
    console.error('[Prisma] Erro ao listar vídeos:', error);
    res.status(500).json({ error: 'Erro interno ao listar os vídeos.' });
  }
}
