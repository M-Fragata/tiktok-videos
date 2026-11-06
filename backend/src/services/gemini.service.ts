import { GoogleGenAI } from '@google/genai';

export const VALID_AVATAR_SPRITES = [
  'avatars/avatar_greeting.png',
  'avatars/avatar_neutral.png',
  'avatars/avatar_shocked.png',
  'avatars/avatar_excited.png',
  'avatars/avatar_determined.png',
  'avatars/avatar_happy.png',
  'avatars/avatar_confused.png',
  'avatars/avatar_worried.png',
  'avatars/avatar_panicked.png',
  'avatars/avatar_awkward.png',
  'avatars/avatar_mad.png',
  'avatars/avatar_sad.png',
] as const;

export type AvatarSprite = (typeof VALID_AVATAR_SPRITES)[number];

export interface ScriptScene {
  text: string;
  avatarSprite: AvatarSprite;
  imagePrompt: string;
}

export interface GeneratedScript {
  scenes: ScriptScene[];
}

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
 * Pilar 1 (O Roteirista): Gera o roteiro estruturado em cenas usando gemini-3.8-flash.
 * Cada cena contém o texto falado, a expressão do avatar (1 dos 12 sprites) e o imagePrompt do cenário.
 */
export async function generateTimeMachineScript(
  theme: string
): Promise<GeneratedScript> {
  const ai = getGenAIClient();

  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    system_instruction: `És um roteirista especialista em vídeos curtos virais para o TikTok no nicho "Máquina do Tempo / História".
Cria um roteiro dinâmico em Português dividido entre 3 a 5 cenas curtas (totalizando cerca de 15 a 25 segundos de fala).
Regras obrigatórias:
1. A primeira cena deve começar com um gancho forte de viajante do tempo.
2. O campo "text" de cada cena deve conter apenas o texto falado pelo narrador (sem marcações de cena ou colchetes).
3. O campo "avatarSprite" deve ser escolhido estrategicamente conforme a emoção da frase entre os 12 sprites disponíveis.
4. O campo "imagePrompt" deve ser uma descrição visual detalhada em INGLÊS para gerar o cenário histórico daquela cena em formato vertical 9:16, estilo cinematográfico hiper-realista, sem texto escrito na imagem.`,
    input: `Tema Histórico da Viagem no Tempo: ${theme}`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        required: ['scenes'],
        properties: {
          scenes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'avatarSprite', 'imagePrompt'],
              properties: {
                text: {
                  type: 'string',
                  description: 'Fala do narrador para esta cena.',
                },
                avatarSprite: {
                  type: 'string',
                  enum: [...VALID_AVATAR_SPRITES],
                  description:
                    'Sprite do avatar correspondente à emoção da cena.',
                },
                imagePrompt: {
                  type: 'string',
                  description:
                    'Prompt detalhado em inglês para gerar a imagem de fundo 9:16 desta cena.',
                },
              },
            },
          },
        },
      },
    },
  });

  if (!interaction.output_text) {
    throw new Error('O Google Gemini não retornou conteúdo para o roteiro.');
  }

  const parsed = JSON.parse(interaction.output_text) as GeneratedScript;

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('O roteiro gerado pelo Gemini não contém cenas válidas.');
  }

  return parsed;
}

