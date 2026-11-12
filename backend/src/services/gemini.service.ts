import { listAllSfxOptions, type SfxOption } from './sfx-library.service.ts';
import { getCharacterVoicesPromptPart } from './voice-catalog.service.ts';
import { ScriptPromptBuilder } from '../prompts/prompt-builder.ts';
import type {
  ContentBalance,
  EpisodeFormat,
  ProtagonistAgency,
  SeriesContext,
} from '../schemas/video.schema.ts';

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
  | 'forehead_goggles'
  | 'round_glasses'
  | 'explorer_hat'
  | 'knight_helmet'
  | 'crown'
  | 'bandana';

export type AvatarNeckAccessory = 'none' | 'red_bandana';

export type AvatarAngle = 'front' | 'right' | 'back' | 'left';

export interface AvatarConfigInput {
  hairStyle?: AvatarHairStyle;
  hairColor?: string;
  strokeColor?: string;
  accessory?: AvatarAccessory;
  neckAccessory?: AvatarNeckAccessory;
  angle?: AvatarAngle;
}

export interface DialogueItem {
  id: string;
  speaker: SpeakerType;
  characterName?: string;
  voiceId?: string;
  text: string;
}

export interface ScriptScene {
  id?: string;
  speaker?: SpeakerType;
  text?: string;
  dialogues?: DialogueItem[];
  avatarSprite: AvatarSprite;
  visual_description?: string;
  imagePrompt: string;
  sfx_suggestion?: string;
  sfx_prompt?: string;
  sfx_label?: string;
  custom_sfx_url?: string | null;
}

export interface NarrativePlan {
  architecture_id:
    | 'in_media_res'
    | 'myth_buster'
    | 'witness_pov'
    | 'ticking_clock'
    | string;
  hook_type: string;
  core_revelation: string;
  bridge_speaker?: 'protagonist' | 'narrator';
  bridge_full_sentence: string;
  loop_closing_fragment: string;
  loop_opening_fragment: string;
}

export interface IdeationScriptOption {
  id: 'in_media_res' | 'myth_buster' | 'witness_pov' | 'ticking_clock' | string;
  title: string;
  badge: string;
  description: string;
  bgmVibe?:
    | 'epic'
    | 'dark'
    | 'fun'
    | 'hiphop'
    | 'action'
    | 'piano'
    | 'adventure'
    | 'comedy'
    | 'none';
  narrative_plan?: NarrativePlan;
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
  spiky: 'messy spiky 2D drawn hair with sharp distinct tufts',
  curly: 'voluminous curly 2D drawn hair',
  mohawk: 'bold punk mohawk 2D drawn hair',
  pompadour: 'stylish retro pompadour 2D drawn hair',
};

const ACCESSORY_PROMPT_MAP: Record<AvatarAccessory, string> = {
  none: 'no headwear or goggles',
  forehead_goggles:
    'wearing retro aviator goggles with light cyan reflective lenses and brown leather strap resting on his forehead',
  round_glasses: 'wearing iconic round wireframe glasses',
  explorer_hat: 'wearing a classic weathered safari explorer hat',
  knight_helmet: 'wearing a medieval knight visor helmet on his round 2D head',
  crown: 'wearing a golden royal crown tilted on his 2D head',
  bandana: 'wearing a rugged adventurer bandana tied around his forehead',
};

const NECK_ACCESSORY_PROMPT_MAP: Record<AvatarNeckAccessory, string> = {
  none: '',
  red_bandana:
    'a vibrant red adventurer scarf bandana knotted around his neck with folded fabric and fluttering ends',
};

export function buildAvatarPromptDescriptor(
  avatarConfig?: AvatarConfigInput
): string {
  const hair = HAIR_PROMPT_MAP[avatarConfig?.hairStyle || 'spiky'];
  const hairColor =
    avatarConfig?.hairColor || avatarConfig?.strokeColor || '#EA580C';
  const headAccessory =
    ACCESSORY_PROMPT_MAP[avatarConfig?.accessory || 'forehead_goggles'];
  const neckAccessory =
    NECK_ACCESSORY_PROMPT_MAP[avatarConfig?.neckAccessory || 'red_bandana'];
  const strokeColor = avatarConfig?.strokeColor || '#111827';
  const neckPhrase = neckAccessory ? `, ${neckAccessory}` : '';

  return `2D cartoon stickman protagonist with a smooth round white head, a distinct solid white capsule torso with smooth thickness outlined in clean ${strokeColor} ink (NOT a stick-line torso), thin stick-figure arms and legs, ${hair} in vibrant ${hairColor} color, ${headAccessory}${neckPhrase}`;
}

const DURATION_RULES: Record<
  DurationPreset,
  {
    label: string;
    sceneRange: string;
    minWords: number;
    maxWords: number;
    targetSeconds: number;
    avgWordsPerScene: string;
  }
> = {
  short: {
    label: 'Curto (15s • 32 a 42 palavras)',
    sceneRange: '3 a 5 cenas dinâmicas (~3 a 5s por cena)',
    minWords: 32,
    maxWords: 42,
    targetSeconds: 15,
    avgWordsPerScene: '7 a 10 palavras por cena',
  },
  medium: {
    label: 'Médio (30s • 65 a 78 palavras)',
    sceneRange: '5 a 7 cenas dinâmicas (~4 a 6s por cena)',
    minWords: 65,
    maxWords: 78,
    targetSeconds: 30,
    avgWordsPerScene: '10 a 14 palavras por cena',
  },
  long: {
    label: 'Longo (65s • 145 a 175 palavras — Monetização TikTok)',
    sceneRange: '10 a 14 cenas dinâmicas (~4 a 6s por cena)',
    minWords: 145,
    maxWords: 175,
    targetSeconds: 65,
    avgWordsPerScene: '12 a 16 palavras por cena',
  },
};

function formatSfxInstructions(availableSfx: SfxOption[]): {
  systemPromptPart: string;
  enumSlugs: string[];
} {
  const optionsWithoutNone = availableSfx.filter((o) => o.value !== 'none');
  const itemsText = optionsWithoutNone
    .map(
      (o) =>
        `   - "${o.value}": ${o.label}${o.prompt ? ` (${o.prompt})` : ''}${o.isCustom ? ' [Efeito Sonoro Salvo na Biblioteca]' : ''}`
    )
    .join('\n');

  const systemPromptPart = `2. EFEITOS SONOROS POR CENA ("sfx_suggestion"):
   A nossa biblioteca de áudio possui efeitos cirúrgicos. Para CADA cena, escolhe ESTRITAMENTE um dos seguintes identificadores (ou "none"):
${itemsText}
   - "none": Se a cena não precisa de efeito sonoro no corte.

3. PROMPT DE DESIGN DE SOM TEXT-TO-SFX ("sfx_prompt"):
   Para CADA cena, deves escrever um prompt acústico descritivo e expressivo em INGLÊS no campo "sfx_prompt" (1 a 2 frases curtas) pronto para a API de Sound Effects da ElevenLabs. Descreva o timbre, reverberação, distância e ação física do som.

4. TÍTULO CURTO DO EFEITO SONORO EM PORTUGUÊS COM EMOJI ("sfx_label"):
   Para CADA cena, gera um título curto e expressivo em português com 1 emoji inicial relevante descrevendo o som (ex: "🏃 Corrida na Areia", "🪵 Porta Antiga Rangendo", "⚔️ Espada Cortando o Ar"). Se usares um som prévio da biblioteca, podes usar o próprio rótulo dele.`;

  const enumSlugs = Array.from(
    new Set([...availableSfx.map((o) => o.value), 'none'])
  );

  return { systemPromptPart, enumSlugs };
}

const VIRAL_PACING_INSTRUCTION = `DIRETRIZES DE MONTAGEM CINEMATOGRÁFICA E RITMO VIRAL (RETENÇÃO ALTA):
Na nossa arquitetura, cada cena gera um corte visual de câmara (B-Roll) + efeito sonoro de transição. Portanto, a DURAÇÃO e o COMPRIMENTO de cada fala ("text") determinam o tempo de tela daquela cena!
Para preencher adequadamente o tempo total do vídeo SEM silêncios mortos:
- Cena 1 (O Gancho / Hook): Frase impactante de 5 a 8 palavras (corte rápido e enérgico).
- Cenas de Desenvolvimento (Storytelling): Frases completas e ricas de 10 a 16 palavras, recheadas de fatos históricos, diálogos vívidos e contexto detalhado (NÃO crie falas secas de 4 palavras no desenvolvimento!).
- Cena de Clímax / Punchline Final: Frase expressiva de 6 a 10 palavras com fechamento surpreendente ou cômico.`;

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
  const availableSfx = await listAllSfxOptions();
  const { systemPromptPart, enumSlugs } = formatSfxInstructions(availableSfx);

  const systemInstruction = `És um roteirista sénior e Diretor de Arte especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts, gerando vídeos virais curtos no nicho "Máquina do Tempo / História".
O formato é uma narrativa histórica dinâmica e imersiva onde personagens em estilo "2D Stickman / Doodle" vivem e interagem fisicamente dentro de mundos históricos 3D cinematográficos e hiper-detalhados.

Duração Selecionada (${rule.label}):
- Estrutura: ${rule.sceneRange} (total de ~${rule.targetSeconds} segundos de fala).
- LIMITE ESTRITO DE PALAVRAS: A soma de todas as falas ("text") de todas as cenas NÃO DEVE ultrapassar ${rule.maxWords} palavras no total.

${VIRAL_PACING_INSTRUCTION}

DIRETRIZES OBRIGATÓRIAS DE ENGENHARIA DE PROMPT VISUAL ("imagePrompt" — ESTILO MIXED MEDIA 2D/3D):
Cada "imagePrompt" DEVE ser escrito em INGLÊS e estruturado para difusão (FLUX / Imagen), garantindo dinamismo e coerência:
1. GATILHO DE ESTILO + AVATAR: Comece SEMPRE o prompt com:
   "Mixed media 2D/3D illustration, a 2D cartoon stickman character with a smooth round white head, a distinct solid white capsule torso with smooth thickness outlined in clean dark ink (NOT a stick-line torso), thin stick-figure arms and legs, [EXPRESSÃO FACIAL DINÂMICA DA CENA], [POSE E AÇÃO DINÂMICA DO PERSONAGEM], [CENÁRIO HISTÓRICO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
2. EXPRESSÕES FACIAIS E POSES DINÂMICAS:
   - A EXPRESSÃO FACIAL DEVE variar cena a cena de acordo com a emoção do momento e o "avatarSprite" escolhido (talking, shocked, scared, happy, angry, laughing, thinking, etc.).
   - A POSE E AÇÃO FÍSICA DEVE ser ativa (escalando, correndo, tropeçando, apontando, espiando, etc. — NUNCA todos com mãos na cintura).
3. ANATOMIA E REGRA DE TODOS OS PERSONAGENS:
   - TRONCO COM ESPESSURA: Tanto o protagonista quanto qualquer personagem devem ter tronco branco com espessura visível (cápsula/torso branco 2D contornado a nanquim). NUNCA desenhe o tronco como linha única de palito.
   - TODOS OS PERSONAGENS NO MESMO ESTILO: Figuras secundárias, soldados de Napoleão, Sa'im al-Dahr e multidões históricas DEVEM ser desenhados no MESMO formato de cartoon 2D ("all secondary characters and historical figures are also stylized 2D cartoon stickmen with smooth round white heads, distinct solid white capsule torsos with thickness, and thin stick limbs, wearing cartoon historical costumes. ABSOLUTELY NO photorealistic human skin or realistic human faces").

Regras de Roteiro:
1. GANCHO DE URGÊNCIA: A cena 1 começa no meio da ação ou de uma descoberta intrigante.
2. DINÂMICA EM DUPLA E PERSONALIDADE DO PROTAGONISTA:
   - "protagonist" (Billy): Aventureiro curioso, expressivo, caótico e atrapalhado. Fala em português brasileiro coloquial, fluído e dinâmico ("pra", "tá", "né", "olha só", "peraí", "cara", "sério", "deu ruim", "bizarro"), com reações viscerais e zero tom professoral.
   - "narrator": Estilo documental e voz da razão, expondo fatos históricos, datas e contexto real com precisão e sobriedade.
   - "character": Personagens históricos de época com pompa solene, gerando contraste cômico imediato com as respostas rápidas do protagonista.
   - MÚLTIPLOS DIÁLOGOS POR CENA: Cada cena pode conter de 1 a 3 falas sequenciais curtas em estilo bate-bola ágil no array "dialogues" (ex: Narrador expõe o fato e Protagonista reage com espanto/sarcasmo). Sempre que houver diálogo entre personagens na mesma cena, o "imagePrompt" DEVE retratar visualmente a interação física de ambos.
3. CLIFFHANGER / FECHO IMPACTANTE: A última cena termina no ápice visual ou dramático do evento histórico.

${getCharacterVoicesPromptPart()}

${systemPromptPart}

Regras de Saída (JSON Estrito):
O campo "avatarSprite" dita a expressão associada à cena. Deve ser ESTRITAMENTE UMA destas strings:
${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}

Retorne APENAS um objeto JSON válido neste formato exato:
{
  "scenes": [
    {
      "speaker": "protagonist", 
      "text": "Olha este crânio antigo... mas espera, o chão está a tremer lá fora!", 
      "dialogues": [
        {
          "speaker": "protagonist",
          "text": "Olha este crânio antigo... mas espera, o chão está a tremer lá fora!"
        }
      ],
      "avatarSprite": "avatars/avatar_shocked.png", 
      "imagePrompt": "Mixed media 2D/3D illustration, a 2D cartoon stickman character with a smooth round white head, expressive simple black ink facial features, round glasses, and thin black stick-figure limbs, integrated seamlessly into a realistic 3D cinematic environment. The stickman is wearing an olive green explorer vest in a dusty candlelit study, holding a realistic brass magnifying glass inspecting an ancient 3D skull on a wooden desk. Warm sunlight streams through a window with floating dust motes. Stylized 2D white doodle head, no realistic human skin, integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the desk, shallow depth of field, 9:16 vertical composition.",
      "sfx_suggestion": "whoosh",
      "sfx_label": "💨 Transição Rápida",
      "sfx_prompt": "Low ominous rumble and rustling papers in an ancient wooden room"
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
            dialogues: {
              type: 'ARRAY',
              description:
                'Lista de 1 a 3 falas sequenciais nesta mesma cena (diálogo orgânico entre personagens).',
              items: {
                type: 'OBJECT',
                properties: {
                  speaker: {
                    type: 'STRING',
                    enum: VALID_SPEAKERS,
                  },
                  characterName: {
                    type: 'STRING',
                    description:
                      'Nome da figura histórica ou papel (ex: Cleópatra, Napoleão) quando speaker for character.',
                  },
                  voiceId: {
                    type: 'STRING',
                    description:
                      'ID da voz escolhida no catálogo de personagens quando speaker for character.',
                  },
                  text: {
                    type: 'STRING',
                  },
                },
                required: ['speaker', 'text'],
              },
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
              enum: enumSlugs,
            },
            sfx_label: {
              type: 'STRING',
            },
            sfx_prompt: {
              type: 'STRING',
            },
          },
          required: [
            'speaker',
            'text',
            'dialogues',
            'avatarSprite',
            'imagePrompt',
            'sfx_suggestion',
            'sfx_label',
            'sfx_prompt',
          ],
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
      console.log(`[Gemini Ideation] Solicitando roteiro ao modelo ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\n=== BRIEFING & FATOS HISTÓRICOS DA VIAGEM FORNECIDOS PELO UTILIZADOR ===\n${theme}`,
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
        parsed.scenes = parsed.scenes.map((s, idx) => {
          const mappedDialogues =
            s.dialogues && s.dialogues.length > 0
              ? s.dialogues.map((d, dIdx) => ({
                  id: d.id || `dlg_${idx}_${dIdx}`,
                  speaker: d.speaker || 'protagonist',
                  text: d.text || '',
                }))
              : [
                  {
                    id: `dlg_${idx}_0`,
                    speaker: s.speaker || 'protagonist',
                    text: s.text || '',
                  },
                ];

          return {
            ...s,
            dialogues: mappedDialogues,
            speaker: mappedDialogues[0]?.speaker || s.speaker || 'protagonist',
            text: mappedDialogues.map((d) => d.text).join(' ') || s.text || '',
          };
        });

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

export interface GenerateIdeationParams {
  theme: string;
  durationPreset?: DurationPreset;
  avatarConfig?: AvatarConfigInput;
  selectedBgmVibe?: string;
  episodeFormat?: EpisodeFormat;
  seriesContext?: SeriesContext;
  protagonistAgency?: ProtagonistAgency;
  contentBalance?: ContentBalance;
}

/**
 * Pilar 1B (Motor de Ideação Mix & Match):
 * Gera 4 opções de roteiro completas com ângulos narrativos distintos
 * (Humor, Ação, Sombrio, Caótico) já injetando a aparência customizada do Avatar
 * nos prompts de imagem de cada cena e modulando os eixos de formato, agência e equilíbrio.
 */
export async function generateTimeMachineIdeation(
  themeOrParams: string | GenerateIdeationParams,
  durationPresetParam: DurationPreset = 'short',
  avatarConfigParam?: AvatarConfigInput,
  selectedBgmVibeParam?: string
): Promise<GeneratedIdeation> {
  const params: GenerateIdeationParams =
    typeof themeOrParams === 'object'
      ? themeOrParams
      : {
          theme: themeOrParams,
          durationPreset: durationPresetParam,
          avatarConfig: avatarConfigParam,
          selectedBgmVibe: selectedBgmVibeParam,
        };

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ficheiro backend/.env.');
  }

  const duration = params.durationPreset || 'short';
  const avatarDescriptor = buildAvatarPromptDescriptor(params.avatarConfig);
  const availableSfx = await listAllSfxOptions();

  const builder = new ScriptPromptBuilder()
    .withTheme(params.theme)
    .withDuration(duration)
    .withAvatarDescriptor(avatarDescriptor)
    .withEpisodeFormat(params.episodeFormat || 'single', params.seriesContext)
    .withProtagonistAgency(params.protagonistAgency || 'chaos_agent')
    .withContentBalance(params.contentBalance || 'balanced')
    .withTone(params.selectedBgmVibe)
    .withSfxOptions(availableSfx);

  const { systemInstruction, enumSlugs } = builder.buildIdeationInstruction();

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
      dialogues: {
        type: 'ARRAY',
        description:
          'Lista de 1 a 3 falas sequenciais nesta mesma cena (diálogo orgânico entre personagens).',
        items: {
          type: 'OBJECT',
          properties: {
            speaker: {
              type: 'STRING',
              enum: VALID_SPEAKERS,
            },
            characterName: {
              type: 'STRING',
              description:
                'Nome da figura histórica ou papel (ex: Cleópatra, Napoleão) quando speaker for character.',
            },
            voiceId: {
              type: 'STRING',
              description:
                'ID da voz escolhida no catálogo de personagens quando speaker for character.',
            },
            text: {
              type: 'STRING',
            },
          },
          required: ['speaker', 'text'],
        },
      },
      avatarSprite: {
        type: 'STRING',
        enum: [...VALID_AVATAR_SPRITES],
      },
      visual_description: {
        type: 'STRING',
        description:
          'Descrição concisa em português do cenário histórico e da ação visual da cena.',
      },
      imagePrompt: {
        type: 'STRING',
      },
      sfx_suggestion: {
        type: 'STRING',
        enum: enumSlugs,
      },
      sfx_label: {
        type: 'STRING',
        description:
          'Título curto em português com 1 emoji descrevendo o efeito sonoro (ex: "🏃 Corrida na Areia").',
      },
      sfx_prompt: {
        type: 'STRING',
        description:
          'Prompt acústico descritivo em inglês para o gerador de efeitos sonoros por IA (ElevenLabs Sound Effects).',
      },
    },
    required: [
      'speaker',
      'text',
      'dialogues',
      'avatarSprite',
      'visual_description',
      'imagePrompt',
      'sfx_suggestion',
      'sfx_label',
      'sfx_prompt',
    ],
  };

  const narrativePlanItemSchema = {
    type: 'OBJECT',
    properties: {
      architecture_id: {
        type: 'STRING',
        enum: ['in_media_res', 'myth_buster', 'witness_pov', 'ticking_clock'],
      },
      hook_type: { type: 'STRING' },
      core_revelation: { type: 'STRING' },
      bridge_speaker: {
        type: 'STRING',
        enum: ['protagonist', 'narrator'],
      },
      bridge_full_sentence: { type: 'STRING' },
      loop_closing_fragment: { type: 'STRING' },
      loop_opening_fragment: { type: 'STRING' },
    },
    required: [
      'architecture_id',
      'hook_type',
      'core_revelation',
      'bridge_speaker',
      'bridge_full_sentence',
      'loop_closing_fragment',
      'loop_opening_fragment',
    ],
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
              enum: [
                'in_media_res',
                'myth_buster',
                'witness_pov',
                'ticking_clock',
              ],
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
            bgmVibe: {
              type: 'STRING',
              enum: [
                'epic',
                'dark',
                'fun',
                'hiphop',
                'action',
                'piano',
                'adventure',
                'comedy',
                'none',
              ],
            },
            narrative_plan: narrativePlanItemSchema,
            scenes: {
              type: 'ARRAY',
              items: sceneItemSchema,
            },
          },
          required: [
            'id',
            'title',
            'badge',
            'description',
            'bgmVibe',
            'narrative_plan',
            'scenes',
          ],
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
      console.log(`[Gemini Ideation] Solicitando roteiro ao modelo ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\n=== BRIEFING & FATOS HISTÓRICOS DA VIAGEM FORNECIDOS PELO UTILIZADOR ===\n${params.theme}`,
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
        parsed.options = parsed.options.map((opt) => {
          // 1. Higieniza o narrative_plan do Seamless Loop se presente
          let sanitizedPlan = opt.narrative_plan;
          if (sanitizedPlan) {
            sanitizedPlan = {
              ...sanitizedPlan,
              loop_closing_fragment: (sanitizedPlan.loop_closing_fragment || '')
                .replace(/[.!?:;…]+$/, '')
                .trim(),
              loop_opening_fragment: (
                sanitizedPlan.loop_opening_fragment || ''
              ).trim(),
              bridge_full_sentence: (
                sanitizedPlan.bridge_full_sentence || ''
              ).trim(),
            };
          }

          // 2. Mapeia diálogos e oradores
          const mappedScenes = (opt.scenes || []).map((s, sIdx) => {
            const mappedDialogues =
              s.dialogues && s.dialogues.length > 0
                ? s.dialogues.map((d, dIdx) => ({
                    id: d.id || `dlg_${opt.id}_${sIdx}_${dIdx}`,
                    speaker: d.speaker || s.speaker || 'protagonist',
                    text: d.text || '',
                  }))
                : [
                    {
                      id: `dlg_${opt.id}_${sIdx}_0`,
                      speaker: s.speaker || 'protagonist',
                      text: s.text || '',
                    },
                  ];

            return {
              ...s,
              dialogues: mappedDialogues,
              speaker:
                mappedDialogues[0]?.speaker || s.speaker || 'protagonist',
              text:
                mappedDialogues.map((d) => d.text).join(' ') || s.text || '',
            };
          });

          // 3. Higienização Cirúrgica de Loop: Remove pontuação terminal estritamente
          // da ÚLTIMA fala do ÚLTIMO diálogo da ÚLTIMA cena para garantir entonação de áudio fluida
          if (mappedScenes.length > 0) {
            const lastScene = mappedScenes[mappedScenes.length - 1];
            if (lastScene.dialogues && lastScene.dialogues.length > 0) {
              const lastDialogue =
                lastScene.dialogues[lastScene.dialogues.length - 1];
              lastDialogue.text = lastDialogue.text
                .replace(/[.!?:;…]+$/, '')
                .trim();
              lastScene.text = lastScene.dialogues
                .map((d) => d.text)
                .join(' ');
            } else if (lastScene.text) {
              lastScene.text = lastScene.text.replace(/[.!?:;…]+$/, '').trim();
            }
          }

          // 4. Validação e Garantia da Regra de bridge_speaker (Mesmo orador no início e fim do loop)
          if (mappedScenes.length > 0 && sanitizedPlan?.bridge_speaker) {
            const expectedSpeaker =
              sanitizedPlan.bridge_speaker === 'narrator'
                ? 'narrator'
                : 'protagonist';
            const firstScene = mappedScenes[0];
            const lastScene = mappedScenes[mappedScenes.length - 1];

            // Garante que a fala de abertura da cena 1 pertence ao bridge_speaker
            if (firstScene.dialogues && firstScene.dialogues.length > 0) {
              firstScene.dialogues[0].speaker = expectedSpeaker;
              firstScene.speaker = expectedSpeaker;
            } else {
              firstScene.speaker = expectedSpeaker;
            }

            // Garante que a fala final da última cena pertence ao bridge_speaker
            if (lastScene.dialogues && lastScene.dialogues.length > 0) {
              const lastDialogue =
                lastScene.dialogues[lastScene.dialogues.length - 1];
              lastDialogue.speaker = expectedSpeaker;
            } else {
              lastScene.speaker = expectedSpeaker;
            }
          }

          return {
            ...opt,
            narrative_plan: sanitizedPlan,
            scenes: mappedScenes,
          };
        });

        console.log(
          `[Gemini Ideation] ${parsed.options.length} opções de roteiro (${duration}) geradas com sucesso usando ${model}.`
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

/**
 * Gera os metadados visuais e sonoros completos para uma cena individual (customizada ou editada)
 * utilizando Gemini Structured Outputs e alinhado aos padrões Mixed Media 2D/3D.
 */
export async function generateSingleScenePrompt(params: {
  theme: string;
  sceneText: string;
  speaker: SpeakerType;
  avatarConfig?: AvatarConfigInput;
  visualDescription?: string;
  protagonistAgency?: ProtagonistAgency;
}): Promise<{
  imagePrompt: string;
  visual_description: string;
  sfx_suggestion: string;
  sfx_label: string;
  sfx_prompt: string;
  avatarSprite: AvatarSprite;
}> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no backend/.env.');
  }

  const avatarDescriptor = buildAvatarPromptDescriptor(params.avatarConfig);
  const availableSfx = await listAllSfxOptions();

  const builder = new ScriptPromptBuilder()
    .withTheme(params.theme)
    .withAvatarDescriptor(avatarDescriptor)
    .withProtagonistAgency(params.protagonistAgency || 'chaos_agent')
    .withSfxOptions(availableSfx);

  const { systemInstruction, enumSlugs } = builder.buildSingleSceneInstruction({
    sceneText: params.sceneText,
    speaker: params.speaker,
    visualDescription: params.visualDescription,
  });

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      imagePrompt: { type: 'STRING' },
      visual_description: { type: 'STRING' },
      sfx_suggestion: { type: 'STRING', enum: enumSlugs },
      sfx_label: { type: 'STRING' },
      sfx_prompt: { type: 'STRING' },
      avatarSprite: { type: 'STRING', enum: [...VALID_AVATAR_SPRITES] },
    },
    required: [
      'imagePrompt',
      'visual_description',
      'sfx_suggestion',
      'sfx_label',
      'sfx_prompt',
      'avatarSprite',
    ],
  };

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      console.log(`[Gemini Ideation] Solicitando roteiro ao modelo ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      });

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        return JSON.parse(rawJson);
      }
    } catch (e) {
      console.warn(`[Gemini Single Scene Prompt] Falha no modelo ${model}:`, e);
    }
  }

  throw new Error('Falha ao gerar metadados visuais da cena com Gemini.');
}

export interface FinalScriptSceneInput {
  id?: string;
  speaker?: SpeakerType;
  text?: string;
  dialogues?: DialogueItem[];
  avatarSprite?: AvatarSprite;
  visual_description?: string;
  imagePrompt?: string;
  sfx_suggestion?: string;
  sfx_prompt?: string;
  sfx_label?: string;
  custom_sfx_url?: string | null;
  isCustom?: boolean;
}

/**
 * Revisa a sequência completa do Roteiro Final antes de avançar para a Etapa 2.
 * Analisa a narrativa completa e gera os prompts visuais em inglês para cenas extras autorais
 * ou cenas onde o usuário informou/editou a descrição do cenário.
 */
export async function reviewAndEnrichFinalScript(params: {
  theme: string;
  scenes: FinalScriptSceneInput[];
  avatarConfig?: AvatarConfigInput;
  protagonistAgency?: ProtagonistAgency;
  contentBalance?: ContentBalance;
}): Promise<ScriptScene[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no backend/.env.');
  }

  const avatarDescriptor = buildAvatarPromptDescriptor(params.avatarConfig);
  const availableSfx = await listAllSfxOptions();

  const builder = new ScriptPromptBuilder()
    .withTheme(params.theme)
    .withAvatarDescriptor(avatarDescriptor)
    .withProtagonistAgency(params.protagonistAgency || 'chaos_agent')
    .withContentBalance(params.contentBalance || 'balanced')
    .withSfxOptions(availableSfx);

  const { systemInstruction, enumSlugs } =
    builder.buildReviewFinalScriptInstruction(params.scenes.length);

  const formattedScenesText = params.scenes
    .map((s, idx) => {
      const customTag = s.isCustom ? ' [CENA EXTRA CRIADA PELO USUÁRIO]' : '';
      const visualDesc = s.visual_description?.trim()
        ? `\n  - Descrição do Cenário (escrita pelo utilizador): "${s.visual_description}"`
        : '';
      const existingPrompt =
        s.imagePrompt &&
        !s.isCustom &&
        !s.imagePrompt.includes('historical environment, illuminated')
          ? `\n  - Prompt Visual prévio: "${s.imagePrompt}"`
          : '';

      const dialoguesText =
        s.dialogues && s.dialogues.length > 0
          ? s.dialogues
              .map(
                (d, dIdx) =>
                  `\n  - Fala #${dIdx + 1} (${d.speaker}): "${d.text}"`
              )
              .join('')
          : `\n  - Locutor: "${s.speaker || 'protagonist'}"\n  - Fala / Legenda: "${s.text || ''}"`;

      return `Cena #${idx + 1}${customTag}:${dialoguesText}${visualDesc}${existingPrompt}`;
    })
    .join('\n\n');

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
              enum: ['protagonist', 'character', 'narrator'],
            },
            text: { type: 'STRING' },
            dialogues: {
              type: 'ARRAY',
              description: 'Lista das falas e locutores da cena preservados.',
              items: {
                type: 'OBJECT',
                properties: {
                  speaker: {
                    type: 'STRING',
                    enum: ['protagonist', 'character', 'narrator'],
                  },
                  characterName: {
                    type: 'STRING',
                    description:
                      'Nome da figura histórica ou papel (ex: Cleópatra, Napoleão) quando speaker for character.',
                  },
                  voiceId: {
                    type: 'STRING',
                    description:
                      'ID da voz de personagem escolhida no catálogo quando speaker for character.',
                  },
                  text: { type: 'STRING' },
                },
                required: ['speaker', 'text'],
              },
            },
            avatarSprite: {
              type: 'STRING',
              enum: [...VALID_AVATAR_SPRITES],
            },
            visual_description: { type: 'STRING' },
            imagePrompt: { type: 'STRING' },
            sfx_suggestion: { type: 'STRING', enum: enumSlugs },
            sfx_label: { type: 'STRING' },
            sfx_prompt: { type: 'STRING' },
          },
          required: [
            'speaker',
            'text',
            'dialogues',
            'avatarSprite',
            'visual_description',
            'imagePrompt',
            'sfx_suggestion',
            'sfx_label',
            'sfx_prompt',
          ],
        },
      },
    },
    required: ['scenes'],
  };

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
  ];

  for (const model of candidateModels) {
    try {
      console.log(`[Gemini Ideation] Solicitando roteiro ao modelo ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\n=== SEQUÊNCIA DO ROTEIRO FINAL SUBMETIDO PELO UTILIZADOR ===\n${formattedScenesText}`,
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
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
          console.log(
            `[Gemini Final Script Review] Roteiro final de ${parsed.scenes.length} cenas revisado e enriquecido com sucesso usando ${model}.`
          );
          const finalReviewedScenes = (
            parsed.scenes as ScriptScene[]
          ).map((reviewedScene, sIdx) => {
            const originalInput = params.scenes[sIdx];
            const incomingDialogues =
              reviewedScene.dialogues && reviewedScene.dialogues.length > 0
                ? reviewedScene.dialogues.map((d, dIdx) => ({
                    id:
                      originalInput?.dialogues?.[dIdx]?.id ||
                      `dlg_${sIdx}_${dIdx}`,
                    speaker: d.speaker || 'protagonist',
                    characterName:
                      d.characterName ||
                      originalInput?.dialogues?.[dIdx]?.characterName,
                    voiceId:
                      d.voiceId ||
                      originalInput?.dialogues?.[dIdx]?.voiceId,
                    text: d.text || '',
                  }))
                : originalInput?.dialogues && originalInput.dialogues.length > 0
                  ? originalInput.dialogues
                  : [
                      {
                        id: `dlg_${sIdx}_0`,
                        speaker:
                          reviewedScene.speaker ||
                          originalInput?.speaker ||
                          'protagonist',
                        characterName: originalInput?.dialogues?.[0]?.characterName,
                        voiceId: originalInput?.dialogues?.[0]?.voiceId,
                        text: reviewedScene.text || originalInput?.text || '',
                      },
                    ];

            return {
              ...reviewedScene,
              dialogues: incomingDialogues,
              speaker:
                incomingDialogues[0]?.speaker ||
                reviewedScene.speaker ||
                'protagonist',
              text:
                incomingDialogues.map((d) => d.text).join(' ') ||
                reviewedScene.text ||
                '',
              sfx_label:
                reviewedScene.sfx_label || originalInput?.sfx_label || '',
              custom_sfx_url:
                originalInput?.custom_sfx_url ?? null,
            };
          });

          // Higienização de Seamless Loop: remove pontuação terminal estritamente
          // da última fala do último orador da última cena
          if (finalReviewedScenes.length > 0) {
            const lastScene =
              finalReviewedScenes[finalReviewedScenes.length - 1];
            if (lastScene.dialogues && lastScene.dialogues.length > 0) {
              const lastDialogue =
                lastScene.dialogues[lastScene.dialogues.length - 1];
              lastDialogue.text = lastDialogue.text
                .replace(/[.!?:;…]+$/, '')
                .trim();
              lastScene.text = lastScene.dialogues
                .map((d) => d.text)
                .join(' ');
            } else if (lastScene.text) {
              lastScene.text = lastScene.text.replace(/[.!?:;…]+$/, '').trim();
            }
          }

          return finalReviewedScenes;
        }
      }
    } catch (e) {
      console.warn(`[Gemini Final Script Review] Falha no modelo ${model}:`, e);
    }
  }

  throw new Error('Falha ao revisar roteiro final com Google Gemini.');
}
