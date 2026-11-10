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

export type AvatarHairStyle =
  | 'bald'
  | 'spiky'
  | 'curly'
  | 'mohawk'
  | 'pompadour';

export type AvatarAccessory =
  | 'none'
  | 'round_glasses'
  | 'explorer_hat'
  | 'knight_helmet'
  | 'crown'
  | 'bandana';

export type AvatarAngle = 'front' | 'right' | 'back' | 'left';

export interface AvatarConfigInput {
  hairStyle?: AvatarHairStyle;
  hairColor?: string;
  strokeColor?: string;
  accessory?: AvatarAccessory;
  angle?: AvatarAngle;
}

export interface ScriptScene {
  speaker: SpeakerType;
  text: string;
  avatarSprite: AvatarSprite;
  imagePrompt: string;
  sfx_suggestion?: string;
}

export interface IdeationScriptOption {
  id: 'humor' | 'action' | 'dark' | 'chaotic' | string;
  title: string;
  badge: string;
  description: string;
  scenes: ScriptScene[];
}

export interface GeneratedIdeation {
  options: IdeationScriptOption[];
}

export interface GeneratedScript {
  scenes: ScriptScene[];
}

const VALID_SPEAKERS: SpeakerType[] = ['protagonist', 'character', 'narrator'];

const HAIR_PROMPT_MAP: Record<AvatarHairStyle, string> = {
  bald: 'smooth bald head with no hair',
  spiky: 'messy spiky 2D drawn hair',
  curly: 'voluminous curly 2D drawn hair',
  mohawk: 'bold punk mohawk 2D drawn hair',
  pompadour: 'stylish retro pompadour 2D drawn hair',
};

const ACCESSORY_PROMPT_MAP: Record<AvatarAccessory, string> = {
  none: 'no headwear or glasses',
  round_glasses: 'wearing iconic round wireframe glasses',
  explorer_hat: 'wearing a classic weathered safari explorer hat',
  knight_helmet: 'wearing a medieval knight visor helmet on his round 2D head',
  crown: 'wearing a golden royal crown tilted on his 2D head',
  bandana: 'wearing a rugged adventurer bandana tied around his forehead',
};

export function buildAvatarPromptDescriptor(
  avatarConfig?: AvatarConfigInput
): string {
  const hair = HAIR_PROMPT_MAP[avatarConfig?.hairStyle || 'spiky'];
  const hairColor =
    avatarConfig?.hairColor || avatarConfig?.strokeColor || '#111827';
  const accessory =
    ACCESSORY_PROMPT_MAP[avatarConfig?.accessory || 'round_glasses'];
  const strokeColor = avatarConfig?.strokeColor || '#111827';

  return `2D cartoon stickman protagonist with a smooth round white head, ${hair} in ${hairColor} color, ${accessory}, expressive simple facial features, and thin stick-figure limbs outlined in ${strokeColor} ink`;
}

const DURATION_RULES: Record<
  DurationPreset,
  { label: string; sceneRange: string; maxWords: number; targetSeconds: number }
> = {
  short: {
    label: 'Curto (15s - máx 40 palavras)',
    sceneRange: '4 a 6 cenas dinâmicas (alternando cortes rápidos e médios)',
    maxWords: 40,
    targetSeconds: 15,
  },
  medium: {
    label: 'Médio (30s - máx 70 palavras)',
    sceneRange: '6 a 9 cenas dinâmicas (alternando cortes rápidos e médios)',
    maxWords: 70,
    targetSeconds: 30,
  },
  long: {
    label: 'Longo (60s - máx 140 palavras)',
    sceneRange: '9 a 14 cenas dinâmicas (alternando cortes rápidos e médios)',
    maxWords: 140,
    targetSeconds: 60,
  },
};

const VIRAL_PACING_INSTRUCTION = `DIRETRIZES DE MONTAGEM CINEMATOGRÁFICA E RITMO VIRAL (RETENÇÃO ALTA):
Na nossa arquitetura, cada cena gera um corte visual de câmara (B-Roll) + efeito sonoro de transição (Whoosh). Portanto, o COMPRIMENTO de cada fala ("text") dita diretamente a velocidade dos cortes do vídeo!
Para manter a retenção máxima no TikTok/Shorts, varie deliberadamente o comprimento das falas entre as cenas seguindo esta estrutura de ritmo viral:
- Cena 1 (O Gancho / Hook): Frase ULTRA-CURTA e chocante (3 a 6 palavras). Ex: "Isto não devia estar aqui!" ou "Olha para o céu de Pompeia!". Isso força um corte visual rápido logo nos primeiros 1.5 segundos.
- Cenas de Desenvolvimento (Storytelling): Intercale frases médias (10 a 15 palavras) — que dão tempo para o espectador absorver o cenário histórico e a explicação — com cenas curtas de reação ou diálogo rápido (4 a 7 palavras).
- Cena de Clímax / Punchline Final: Volte para uma frase curta, urgente e expressiva (4 a 8 palavras) para acelerar o ritmo novamente no fecho.
És livre para decidir a quantidade ideal de cenas para preencher o tempo total, desde que alternes entre cenas rápidas (poucas palavras) e cenas médias, criando uma montagem dinâmica, orgânica e humana, NUNCA ultrapassando o limite global de palavras.`;

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

${VIRAL_PACING_INSTRUCTION}

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

/**
 * Pilar 1B (Motor de Ideação Mix & Match):
 * Gera 4 opções de roteiro completas com ângulos narrativos distintos
 * (Humor, Ação, Sombrio, Caótico) já injetando a aparência customizada do Avatar
 * nos prompts de imagem de cada cena.
 */
export async function generateTimeMachineIdeation(
  theme: string,
  durationPreset: DurationPreset = 'short',
  avatarConfig?: AvatarConfigInput
): Promise<GeneratedIdeation> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ficheiro backend/.env.');
  }

  const rule = DURATION_RULES[durationPreset] || DURATION_RULES.short;
  const avatarDescriptor = buildAvatarPromptDescriptor(avatarConfig);

  const systemInstruction = `És um roteirista sénior e Diretor de Arte especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts, gerando vídeos virais curtos no nicho "Máquina do Tempo / História".

A tua missão é criar um BRAINSTORMING DE ROTEIROS com EXATAMENTE 4 OPÇÕES de ângulos narrativos distintos para o mesmo tema histórico:
1. id: "humor" | title: "Humor & Ironia" | badge: "😂 Humor" -> Abordagem cómica, sarcástica, destacando o absurdo quotidiano da época.
2. id: "action" | title: "Ação & Sobrevivência" | badge: "⚔️ Ação" -> Ritmo frenético, perigo iminente, adrenalina no olho do furacão histórico.
3. id: "dark" | title: "Sombrio & Mistério" | badge: "🌑 Sombrio" -> Atmosfera densa, segredos ocultos, tensão psicológica e detalhes arrepiantes.
4. id: "chaotic" | title: "Caótico & Paradoxo" | badge: "🔥 Caótico" -> Ritmo imprevisível, reviravoltas rápidas e choque cultural extremo do viajante do tempo.

Duração Selecionada para CADA uma das 4 opções (${rule.label}):
- Estrutura por opção: ${rule.sceneRange} (total de ~${rule.targetSeconds} segundos de fala por opção).
- LIMITE ESTRITO DE PALAVRAS POR OPÇÃO: A soma das falas ("text") dentro de cada opção NÃO DEVE ultrapassar ${rule.maxWords} palavras.

${VIRAL_PACING_INSTRUCTION}

APARÊNCIA CUSTOMIZADA DO AVATAR PROTAGONISTA (OBRIGATÓRIO EM TODOS OS "imagePrompt"):
O utilizador configurou o protagonista no Camarim 360º com a seguinte aparência exata:
"${avatarDescriptor}"

DIRETRIZES OBRIGATÓRIAS DE ENGENHARIA DE PROMPT ("imagePrompt" — ESTILO MIXED MEDIA 2D/3D):
Cada "imagePrompt" DEVE ser escrito em INGLÊS e seguir rigorosamente a terminologia de modelos de difusão para forçar a estética "Mixed Media Illustration":
1. GATILHO DE ESTILO + AVATAR CUSTOMIZADO: Comece SEMPRE o prompt com:
   "Mixed media 2D/3D illustration, a ${avatarDescriptor}, integrated seamlessly into a realistic 3D cinematic environment."
2. ANATOMIA E TRAJES DO PERSONAGEM:
   - O protagonista mantém sempre as características do Camarim (${avatarDescriptor}), combinadas com roupas ou objetos que interajam com a época histórica.
   - Figuras secundárias da época também têm cabeça redonda branca 2D plana em estilo doodle/comic e membros de palito finos com trajes históricos texturizados.
   - NUNCA descreva pele humana realista ("stylized 2D white doodle head, no realistic human skin or photorealistic faces").
3. INTERAÇÃO FÍSICA, ILUMINAÇÃO E SOMBRAS 3D:
   - O personagem 2D interage fisicamente com objetos e cenários 3D realistas.
   - Termine SEMPRE o prompt com: "integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."

Regras de Saída (JSON Estrito):
O campo "avatarSprite" deve ser ESTRITAMENTE UMA destas strings:
${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}`;

  const sceneItemSchema = {
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
  };

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      options: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: {
              type: 'STRING',
              enum: ['humor', 'action', 'dark', 'chaotic'],
            },
            title: {
              type: 'STRING',
            },
            badge: {
              type: 'STRING',
            },
            description: {
              type: 'STRING',
            },
            scenes: {
              type: 'ARRAY',
              items: sceneItemSchema,
            },
          },
          required: ['id', 'title', 'badge', 'description', 'scenes'],
        },
      },
    },
    required: ['options'],
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
          `[Gemini Ideation] Modelo ${model} retornou erro (${data.error.code}): ${data.error.message}`
        );
        continue;
      }

      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        continue;
      }

      const parsed = JSON.parse(rawJson) as GeneratedIdeation;
      if (Array.isArray(parsed.options) && parsed.options.length > 0) {
        console.log(
          `[Gemini Ideation] ${parsed.options.length} opções de roteiro (${durationPreset}) geradas com sucesso usando ${model}.`
        );
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini Ideation] Falha ao tentar modelo ${model}:`, err);
    }
  }

  throw new Error(
    'Falha ao gerar opções de roteiro no Google Gemini com os modelos disponíveis.'
  );
}
