import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderVideoInput } from '../schemas/video.schema.ts';

const execFileAsync = promisify(execFile);

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

function getFfmpegBinaryPath(): string {
  const remotionDir = path.resolve(
    import.meta.dirname,
    '../../node_modules/@remotion'
  );
  if (fs.existsSync(remotionDir)) {
    const entries = fs.readdirSync(remotionDir);
    const compositorPkg = entries.find((e) => e.startsWith('compositor-'));
    if (compositorPkg) {
      const candidate = path.join(
        remotionDir,
        compositorPkg,
        process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return 'ffmpeg';
}

/**
 * Extrai o frame inicial do vídeo (Cena #0 / Thumbnail estilizada) e embute
 * no contêiner MP4 como imagem de capa oficial (stream de imagem com attached_pic).
 * Isso garante que Windows Explorer, reprodutores e galerias móveis exibam
 * a thumbnail estilizada como capa e ícone do arquivo sem perda de qualidade de vídeo.
 */
export async function attachThumbnailCoverToMp4(
  mp4Path: string
): Promise<void> {
  if (!fs.existsSync(mp4Path)) {
    return;
  }

  const ffmpeg = getFfmpegBinaryPath();
  const dir = path.dirname(mp4Path);
  const ext = path.extname(mp4Path);
  const baseName = path.basename(mp4Path, ext);
  const tempCoverPath = path.join(dir, `${baseName}.temp_cover.png`);
  const tempOutPath = path.join(dir, `${baseName}.temp_covered.mp4`);

  try {
    // 1. Extrai o frame em 0.1s (dentro do intervalo da Cena #0 de 0.5s)
    await execFileAsync(ffmpeg, [
      '-y',
      '-ss',
      '00:00:00.100',
      '-i',
      mp4Path,
      '-vframes',
      '1',
      tempCoverPath,
    ]);

    if (!fs.existsSync(tempCoverPath)) {
      console.warn(
        '[RemotionService] Falha ao extrair frame da thumbnail para capa'
      );
      return;
    }

    // 2. Embute a imagem como cover art (attached_pic) com cópia direta de fluxo (sem re-encoding)
    await execFileAsync(ffmpeg, [
      '-y',
      '-i',
      mp4Path,
      '-i',
      tempCoverPath,
      '-map',
      '0',
      '-map',
      '1',
      '-c',
      'copy',
      '-disposition:v:1',
      'attached_pic',
      tempOutPath,
    ]);

    if (fs.existsSync(tempOutPath)) {
      // Substitui atomicamente o MP4 original pelo MP4 com a capa embutida
      fs.copyFileSync(tempOutPath, mp4Path);
    }
  } catch (err) {
    console.warn(
      '[RemotionService] Aviso: Não foi possível embutir cover art no MP4:',
      err
    );
  } finally {
    try {
      if (fs.existsSync(tempCoverPath)) {
        fs.unlinkSync(tempCoverPath);
      }
      if (fs.existsSync(tempOutPath)) {
        fs.unlinkSync(tempOutPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

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

  // 5. Embute a thumbnail (Cena #0) como imagem de capa oficial (attached_pic) no arquivo .mp4 final
  await attachThumbnailCoverToMp4(outputFilePath);

  return {
    outputFilePath,
    publicVideoUrl: `/renders/${outputFileName}`,
  };
}
