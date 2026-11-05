import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.ts';
import { renderVideoSchema } from '../schemas/video.schema.ts';
import { renderTimeMachineVideoOnDisk } from '../services/remotion.service.ts';

/**
 * POST /api/render-video
 * 1. Valida o payload de entrada com Zod
 * 2. Cria o registo na base de dados via Prisma com status 'PENDING'
 * 3. Dispara em background o @remotion/bundler + @remotion/renderer para gerar o .mp4
 * 4. Atualiza o registo no Prisma para 'RENDERED' com o caminho/URL do vídeo (ou 'FAILED' em caso de erro)
 * 5. Responde imediatamente com 202 Accepted para o cliente acompanhar via polling
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
    // 1. Cria o registo inicial como PENDING no PostgreSQL
    const videoRecord = await prisma.video.create({
      data: {
        theme: inputData.theme,
        status: 'PENDING',
      },
    });

    // 2. Dispara a renderização em background sem bloquear a resposta HTTP
    void (async () => {
      try {
        console.log(
          `[Remotion] Iniciando renderização do vídeo ${videoRecord.id} (Tema: "${inputData.theme}")...`
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

    // 3. Retorna 202 Accepted imediatamente com o registo PENDING
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
 * Permite ao frontend fazer polling do status ('PENDING' -> 'RENDERED' | 'FAILED')
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

