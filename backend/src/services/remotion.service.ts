import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderVideoInput } from '../schemas/video.schema.ts';

const FRONTEND_DIR = path.resolve(import.meta.dirname, '../../../frontend');
const REMOTION_ENTRY_POINT = path.join(FRONTEND_DIR, 'src/remotion/index.ts');
const REMOTION_PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
export const RENDERS_OUTPUT_DIR = path.resolve(import.meta.dirname, '../../renders');

export interface RenderResult {
  outputFilePath: string;
  publicVideoUrl: string;
}

/**
 * Empacota a composição Remotion (TimeMachineVideo) do frontend e renderiza o ficheiro .mp4 no disco.
 */
export async function renderTimeMachineVideoOnDisk(
  videoId: string,
  inputProps: RenderVideoInput
): Promise<RenderResult> {
  if (!fs.existsSync(RENDERS_OUTPUT_DIR)) {
    fs.mkdirSync(RENDERS_OUTPUT_DIR, { recursive: true });
  }

  const outputFileName = `${videoId}.mp4`;
  const outputFilePath = path.join(RENDERS_OUTPUT_DIR, outputFileName);

  // 1. Cria o bundle Webpack da composição Remotion apontando para frontend/src/remotion/index.ts
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY_POINT,
    publicDir: REMOTION_PUBLIC_DIR,
  });

  // 2. Seleciona a composição TimeMachineVideo injetando as inputProps validadas pelo Zod
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TimeMachineVideo',
    inputProps,
  });

  // 3. Renderiza o vídeo em formato MP4 (H.264) no disco
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputFilePath,
    inputProps,
  });

  return {
    outputFilePath,
    publicVideoUrl: `/renders/${outputFileName}`,
  };
}

