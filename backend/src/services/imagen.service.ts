import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { ScriptScene } from './gemini.service.ts';

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada no ficheiro backend/.env.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Gera uma única imagem de cenário 9:16 para uma cena específica e salva em backend/storage/<videoId>/scene_<index>.jpg.
 */
async function generateSingleSceneImage(
  imagePrompt: string,
  sceneIndex: number,
  videoId: string,
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string> {
  const ai = getGenAIClient();

  const interaction = await ai.interactions.create({
    model: 'gemini-3.1-flash-image',
    input: `${imagePrompt}. Vertical 9:16 format, cinematic historical photography, dramatic lighting, ultra-detailed, no text, no watermarks.`,
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '9:16',
      image_size: '1K',
    },
  });

  const generatedImage = interaction.output_image;
  if (!generatedImage?.data) {
    throw new Error(`Falha ao gerar imagem de cenário para a cena ${sceneIndex}.`);
  }

  fs.mkdirSync(storageVideoDir, { recursive: true });
  const fileName = `scene_${sceneIndex}.jpg`;
  const filePath = path.join(storageVideoDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(generatedImage.data, 'base64'));

  return `${publicBaseUrl}/storage/${videoId}/${fileName}`;
}

/**
 * Pilar 3 (O Diretor de Arte):
 * Dispara chamadas simultâneas (.map() com Promise.all) à API de imagens para cada cena do roteiro.
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

