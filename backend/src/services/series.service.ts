import { prisma } from '../lib/prisma.ts';
import type { SeriesContext } from '../schemas/video.schema.ts';

interface StoryboardSceneLike {
  speaker?: string;
  text?: string;
  visual_description?: string;
  dialogues?: Array<{
    speaker?: string;
    characterName?: string;
    text?: string;
  }>;
}

interface RemotionPropsLike {
  storyboard?: {
    scenes?: StoryboardSceneLike[];
    ideationOptions?: Array<{
      scenes?: StoryboardSceneLike[];
    }>;
  };
}

function extractVideoScenes(remotionProps: unknown): StoryboardSceneLike[] {
  const props = remotionProps as RemotionPropsLike | null | undefined;
  if (!props?.storyboard) return [];

  if (
    Array.isArray(props.storyboard.scenes) &&
    props.storyboard.scenes.length > 0
  ) {
    return props.storyboard.scenes;
  }

  const firstOptionScenes = props.storyboard.ideationOptions?.[0]?.scenes;
  if (Array.isArray(firstOptionScenes) && firstOptionScenes.length > 0) {
    return firstOptionScenes;
  }

  return [];
}

function formatSceneText(scene: StoryboardSceneLike): string {
  if (Array.isArray(scene.dialogues) && scene.dialogues.length > 0) {
    return scene.dialogues
      .map((d) => {
        const who = d.characterName
          ? `${d.speaker} (${d.characterName})`
          : d.speaker || 'protagonist';
        return `[${who}]: "${(d.text || '').trim()}"`;
      })
      .join(' | ');
  }
  return `[${scene.speaker || 'protagonist'}]: "${(scene.text || '').trim()}"`;
}

export interface SeriesSummaryItem {
  id: string;
  title: string;
  description: string | null;
  episodeCount: number;
  lastEpisodeNumber: number;
  nextEpisodeNumber: number;
  lastVideoTheme?: string;
  lastHookPreview?: string;
  updatedAt: string;
}

/**
 * Lista todas as séries existentes com contagem de episódios e prévia do último gancho.
 */
export async function listAllSeries(): Promise<SeriesSummaryItem[]> {
  const seriesList = await prisma.series.findMany({
    include: {
      videos: {
        orderBy: [{ episodeNumber: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          theme: true,
          episodeNumber: true,
          remotionProps: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return seriesList.map((s) => {
    const episodeCount = s.videos.length;
    const lastVideo = s.videos[s.videos.length - 1];
    const maxEp = s.videos.reduce(
      (acc, v, idx) => Math.max(acc, v.episodeNumber ?? idx + 1),
      0
    );

    const scenes = lastVideo ? extractVideoScenes(lastVideo.remotionProps) : [];
    const lastScene = scenes[scenes.length - 1];
    const lastHookRaw = lastScene ? formatSceneText(lastScene) : '';
    const lastHookPreview =
      lastHookRaw.length > 140
        ? `${lastHookRaw.slice(0, 137)}...`
        : lastHookRaw;

    return {
      id: s.id,
      title: s.title,
      description: s.description,
      episodeCount,
      lastEpisodeNumber: maxEp,
      nextEpisodeNumber: maxEp + 1,
      lastVideoTheme: lastVideo?.theme,
      lastHookPreview: lastHookPreview || undefined,
      updatedAt: s.updatedAt.toISOString(),
    };
  });
}

/**
 * Extrai o histórico completo (Ep 1 até N-1) de uma série para injeção direta no ScriptPromptBuilder.
 */
export async function getSeriesFullHistoryForPrompt(
  seriesId: string,
  excludeVideoId?: string
): Promise<{
  seriesTitle: string;
  episodeCount: number;
  formattedHistory: string;
} | null> {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: {
      videos: {
        orderBy: [{ episodeNumber: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          theme: true,
          episodeNumber: true,
          remotionProps: true,
        },
      },
    },
  });

  if (!series) return null;

  const previousVideos = series.videos.filter((v) => v.id !== excludeVideoId);
  if (previousVideos.length === 0) {
    return {
      seriesTitle: series.title,
      episodeCount: 0,
      formattedHistory: '',
    };
  }

  const formattedEpisodes = previousVideos.map((v, idx) => {
    const epNum = v.episodeNumber ?? idx + 1;
    const scenes = extractVideoScenes(v.remotionProps);
    const isLastPrevious = idx === previousVideos.length - 1;

    if (scenes.length === 0) {
      return `--- EPISÓDIO ${epNum}: "${v.theme}" ---\n(Roteiro detalhado ainda não consolidado; tema registrado: ${v.theme})`;
    }

    const lines = scenes.map((sc, sIdx) => {
      const visual = sc.visual_description
        ? ` {Cenário: ${sc.visual_description}}`
        : '';
      return `  Cena ${sIdx + 1}: ${formatSceneText(sc)}${visual}`;
    });

    const lastScene = scenes[scenes.length - 1];
    const cliffhangerNote =
      isLastPrevious && lastScene
        ? `\n  >>> PONTO EXATO ONDE O EPISÓDIO ${epNum} TERMINOU (CLIFFHANGER A CONTINUAR): ${formatSceneText(lastScene)}`
        : '';

    return `--- EPISÓDIO ${epNum}: "${v.theme}" ---\n${lines.join('\n')}${cliffhangerNote}`;
  });

  return {
    seriesTitle: series.title,
    episodeCount: previousVideos.length,
    formattedHistory: formattedEpisodes.join('\n\n'),
  };
}

/**
 * Cria (quando Nova Série) ou vincula (quando Continuação) um vídeo à tabela Series.
 */
export async function ensureSeriesLinkForVideo(params: {
  videoId: string;
  existingSeriesId?: string | null;
  theme: string;
  seriesContext?: SeriesContext;
}): Promise<{ seriesId: string; seriesTitle: string }> {
  const epNum = params.seriesContext?.episodeNumber || 1;
  const isContinuation = Boolean(
    params.seriesContext?.isContinuation && params.seriesContext?.seriesId
  );

  if (isContinuation && params.seriesContext?.seriesId) {
    const targetSeries = await prisma.series.findUnique({
      where: { id: params.seriesContext.seriesId },
    });
    if (!targetSeries) {
      throw new Error('Série selecionada para continuação não encontrada.');
    }

    await prisma.video.update({
      where: { id: params.videoId },
      data: {
        seriesId: targetSeries.id,
        episodeNumber: epNum,
      },
    });

    await prisma.series.update({
      where: { id: targetSeries.id },
      data: { updatedAt: new Date() },
    });

    return {
      seriesId: targetSeries.id,
      seriesTitle: targetSeries.title,
    };
  }

  // Modo Nova Série: se este vídeo já tinha uma série própria vinculada, reaproveita-a
  const desiredTitle =
    params.seriesContext?.seriesTitle?.trim() ||
    params.theme.trim().slice(0, 80) ||
    'Nova Série — Fragata Shorts';

  if (params.existingSeriesId) {
    const updatedSeries = await prisma.series.update({
      where: { id: params.existingSeriesId },
      data: { title: desiredTitle },
    });
    await prisma.video.update({
      where: { id: params.videoId },
      data: { episodeNumber: epNum },
    });
    return {
      seriesId: updatedSeries.id,
      seriesTitle: updatedSeries.title,
    };
  }

  const createdSeries = await prisma.series.create({
    data: {
      title: desiredTitle,
      description: params.seriesContext?.previousContext?.trim() || null,
    },
  });

  await prisma.video.update({
    where: { id: params.videoId },
    data: {
      seriesId: createdSeries.id,
      episodeNumber: epNum,
    },
  });

  return {
    seriesId: createdSeries.id,
    seriesTitle: createdSeries.title,
  };
}

