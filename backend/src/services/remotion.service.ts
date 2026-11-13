import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderVideoInput } from '../schemas/video.schema.ts';

const FRONTEND_DIR = path.resolve(import.meta.dirname, '../../../frontend');
const REMOTION_ENTRY_POINT = path.join(FRONTEND_DIR, 'src/remotion/index.ts');
const REMOTION_PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');

export const RENDERS_OUTPUT_DIR = path.resolve(
  import.meta.dirname,
  '../../renders'
);
export const STORAGE_OUTPUT_DIR = path.resolve(
  import.meta.dirname,
  '../../storage'
);

export interface RenderResult {
  outputFilePath: string;
  publicVideoUrl: string;
}

function getInternalBaseUrl(): string {
  const port = Number(process.env.PORT) || 3333;
  return (process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${port}`).replace(
    /\/+$/,
    ''
  );
}

/**
 * Normaliza recursivamente quaisquer URLs de assets relativas (/storage/...) ou localhost
 * para apontarem diretamente para o servidor Express local (http://127.0.0.1:3333),
 * impedindo que o Chromium do Remotion tente buscá-las dentro da pasta temporária do Webpack bundle.
 */
function normalizeInputPropsAssets<T>(obj: T, baseUrl: string): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('/storage/')) {
      return `${baseUrl}${obj}` as unknown as T;
    }
    if (obj.startsWith('http://localhost:3333/storage/')) {
      return obj.replace('http://localhost:3333', baseUrl) as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      normalizeInputPropsAssets(item, baseUrl)
    ) as unknown as T;
  }
  if (typeof obj === 'object') {
    const res: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      res[key] = normalizeInputPropsAssets(value, baseUrl);
    }
    return res as unknown as T;
  }
  return obj;
}

export type RenderProgressCallback = (progressInfo: {
  renderedFrames: number;
  encodedFrames: number;
  progress: number;
}) => void;

/**
 * Empacota a composição Remotion (TimeMachineVideo) do frontend e renderiza o ficheiro .mp4 no disco.
 * Respeita o durationInFrames dinâmico calculado a partir da narração da ElevenLabs.
 */
export async function renderTimeMachineVideoOnDisk(
  videoId: string,
  inputProps: RenderVideoInput,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  if (!fs.existsSync(RENDERS_OUTPUT_DIR)) {
    fs.mkdirSync(RENDERS_OUTPUT_DIR, { recursive: true });
  }

  const outputFileName = `${videoId}.mp4`;
  const outputFilePath = path.join(RENDERS_OUTPUT_DIR, outputFileName);

  const internalBaseUrl = getInternalBaseUrl();
  const normalizedInputProps = normalizeInputPropsAssets(
    inputProps,
    internalBaseUrl
  );

  // 1. Cria o bundle Webpack da composição Remotion apontando para frontend/src/remotion/index.ts
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY_POINT,
    publicDir: REMOTION_PUBLIC_DIR,
  });

  // 2. Seleciona a composição TimeMachineVideo injetando as inputProps
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TimeMachineVideo',
    inputProps: normalizedInputProps,
  });

  // 3. Aplica a duração dinâmica calculada no backend (durationInFrames = Math.ceil((ultimoTimestampSegundos + 0.5) * 30))
  if (
    normalizedInputProps.durationInFrames &&
    normalizedInputProps.durationInFrames > 0
  ) {
    composition.durationInFrames = normalizedInputProps.durationInFrames;
  }

  // 4. Renderiza o vídeo em formato MP4 (H.264) no disco
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputFilePath,
    inputProps: normalizedInputProps,
    onProgress: (p) => {
      if (onProgress) {
        onProgress(p);
      }
    },
  });

  return {
    outputFilePath,
    publicVideoUrl: `/renders/${outputFileName}`,
  };
}
