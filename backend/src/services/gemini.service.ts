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

export type SpeakerType = 'protagonist' | 'character' | 'narrator';

export interface ScriptScene {
  speaker: SpeakerType;
  text: string;
  avatarSprite: AvatarSprite;
  imagePrompt: string;
  sfx_suggestion?: string;
}

export interface GeneratedScript {
  scenes: ScriptScene[];
}

const VALID_SPEAKERS: SpeakerType[] = ['protagonist', 'character', 'narrator'];

/**
 * Pilar 1 (O Roteirista):
 * Gera o roteiro estruturado em cenas no formato "Vlog de Viagem no Tempo" (POV + Stick Figures)
 * usando Google Gemini com Structured Outputs (responseSchema).
 */
export async function generateTimeMachineScript(
  theme: string
): Promise<GeneratedScript> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ficheiro backend/.env.');
  }

  const systemInstruction = `És um roteirista e diretor de arte para vídeos virais do TikTok no nicho "Máquina do Tempo / História".
O formato é um Vlog de Viagem no Tempo caótico, onde um viajante moderno (um boneco de palito) interage com o passado.

Duração: 3 a 5 cenas curtas (total de 15 a 20 segundos de fala).
Estética Visual Obrigatória (Mídia Mista): Os cenários de fundo devem ser hiper-realistas e cinematográficos. No entanto, QUALQUER personagem histórico que apareça na imagem DEVE ser desenhado como um "stick figure" (boneco de palito de linhas pretas simples), diferenciado apenas por adereços fotorealistas na cabeça (ex: um boneco de palito usando um capacete de centurião romano detalhado, ou um boneco de palito com a peruca de Einstein).

Regras de Roteiro:
1. GANCHO DE URGÊNCIA: A cena 1 começa no meio do caos. O viajante está em apuros imediatos.
2. DINÂMICA DE VOZES: O roteiro deve alternar entre 3 vozes:
   - "protagonist": O viajante (fala coloquial, desesperada ou entusiasmada, quebrando a quarta parede).
   - "character": O personagem histórico de palito interagindo com o viajante.
   - "narrator": Voz épica de documentário para dar contexto rápido (opcional, usar com moderação).
3. CLIFFHANGER: O vídeo corta abruptamente no pico da tensão na última cena.

Regras de Saída (JSON Estrito):
O campo "avatarSprite" dita a expressão do nosso protagonista na tela. Deve ser ESTRITAMENTE UMA destas strings:
${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}

Retorne APENAS um objeto JSON válido neste formato exato:
{
  "scenes": [
    {
      "speaker": "protagonist", 
      "text": "Eita, o vulcão já está cuspindo fogo! Corre!", 
      "avatarSprite": "avatars/avatar_panicked.png", 
      "imagePrompt": "POV, first-person view. Cinematic hyper-realistic background of ancient Pompeii streets. Mount Vesuvius erupting in the background. In the foreground, a simple black-line stick figure character wearing a highly detailed historical roman tunic and helmet, looking directly at the camera in shock. 9:16 vertical.",
      "sfx_suggestion": "loud volcano explosion rumble"
    }
  ]
}`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      scenes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            speaker: {
              type: 'STRING',
              enum: VALID_SPEAKERS,
            },
            text: {
              type: 'STRING',
            },
            avatarSprite: {
              type: 'STRING',
              enum: [...VALID_AVATAR_SPRITES],
            },
            imagePrompt: {
              type: 'STRING',
            },
            sfx_suggestion: {
              type: 'STRING',
            },
          },
          required: ['speaker', 'text', 'avatarSprite', 'imagePrompt'],
        },
      },
    },
    required: ['scenes'],
  };

  // Modelos disponíveis em ordem de preferência
  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\nTema Histórico da Viagem no Tempo: ${theme}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.warn(
          `[Gemini] Modelo ${model} retornou erro (${data.error.code}): ${data.error.message}`
        );
        continue;
      }

      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        continue;
      }

      const parsed = JSON.parse(rawJson) as GeneratedScript;
      if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        console.log(
          `[Gemini] Roteiro Multi-Voz gerado com sucesso usando ${model} (${parsed.scenes.length} cenas).`
        );
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini] Falha ao tentar modelo ${model}:`, err);
    }
  }

  throw new Error(
    'Falha ao gerar roteiro no Google Gemini com os modelos disponíveis.'
  );
}
