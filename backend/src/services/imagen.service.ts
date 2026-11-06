import fs from 'node:fs';
import path from 'node:path';
import { fal } from '@fal-ai/client';
import type { ScriptScene } from './gemini.service.ts';

const MOCK_STORAGE_DIR = path.resolve(import.meta.dirname, '../../storage/teste');

/**
 * Pilar 3 (O Diretor de Arte - FLUX.1 via Fal.ai):
 * Gera imagens de cenário 9:16 ultra-realistas com corte seco para cada cena.
 *
 * Configuração:
 * - IMAGE_MODEL: 'schnell' (desenvolvimento / rápido 4 steps, ~$0.003) ou 'dev' (produção / alta fidelidade, ~$0.025)
 * - Credenciais: FALL_AI_KEY ou FAL_KEY no formato "<key_id>:<key_secret>"
 *
 * Fallback gracioso: Se a chave falhar, cota esgotar ou formato estiver incompleto,
 * utiliza os cenários locais pré-renderizados para não interromper a produção do vídeo.
 */
async function generateSingleSceneImage(
  imagePrompt: string,
  sceneIndex: number,
  videoId: string,
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string> {
  const falKey = process.env.FALL_AI_KEY || process.env.FAL_KEY;
  const imageModel = (process.env.IMAGE_MODEL || 'schnell').toLowerCase();
  const endpoint = imageModel === 'dev' ? 'fal-ai/flux/dev' : 'fal-ai/flux/schnell';

  fs.mkdirSync(storageVideoDir, { recursive: true });
  const fileName = `scene_${sceneIndex}.jpg`;
  const filePath = path.join(storageVideoDir, fileName);

  if (falKey) {
    try {
      fal.config({ credentials: falKey });

      console.log(
        `[Fal.ai] Gerando imagem da cena #${sceneIndex + 1} com ${endpoint}...`
      );

      const result: any = await fal.subscribe(endpoint, {
        input: {
          prompt: `${imagePrompt}. Vertical 9:16 aspect ratio, cinematic historical setting, ultra-detailed photography, authentic lighting, highly aesthetic, masterwork, no text, no captions, no watermarks.`,
          image_size: 'portrait_16_9',
          num_images: 1,
          enable_safety_checker: true,
        },
        logs: false,
      });

      const imageUrl = result.data?.images?.[0]?.url;
      if (imageUrl) {
        const response = await fetch(imageUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          console.log(`[Fal.ai] Cenário #${sceneIndex + 1} gerado com sucesso.`);
          return `${publicBaseUrl}/storage/${videoId}/${fileName}`;
        }
      }
    } catch (err: any) {
      console.warn(
        `[Fal.ai] Erro ao gerar imagem para cena #${sceneIndex + 1} (${err.message || err}). Aplicando fallback gracioso...`
      );
    }
  } else {
    console.warn(
      `[Fal.ai] Nenhuma chave FAL_KEY / FALL_AI_KEY configurada. Usando fallback local...`
    );
  }

  // Fallback: reutiliza o cenário de teste correspondente para manter o corte seco e a fluidez do vídeo
  const fallbackSource = path.join(MOCK_STORAGE_DIR, `scene_${sceneIndex % 3}.jpg`);
  if (fs.existsSync(fallbackSource)) {
    fs.copyFileSync(fallbackSource, filePath);
  }

  return `${publicBaseUrl}/storage/${videoId}/${fileName}`;
}

/**
 * Dispara chamadas simultâneas (Promise.all) para os cenários de cada cena do roteiro.
 */
export async function generateAllSceneBackgrounds(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string[]> {
  return Promise.all(
    scenes.map((scene, index) =>
      generateSingleSceneImage(
        scene.imagePrompt,
        index,
        videoId,
        storageVideoDir,
        publicBaseUrl
      )
    )
  );
}
