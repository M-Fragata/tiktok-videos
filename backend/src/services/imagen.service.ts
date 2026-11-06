import fs from 'node:fs';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import type { ScriptScene } from './gemini.service.ts';

const MOCK_STORAGE_DIR = path.resolve(
  import.meta.dirname,
  '../../storage/teste'
);

/**
 * Gera uma imagem usando Pollinations.ai (FLUX) de forma 100% gratuita.
 * Não exige cartão de crédito nem configuração obrigatória de API key.
 */
async function generateImageWithPollinations(
  prompt: string,
  width: number,
  height: number,
  seed: number,
  apiKey?: string
): Promise<Buffer | null> {
  const cleanPrompt = encodeURIComponent(
    `${prompt}. Vertical 9:16 aspect ratio, cinematic historical setting, ultra-detailed background photography, 8k, authentic lighting, no text, no captions, no watermarks.`
  );
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, { headers });
    const contentType = response.headers.get('content-type') || '';

    if (response.ok && contentType.includes('image')) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const errText = await response.text();
    console.warn(
      `[Pollinations] Resposta não-imagem (${response.status}): ${errText.slice(0, 120)}`
    );
    return null;
  } catch (err: any) {
    console.warn(`[Pollinations] Erro na requisição: ${err.message}`);
    return null;
  }
}

/**
 * Gera 2 variações de imagem (B-Roll) em formato 9:16 para uma cena do Storyboard.
 *
 * Provedores configuráveis via IMAGE_PROVIDER no .env:
 * - 'pollinations' (padrão p/ desenvolvimento): FLUX gratuito via Pollinations.ai (zero custo).
 * - 'fal': FLUX.1 schnell/dev via Fal.ai (produção).
 *
 * Fallback gracioso: Se o provedor falhar ou esgotar cota, completa com imagens locais
 * para que o Studio tenha sempre 2 opções selecionáveis sem travar a interface.
 */
export async function generateSceneBrollImages(
  videoId: string,
  sceneIndex: number,
  imagePrompt: string,
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string[]> {
  const provider = (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase();
  const cacheBust = Date.now();
  fs.mkdirSync(storageVideoDir, { recursive: true });

  const savedUrls: string[] = [];

  // ========================================================
  // Provedor 1: Fal.ai (quando configurado expressamente como 'fal')
  // ========================================================
  if (provider === 'fal') {
    const falKey = process.env.FALL_AI_KEY || process.env.FAL_KEY;
    const imageModel = (process.env.IMAGE_MODEL || 'schnell').toLowerCase();
    const endpoint =
      imageModel === 'dev' ? 'fal-ai/flux/dev' : 'fal-ai/flux/schnell';

    if (falKey) {
      try {
        fal.config({ credentials: falKey });
        console.log(
          `[Fal.ai] Gerando 2 variações B-Roll para a cena #${sceneIndex + 1} com ${endpoint}...`
        );

        const result: any = await fal.subscribe(endpoint, {
          input: {
            prompt: `${imagePrompt}. Vertical 9:16 aspect ratio, cinematic historical setting, ultra-detailed background photography, authentic lighting, no text, no captions, no watermarks.`,
            image_size: 'portrait_16_9',
            num_images: 2,
            enable_safety_checker: true,
          },
          logs: false,
        });

        const images = result.data?.images;
        if (Array.isArray(images) && images.length > 0) {
          for (let optIdx = 0; optIdx < Math.min(2, images.length); optIdx++) {
            const imageUrl = images[optIdx]?.url;
            if (!imageUrl) continue;
            const res = await fetch(imageUrl);
            if (res.ok) {
              const fileName = `scene_${sceneIndex}_opt_${optIdx}.jpg`;
              const filePath = path.join(storageVideoDir, fileName);
              fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
              savedUrls.push(
                `${publicBaseUrl}/storage/${videoId}/${fileName}?v=${cacheBust}`
              );
            }
          }
        }
      } catch (err: any) {
        console.warn(
          `[Fal.ai] Erro ao gerar com Fal.ai (${err.message}). Recorrendo ao Pollinations...`
        );
      }
    }
  }

  // ========================================================
  // Provedor 2: Pollinations.ai (FLUX Gratuito de Desenvolvimento)
  // ========================================================
  if (savedUrls.length === 0) {
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;
    console.log(
      `[Pollinations] Gerando imagem FLUX real e gratuita para a cena #${sceneIndex + 1}...`
    );

    const seed0 = Math.floor(Math.random() * 9000000) + 1000000;
    const buf0 = await generateImageWithPollinations(
      imagePrompt,
      720,
      1280,
      seed0,
      pollinationsKey
    );

    if (buf0) {
      const fileName0 = `scene_${sceneIndex}_opt_0.jpg`;
      fs.writeFileSync(path.join(storageVideoDir, fileName0), buf0);
      savedUrls.push(
        `${publicBaseUrl}/storage/${videoId}/${fileName0}?v=${cacheBust}`
      );
      console.log(
        `[Pollinations] Imagem FLUX da cena #${sceneIndex + 1} salva com sucesso!`
      );
    }

    // Tenta gerar a 2ª variação (ou usa chave de Pollen se configurada)
    const seed1 = Math.floor(Math.random() * 9000000) + 1000000;
    const buf1 = await generateImageWithPollinations(
      imagePrompt,
      720,
      1280,
      seed1,
      pollinationsKey
    );

    if (buf1) {
      const fileName1 = `scene_${sceneIndex}_opt_1.jpg`;
      fs.writeFileSync(path.join(storageVideoDir, fileName1), buf1);
      savedUrls.push(
        `${publicBaseUrl}/storage/${videoId}/${fileName1}?v=${cacheBust}`
      );
    }
  }

  // ========================================================
  // Complemento de Fallback Gracioso (Garante sempre 2 miniaturas)
  // ========================================================
  for (let optIdx = savedUrls.length; optIdx < 2; optIdx++) {
    const fileName = `scene_${sceneIndex}_opt_${optIdx}.jpg`;
    const filePath = path.join(storageVideoDir, fileName);

    // Se já tiver gerado a opt_0 com sucesso, duplica com variação ou copia mock
    if (savedUrls.length > 0 && fs.existsSync(path.join(storageVideoDir, `scene_${sceneIndex}_opt_0.jpg`))) {
      fs.copyFileSync(
        path.join(storageVideoDir, `scene_${sceneIndex}_opt_0.jpg`),
        filePath
      );
    } else {
      const fallbackSource = path.join(
        MOCK_STORAGE_DIR,
        `scene_${(sceneIndex + optIdx) % 3}.jpg`
      );
      if (fs.existsSync(fallbackSource)) {
        fs.copyFileSync(fallbackSource, filePath);
      }
    }

    savedUrls.push(
      `${publicBaseUrl}/storage/${videoId}/${fileName}?v=${cacheBust}`
    );
  }

  return savedUrls;
}

/**
 * Geração simples de 1 imagem por cena (compatibilidade retroativa).
 */
export async function generateAllSceneBackgrounds(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string[]> {
  return Promise.all(
    scenes.map(async (scene, index) => {
      const urls = await generateSceneBrollImages(
        videoId,
        index,
        scene.imagePrompt,
        storageVideoDir,
        publicBaseUrl
      );
      return urls[0];
    })
  );
}
