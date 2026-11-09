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

export type DurationPreset = 'short' | 'medium' | 'long';

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

const DURATION_RULES: Record<
  DurationPreset,
  { label: string; sceneRange: string; maxWords: number; targetSeconds: number }
> = {
  short: {
    label: 'Curto (15s - máx 40 palavras)',
    sceneRange: '3 a 4 cenas curtas',
    maxWords: 40,
    targetSeconds: 15,
  },
  medium: {
    label: 'Médio (30s - máx 70 palavras)',
    sceneRange: '4 a 6 cenas dinâmicas',
    maxWords: 70,
    targetSeconds: 30,
  },
  long: {
    label: 'Longo (60s - máx 140 palavras)',
    sceneRange: '6 a 8 cenas completas',
    maxWords: 140,
    targetSeconds: 60,
  },
};

/**
 * Pilar 1 (O Roteirista):
 * Gera o roteiro estruturado em cenas no formato "Vlog de Viagem no Tempo" (POV + Stick Figures)
 * usando Google Gemini com Structured Outputs (responseSchema) e limite de duração configurável.
 */
export async function generateTimeMachineScript(
  theme: string,
  durationPreset: DurationPreset = 'short'
): Promise<GeneratedScript> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ficheiro backend/.env.');
  }

  const rule = DURATION_RULES[durationPreset] || DURATION_RULES.short;

  const systemInstruction = `És um roteirista sénior e Diretor de Arte especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts, gerando vídeos virais curtos no nicho "Máquina do Tempo / História".
O formato é uma narrativa histórica dinâmica e imersiva onde personagens em estilo "2D Stickman / Doodle" vivem e interagem fisicamente dentro de mundos históricos 3D cinematográficos e hiper-detalhados.

Duração Selecionada (${rule.label}):
- Estrutura: ${rule.sceneRange} (total de ~${rule.targetSeconds} segundos de fala).
- LIMITE ESTRITO DE PALAVRAS: A soma de todas as falas ("text") de todas as cenas NÃO DEVE ultrapassar ${rule.maxWords} palavras no total.

DIRETRIZES OBRIGATÓRIAS DE ENGENHARIA DE PROMPT ("imagePrompt" — ESTILO MIXED MEDIA 2D/3D):
Cada "imagePrompt" DEVE ser escrito em INGLÊS e seguir rigorosamente a terminologia de modelos de difusão (FLUX / Imagen) para forçar a estética "Mixed Media Illustration" (evitando que a IA gere humanos de carne e osso):
1. GATILHO DE ESTILO (Style Anchor): Comece SEMPRE o prompt com:
   "Mixed media 2D/3D illustration, a 2D cartoon stickman character with a smooth round white head, expressive simple black ink facial features, and thin black stick-figure limbs, integrated seamlessly into a realistic 3D cinematic environment."
2. ANATOMIA E TRAJES DO PERSONAGEM (Character & Attire):
   - Qualquer personagem na cena (seja o viajante estudioso com óculos redondos e colete ou figuras históricas como soldados, reis, cavaleiros ou camponeses) DEVE ter cabeça redonda branca 2D plana em estilo doodle/comic, olhos e boca expressivos desenhados a traço preto simples e braços/pernas de palito pretos finos.
   - Sobre o corpo de palito, o personagem veste trajes ou armaduras históricas texturizadas (ex: "wearing a textured medieval knight armor and red cape", "wearing a weathered WWI helmet and trench coat", "wearing round glasses, curly black hair, and an olive explorer vest").
   - NUNCA descreva pele humana realista; inclua sempre a restrição implícita de estilo ("stylized 2D white doodle head, no realistic human skin or photorealistic faces").
3. INTERAÇÃO FÍSICA, ILUMINAÇÃO E SOMBRAS 3D (Lighting & Physical Integration):
   - O personagem 2D não pode parecer um adesivo colado; ele DEVE interagir fisicamente com objetos e cenários 3D realistas (ex: segurando uma lupa que refrata um osso fóssil realista, montado num cavalo 3D em pleno campo de batalha com fumo e fogo, segurando uma espada e escudo, ou examinando um crânio numa mesa de madeira iluminada).
   - Inclua SEMPRE termos de integração luminosa no final: "integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."

Regras de Roteiro:
1. GANCHO DE URGÊNCIA: A cena 1 começa no meio da ação ou de uma descoberta intrigante.
2. DINÂMICA DE VOZES: O roteiro pode alternar entre 3 vozes:
   - "protagonist": O viajante/apresentador curioso ou em apuros interagindo diretamente com a cena.
   - "character": O personagem histórico de palito reagindo ou contracenando na época.
   - "narrator": Voz épica de documentário para contexto dramático.
3. CLIFFHANGER / FECHO IMPACTANTE: A última cena termina no ápice visual ou dramático do evento histórico.

Regras de Saída (JSON Estrito):
O campo "avatarSprite" dita a expressão associada à cena. Deve ser ESTRITAMENTE UMA destas strings:
${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}

Retorne APENAS um objeto JSON válido neste formato exato:
{
  "scenes": [
    {
      "speaker": "protagonist", 
      "text": "Olha este crânio antigo... mas espera, o chão está a tremer lá fora!", 
      "avatarSprite": "avatars/avatar_shocked.png", 
      "imagePrompt": "Mixed media 2D/3D illustration, a 2D cartoon stickman character with a smooth round white head, expressive simple black ink facial features, round glasses, and thin black stick-figure limbs, integrated seamlessly into a realistic 3D cinematic environment. The stickman is wearing an olive green explorer vest in a dusty candlelit study, holding a realistic brass magnifying glass inspecting an ancient 3D skull on a wooden desk. Warm sunlight streams through a window with floating dust motes. Stylized 2D white doodle head, no realistic human skin, integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the desk, shallow depth of field, 9:16 vertical composition.",
      "sfx_suggestion": "low ominous rumble and rustling papers"
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
          `[Gemini] Roteiro Multi-Voz (${durationPreset}) gerado com sucesso usando ${model} (${parsed.scenes.length} cenas).`
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
