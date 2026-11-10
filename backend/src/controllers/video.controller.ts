import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import {
  createDraftVideoSchema,
  generateAudioSchema,
  generateSceneImagesSchema,
  generateScriptSchema,
  generateVideoSchema,
  renderVideoSchema,
  updateVideoTitleSchema,
  uploadSceneImageSchema,
  type RenderVideoInput,
} from '../schemas/video.schema.ts';
import {
  renderTimeMachineVideoOnDisk,
  RENDERS_OUTPUT_DIR,
  STORAGE_OUTPUT_DIR,
} from '../services/remotion.service.ts';
import {
  generateTimeMachineIdeation,
  generateTimeMachineScript,
  type ScriptScene,
} from '../services/gemini.service.ts';
import { generateNarrationWithTimestamps } from '../services/elevenlabs.service.ts';
import {
  generateAllSceneBackgrounds,
  generateSceneBrollImages,
} from '../services/imagen.service.ts';

function getPublicBaseUrl(): string {
  const port = Number(process.env.PORT) || 3333;
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(
    /\/+$/,
    ''
  );
}

/**
 * POST /api/videos
 * Cria um novo vídeo em rascunho (status: 'DRAFT', remotionProps: null)
 * para abrir diretamente na Etapa 1 (Briefing) do Studio.tsx sem gastar créditos de IA.
 */
export async function createDraftVideoController(
  req: Request,
  res: Response
): Promise<void> {
  const parsedBody = createDraftVideoSchema.safeParse(req.body || {});
  const theme = parsedBody.success
    ? parsedBody.data.theme
    : 'Novo Vídeo — Fragata Shorts';

  try {
    const video = await prisma.video.create({
      data: {
        theme,
        status: 'DRAFT',
      },
    });

    res.status(201).json({ video });
  } catch (error) {
    console.error('[Prisma] Erro ao criar rascunho de vídeo:', error);
    res
      .status(500)
      .json({ error: 'Erro interno ao criar rascunho de vídeo.' });
  }
}

/**
 * Etapa 1 (Ideação Mix & Match):
 * POST /api/videos/:id/generate-script
 * Chama o Google Gemini com o tema, duração e avatarConfig,
 * devolvendo 4 opções de roteiro com ângulos distintos (Humor, Ação, Sombrio, Caótico)
 * para o utilizador misturar no "Roteiro Final" e aprovar.
 */
export async function generateScriptController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = generateScriptSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Dados de Briefing inválidos',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { theme, durationPreset, avatarConfig, bgmVibe } = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    console.log(
      `[Ideação - Etapa 1] Gerando 4 opções de roteiro no Gemini para "${theme}" (${durationPreset})...`
    );
    const { options } = await generateTimeMachineIdeation(
      theme,
      durationPreset,
      avatarConfig
    );

    const formattedOptions = options.map((opt) => ({
      id: opt.id,
      title: opt.title,
      badge: opt.badge,
      description: opt.description,
      bgmVibe: opt.bgmVibe || 'epic',
      scenes: opt.scenes.map((scene) => ({
        speaker: scene.speaker,
        text: scene.text,
        avatarSprite: scene.avatarSprite,
        imagePrompt: scene.imagePrompt,
        sfx_suggestion: scene.sfx_suggestion || '',
        candidateImages: [] as string[],
        selectedImage: null as string | null,
      })),
    }));

    const resolvedBgm =
      bgmVibe && bgmVibe !== 'auto'
        ? bgmVibe
        : formattedOptions[0]?.bgmVibe || currentProps.bgmVibe || 'epic';

    const currentProps = (existingVideo.remotionProps || {}) as RenderVideoInput;
    const currentStoryboard = currentProps.storyboard || {
      durationPreset,
      scenes: [],
      audioGenerated: false,
      isAssembled: false,
      sceneTimings: [],
    };

    const remotionProps: RenderVideoInput = {
      ...currentProps,
      theme,
      durationInFrames:
        currentProps.durationInFrames ||
        (durationPreset === 'long'
          ? 1800
          : durationPreset === 'medium'
            ? 900
            : 450),
      backgroundSrc: currentProps.backgroundSrc || 'background.jpg',
      backgroundTimeline: currentProps.backgroundTimeline || [],
      audioSrc: currentProps.audioSrc || 'audio.mp3',
      bgmVibe: resolvedBgm,
      subtitles: currentProps.subtitles || [],
      avatarTimeline: currentProps.avatarTimeline || [],
      storyboard: {
        ...currentStoryboard,
        durationPreset,
        avatarConfig,
        ideationOptions: formattedOptions,
        bgmVibe: resolvedBgm,
      },
    };

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        theme,
        status: 'DRAFT',
        remotionProps,
      },
    });

    res.status(200).json({
      message: '4 opções de roteiro geradas com sucesso.',
      options: formattedOptions,
      scenes: formattedOptions[0]?.scenes || [],
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Storyboard] Erro ao gerar opções de roteiro:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao gerar ideias de roteiro com IA.',
    });
  }
}

/**
 * Etapa 3A (Por Cena):
 * POST /api/videos/:id/generate-scene-images
 * Recebe o sceneIndex e o imagePrompt (editável pelo utilizador),
 * gera 2 variações de imagem 9:16 (B-Roll) no Fal.ai FLUX.1 e devolve o array com 2 URLs.
 */
export async function generateSceneImagesController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = generateSceneImagesSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Parâmetros inválidos para geração de imagens da cena',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { sceneIndex, imagePrompt, scenes: clientScenes } = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const publicBaseUrl = getPublicBaseUrl();
    const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, id);

    const candidateUrls = await generateSceneBrollImages(
      id,
      sceneIndex,
      imagePrompt,
      storageVideoDir,
      publicBaseUrl
    );

    const currentProps = (existingVideo.remotionProps || {}) as RenderVideoInput;
    const currentStoryboard = currentProps.storyboard || {
      durationPreset: 'short' as const,
      scenes: [],
      audioGenerated: false,
      isAssembled: false,
      sceneTimings: [],
    };

    const baseScenes =
      clientScenes && clientScenes.length > 0
        ? clientScenes
        : currentStoryboard.scenes;

    const updatedScenes = baseScenes.map((scene, idx) => {
      if (idx !== sceneIndex) return scene;
      return {
        ...scene,
        imagePrompt,
        candidateImages: candidateUrls,
        selectedImage: scene.selectedImage || candidateUrls[0] || null,
      };
    });

    const updatedProps: RenderVideoInput = {
      ...currentProps,
      theme: existingVideo.theme,
      storyboard: {
        ...currentStoryboard,
        scenes: updatedScenes,
      },
    };

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: 'DRAFT',
        remotionProps: updatedProps,
      },
    });

    res.status(200).json({
      message: `2 variações B-Roll geradas para a cena #${sceneIndex + 1}.`,
      sceneIndex,
      images: candidateUrls,
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Storyboard] Erro ao gerar imagens B-Roll da cena:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao gerar imagens para a cena.',
    });
  }
}

/**
 * Etapa 3B (Global):
 * POST /api/videos/:id/generate-audio
 * Recebe o script editado (cenas com texto, speaker e avatarSprite),
 * chama a ElevenLabs Multi-Voz (/with-timestamps) e concatena o audio.mp3 com FFmpeg.
 */
export async function generateAudioController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = generateAudioSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Cenas inválidas para gravação da narração',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { scenes } = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const publicBaseUrl = getPublicBaseUrl();
    const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, id);

    const scriptScenesForTts: ScriptScene[] = scenes.map((s) => ({
      speaker: s.speaker,
      text: s.text,
      avatarSprite: s.avatarSprite as ScriptScene['avatarSprite'],
      imagePrompt: s.imagePrompt,
      sfx_suggestion: s.sfx_suggestion,
    }));

    const narrationResult = await generateNarrationWithTimestamps(
      id,
      scriptScenesForTts,
      storageVideoDir,
      publicBaseUrl
    );

    const cacheBustedAudioUrl = `${narrationResult.audioUrl}?v=${Date.now()}`;
    const currentProps = (existingVideo.remotionProps || {}) as RenderVideoInput;
    const currentStoryboard = currentProps.storyboard || {
      durationPreset: 'short' as const,
      scenes: [],
      audioGenerated: false,
      isAssembled: false,
      sceneTimings: [],
    };

    const updatedProps: RenderVideoInput = {
      ...currentProps,
      theme: existingVideo.theme,
      durationInFrames: narrationResult.durationInFrames,
      audioSrc: cacheBustedAudioUrl,
      subtitles: narrationResult.subtitles,
      avatarTimeline: narrationResult.avatarTimeline,
      storyboard: {
        ...currentStoryboard,
        scenes,
        audioGenerated: true,
        sceneTimings: narrationResult.sceneTimings,
      },
    };

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: 'DRAFT',
        remotionProps: updatedProps,
      },
    });

    res.status(200).json({
      message: 'Narração multi-voz gravada e sincronizada com sucesso.',
      narration: {
        ...narrationResult,
        audioUrl: cacheBustedAudioUrl,
      },
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Storyboard] Erro ao gerar narração multi-voz:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao gravar narração na ElevenLabs.',
    });
  }
}

/**
 * PUT /api/videos/:id/storyboard
 * Salva o estado montado do Storyboard (ex: ao clicar em "🎬 Montar Vídeo" ou selecionar imagens B-Roll)
 * sem disparar a renderização pesada de MP4 no servidor.
 */
export async function saveStoryboardController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = renderVideoSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Dados de Storyboard inválidos',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        theme: parsedBody.data.theme,
        status: 'DRAFT',
        remotionProps: parsedBody.data,
      },
    });

    res.status(200).json({
      message: 'Storyboard atualizado com sucesso.',
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Prisma] Erro ao salvar estado do Storyboard:', error);
    res.status(500).json({
      error: 'Erro interno ao salvar estado do Storyboard.',
    });
  }
}

/**
 * Rota legada POST /api/generate-video (mantida para compatibilidade)
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
        const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, videoRecord.id);

        const { scenes } = await generateTimeMachineScript(theme, 'short');
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

        const remotionProps: RenderVideoInput = {
          theme,
          durationInFrames: narrationResult.durationInFrames,
          backgroundSrc: sceneImageUrls[0] ?? 'background.jpg',
          backgroundTimeline,
          audioSrc: narrationResult.audioUrl,
          subtitles: narrationResult.subtitles,
          avatarTimeline: narrationResult.avatarTimeline,
        };

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: { remotionProps },
        });

        const { publicVideoUrl } = await renderTimeMachineVideoOnDisk(
          videoRecord.id,
          remotionProps
        );

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'RENDERED',
            videoUrl: publicVideoUrl,
          },
        });
      } catch (pipelineError) {
        console.error(
          `[AI Pipeline] Erro ao processar vídeo ${videoRecord.id}:`,
          pipelineError
        );
        await prisma.video.update({
          where: { id: videoRecord.id },
          data: { status: 'FAILED' },
        });
      }
    })();

    res.status(202).json({
      message: 'Pipeline iniciada em background.',
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
 * Recebe as remotionProps montadas no Studio, atualiza o JSON no Prisma
 * e renderiza o .mp4 final em background usando @remotion/renderer.
 */
export async function rerenderVideoController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = renderVideoSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Propriedades remotionProps inválidas para renderização',
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
          `[Remotion] Renderizando MP4 final do vídeo ${id} no servidor...`
        );

        const { outputFilePath, publicVideoUrl } =
          await renderTimeMachineVideoOnDisk(id, updatedProps);

        const versionedVideoUrl = `${publicVideoUrl}?v=${Date.now()}`;

        await prisma.video.update({
          where: { id },
          data: {
            status: 'RENDERED',
            videoUrl: versionedVideoUrl,
          },
        });

        console.log(
          `[Remotion] Renderização do vídeo ${id} concluída em: ${outputFilePath}`
        );
      } catch (renderError) {
        console.error(
          `[Remotion] Falha ao renderizar o vídeo ${id}:`,
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
        'Renderização iniciada em background. Consulte GET /api/videos/:id para acompanhar o status.',
      video: updatedRecord,
    });
  } catch (dbError) {
    console.error('[Prisma] Erro ao iniciar renderização:', dbError);
    res.status(500).json({
      error: 'Erro interno ao atualizar o vídeo para renderização.',
    });
  }
}

/**
 * POST /api/render-video
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
        const { publicVideoUrl } = await renderTimeMachineVideoOnDisk(
          videoRecord.id,
          inputData
        );

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: {
            status: 'RENDERED',
            videoUrl: publicVideoUrl,
          },
        });
      } catch (renderError) {
        console.error(
          `[Remotion] Falha ao renderizar o vídeo ${videoRecord.id}:`,
          renderError
        );

        await prisma.video.update({
          where: { id: videoRecord.id },
          data: { status: 'FAILED' },
        });
      }
    })();

    res.status(202).json({
      message: 'Renderização iniciada em background.',
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

/**
 * POST /api/videos/:id/upload-scene-image
 * Permite adicionar manualmente uma imagem a uma cena do Storyboard.
 */
export async function uploadSceneImageController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = uploadSceneImageSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Parâmetros inválidos para envio de imagem manual',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { sceneIndex, imageBase64, fileName } = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, id);
    fs.mkdirSync(storageVideoDir, { recursive: true });

    // Extrai extensão ou padrão png
    let ext = 'png';
    const matchExt = fileName?.match(/\.(jpe?g|png|webp|avif)$/i);
    if (matchExt) {
      ext = matchExt[1].toLowerCase().replace('jpeg', 'jpg');
    }

    // Remove prefixo data:image/xxx;base64, se presente
    const base64Data = imageBase64.replace(/^data:image\/[a-z0-9-+.]+;base64,/i, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const outputFileName = `manual_scene_${sceneIndex}_${Date.now()}.${ext}`;
    const outputFilePath = path.join(storageVideoDir, outputFileName);
    fs.writeFileSync(outputFilePath, buffer);

    const publicBaseUrl = getPublicBaseUrl();
    const cacheBust = Date.now();
    const publicImageUrl = `${publicBaseUrl}/storage/${id}/${outputFileName}?v=${cacheBust}`;

    // Atualiza o remotionProps com a nova imagem na lista de candidatos e selecionada
    const currentProps = (existingVideo.remotionProps || {}) as RenderVideoInput;
    const currentStoryboard = currentProps.storyboard || {
      durationPreset: 'short' as const,
      scenes: [],
      audioGenerated: false,
      isAssembled: false,
      sceneTimings: [],
    };

    const baseScenes = currentStoryboard.scenes || [];
    const updatedScenes = baseScenes.map((scene, idx) => {
      if (idx !== sceneIndex) return scene;
      const candidates = scene.candidateImages || [];
      return {
        ...scene,
        candidateImages: [publicImageUrl, ...candidates.filter((u) => u !== publicImageUrl)],
        selectedImage: publicImageUrl,
      };
    });

    const updatedBackgroundTimeline = (currentProps.backgroundTimeline || []).map(
      (seg, idx) => {
        if (idx !== sceneIndex) return seg;
        return {
          ...seg,
          imageSrc: publicImageUrl,
        };
      }
    );

    const updatedProps: RenderVideoInput = {
      ...currentProps,
      theme: existingVideo.theme,
      backgroundSrc:
        sceneIndex === 0 ? publicImageUrl : currentProps.backgroundSrc || publicImageUrl,
      backgroundTimeline: updatedBackgroundTimeline,
      storyboard: {
        ...currentStoryboard,
        scenes: updatedScenes,
      },
    };

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        status: 'DRAFT',
        remotionProps: updatedProps,
      },
    });

    res.status(200).json({
      message: `Imagem manual adicionada com sucesso à cena #${sceneIndex + 1}.`,
      sceneIndex,
      imageUrl: publicImageUrl,
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Upload] Erro ao salvar imagem manual da cena:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao salvar a imagem enviada manualmente.',
    });
  }
}

/**
 * PATCH /api/videos/:id/title
 * Atualiza apenas o título (theme) do vídeo sem invalidar o status RENDERED ou o MP4 existente.
 */
export async function updateVideoTitleController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const parsedBody = updateVideoTitleSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      error: 'Título inválido',
      details: parsedBody.error.flatten().fieldErrors,
    });
    return;
  }

  const { theme } = parsedBody.data;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    const currentProps = existingVideo.remotionProps as RenderVideoInput | null;
    const updatedProps = currentProps
      ? {
          ...currentProps,
          theme,
        }
      : undefined;

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: {
        theme,
        ...(updatedProps ? { remotionProps: updatedProps } : {}),
      },
    });

    res.status(200).json({
      message: 'Título atualizado com sucesso.',
      video: updatedVideo,
    });
  } catch (error) {
    console.error('[Prisma] Erro ao atualizar título do vídeo:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar o título.' });
  }
}

/**
 * DELETE /api/videos/:id
 * Exclui o registo do vídeo na base de dados e apaga os arquivos correspondentes em storage/ e renders/.
 */
export async function deleteVideoController(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const existingVideo = await prisma.video.findUnique({ where: { id } });
    if (!existingVideo) {
      res.status(404).json({ error: 'Vídeo não encontrado.' });
      return;
    }

    await prisma.video.delete({ where: { id } });

    // Remove pasta de assets do vídeo em storage/:id
    const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, id);
    if (fs.existsSync(storageVideoDir)) {
      fs.rmSync(storageVideoDir, { recursive: true, force: true });
    }

    // Remove arquivo MP4 renderizado em renders/:id.mp4
    const renderedMp4Path = path.join(RENDERS_OUTPUT_DIR, `${id}.mp4`);
    if (fs.existsSync(renderedMp4Path)) {
      fs.rmSync(renderedMp4Path, { force: true });
    }

    res.status(200).json({
      message: 'Vídeo e arquivos excluídos com sucesso.',
    });
  } catch (error) {
    console.error('[Prisma] Erro ao excluir vídeo:', error);
    res.status(500).json({ error: 'Erro interno ao excluir o vídeo.' });
  }
}
