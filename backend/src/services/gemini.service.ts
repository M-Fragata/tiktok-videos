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
            },
          },
          required: [
            'speaker',
            'text',
            'dialogues',
            'avatarSprite',
            'imagePrompt',
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

/**
 * Pilar 1B (Motor de Ideação Mix & Match):
 * Gera 4 opções de roteiro completas com ângulos narrativos distintos
 * (Humor, Ação, Sombrio, Caótico) já injetando a aparência customizada do Avatar
 * nos prompts de imagem de cada cena.
 */
export async function generateTimeMachineIdeation(
  theme: string,
  durationPreset: DurationPreset = 'short',
  avatarConfig?: AvatarConfigInput,
  selectedBgmVibe?: string
): Promise<GeneratedIdeation> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ficheiro backend/.env.');
  }

  const rule = DURATION_RULES[durationPreset] || DURATION_RULES.short;
  const avatarDescriptor = buildAvatarPromptDescriptor(avatarConfig);

  const toneModifier =
    selectedBgmVibe && selectedBgmVibe !== 'auto'
      ? `\nDIRETRIZ DE TOM TRANSVERSAL: Adapte a linguagem, humor e tensão de todas as 4 opções ao tom "${selectedBgmVibe}" selecionado pelo utilizador.`
      : '';

  const systemInstruction = `És um roteirista sénior e Diretor de Arte especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts, gerando vídeos virais curtos no nicho "Máquina do Tempo / História".

A tua missão é criar um BRAINSTORMING DE ROTEIROS com EXATAMENTE 4 OPÇÕES de ARQUITETURA NARRATIVA distintas e com a técnica obrigatória de LOOP PERFEITO (Seamless Loop / Narrativa Circular), a partir do BRIEFING HISTÓRICO fornecido pelo utilizador:
1. id: "in_media_res" | badge: "⚡ In Media Res" -> O vídeo abre no ápice do caos, perigo ou fuga histórica (segundo zero). O desenvolvimento narra a cadeia de acontecimentos que levou àquela situação limite. A última cena engata a frase conectiva que explica a situação inicial.
2. id: "myth_buster" | badge: "🔍 Quebra de Mito" -> O vídeo abre com a afirmação categórica de um mito histórico popular chocante. O desenvolvimento desconstrói o boato com evidências documentadas e fatos verídicos. A última cena engata a causa da ilusão popular.
3. id: "witness_pov" | badge: "👁️ Testemunha Ocular" -> O espectador é colocado na pele de quem presenciou o evento histórico ("POV / Se você estivesse lá naquele dia"). O desenvolvimento traz imersão sensorial e detalhes em primeira mão. A última cena engata a condição testemunhal que completa a visão inicial.
4. id: "ticking_clock" | badge: "⏳ Corrida Contra o Tempo" -> O vídeo abre em contagem regressiva, corrida frenética ou urgência de sobrevivência. O desenvolvimento mostra a tensão frenética dos segundos finais. A última cena engata o gatilho da contagem que reinicia o ciclo de sobrevivência.${toneModifier}

TÍTULO VIRAL POR OPÇÃO (CAMPO "title" DE CADA OPÇÃO):
Para CADA uma das 4 opções, deves gerar um Título Viral ÚNICO, magnético e de alta retenção no estilo YouTube Shorts / TikTok (máximo 60 caracteres, com gancho instigante e emoji relevante).
Exemplos de bons títulos virais:
- "Sobrevivendo ao Tiro de Canhão em Gizé ⚔️" (In Media Res)
- "Napoleão NÃO Destruiu a Esfinge?! 😱" (Quebra de Mito)
- "Eu Vi a Coroa de César Cair no Chão 👁️" (Testemunha Ocular)
- "3 Segundos Antes de Pompeia Desaparecer ⏳" (Corrida Contra o Tempo)
NUNCA uses títulos genéricos como "Opção 1" ou "Loop". Cria sempre um título focado no tema e gancho do vídeo!

PERSONALIDADE E ESTILO DE VOZ DO PROTAGONISTA ("protagonist" / BILLY) — OBRIGATÓRIO:
O protagonista é um aventureiro curioso, expressivo, meio atrapalhado e com energia caótica. Ele NUNCA fala como um professor formal ou apresentador de TV.
1. NATURALIDADE COLOQUIAL E DESCONTRAÍDA:
   - Use português brasileiro coloquial, fluído e dinâmico, exatamente como alguém contando um absurdo ou fofoca inacreditável para um amigo.
   - Use contrações e gírias leves do cotidiano: "pra", "tá", "né", "olha só", "peraí", "cara", "sério", "deu ruim", "bizarro".
   - Frases curtas e diretas. Evite construções rebuscadas (proibido usar mesóclise, termos como "outrossim", "portanto", "com efeito" ou vocabulário pedante).
2. RITMO E REAÇÕES ESPONTÂNEAS:
   - Inclua reações viscerais e cômicas no meio da fala: "Espera aí...", "O quê?!", "Caramba...", "Não, sério mesmo?", "Bom... deu ruim."
   - Quando confrontado com perigo ou erro, a fala deve transmitir desespero cômico ou cara de pau ("Bom, a culpa não foi totalmente minha...").

DINÂMICA EM DUPLA (NARRADOR SÉRIO x PROTAGONISTA ATRAPALHADO):
1. DIVISÃO ORGÂNICA DE PAPÉIS:
   - "narrator": Estilo documental e voz da razão. Expõe fatos históricos exatos, datas, locais e contexto real com precisão e sobriedade.
   - "protagonist": O protagonista leigo e caótico. Interrompe, questiona o narrador, tira conclusões precipitadas e se mete em apuros físicos na cena.
   - "character": Personagens de época (generais, imperadores, líderes) falam com pompa histórica ou solenidade de época. O humor surge do choque imediato entre a solenidade histórica e as respostas sarcásticas/rápidas do protagonista.
2. BATE-BOLA ÁGIL NAS CENAS (1 A 3 FALAS POR CENA):
   - Alterne organicamente entre cenas solo e cenas com diálogo duplo (1 a 3 falas curtas e rápidas por cena).
   - Exemplo de bate-bola ágil:
     * Fala 1 [narrator]: "Em 1798, tropas francesas marcharam em Gizé..."
     * Fala 2 [protagonist]: "E aí alguém achou uma boa ideia mirar um canhão no monumento?!"

TÉCNICA MANDATÓRIA: LOOP PERFEITO (SEAMLESS LOOP / NARRATIVA CIRCULAR):
Cada uma das 4 opções DEVE possuir um loop 100% contínuo e imperceptível quando o player do TikTok/Shorts reiniciar do fim para o começo!

1. CAMPO "narrative_plan" (PLANEJADO OBRIGATORIAMENTE ANTES DAS CENAS):
Para CADA opção, deves planejar a ponte sintática no objeto "narrative_plan":
- "architecture_id": ID da arquitetura ("in_media_res", "myth_buster", "witness_pov" ou "ticking_clock").
- "hook_type": Tipo específico do gancho (ex: "action_climax", "paradox_split", "sensory_pov", "countdown_ticking").
- "core_revelation": Fato histórico central revelado na opção. REGRA OBRIGATÓRIA: Se o briefing contiver 4 ou mais fatos/detalhes, cada uma das 4 opções DEVE ancorar em uma "core_revelation" distinta!
- "bridge_speaker": O orador responsável pela ponte circular (ESTRITAMENTE "protagonist" ou "narrator").
- "bridge_full_sentence": A frase ÚNICA e COMPLETA que faz a ponte circular inteira.
- "loop_closing_fragment": O fragmento FINAL da frase (colocado no término da ÚLTIMA cena).
- "loop_opening_fragment": O fragmento INICIAL da frase (colocado no início da PRIMEIRA cena).
A concatenação exata deve ser gramaticalmente perfeita:
bridge_full_sentence = loop_closing_fragment + " " + loop_opening_fragment.

2. REGRA DO ORADOR DA PONTE CIRCULAR ("bridge_speaker"):
- O campo "bridge_speaker" no "narrative_plan" DEVE ser ESTRITAMENTE "protagonist" ou "narrator" (NUNCA use "character").
- REGRA DE OURO DE CONTINUIDADE DE ÁUDIO: Para que a transição de áudio não sofra quebra brusca de voz ao reiniciar o vídeo, a primeira fala da Cena 1 ("loop_opening_fragment") e a última fala da última cena ("loop_closing_fragment") DEVEM OBRIGATORIAMENTE PERTENCER AO MESMO ORADOR ("bridge_speaker")!
  * Se bridge_speaker for "protagonist", a Cena 1 deve abrir com o protagonista e a última fala do vídeo deve ser dita pelo protagonista.
  * Se bridge_speaker for "narrator", a Cena 1 deve abrir com o narrador e a última fala do vídeo deve ser dita pelo narrador.

3. TEMPLATES SINTÁTICOS CIRÚRGICOS POR ARQUITETURA:
- "in_media_res":
  * loop_closing_fragment: "...e agora você entende exatamente por que eu estava"
  * loop_opening_fragment: "correndo desesperado de 50 legionários romanos pelas ruas de Roma!"
  * bridge_full_sentence: "E agora você entende exatamente por que eu estava correndo desesperado de 50 legionários romanos pelas ruas de Roma!"
- "myth_buster":
  * loop_closing_fragment: "...e foi essa gravura de 1737 que provou para os historiadores que"
  * loop_opening_fragment: "Napoleão nunca atirou canhões contra a Esfinge!"
  * bridge_full_sentence: "E foi essa gravura de 1737 que provou para os historiadores que Napoleão nunca atirou canhões contra a Esfinge!"
- "witness_pov":
  * loop_closing_fragment: "...se você estivesse no meu lugar em 44 antes de Cristo, a única coisa que você veria era"
  * loop_opening_fragment: "a coroa de César rolando no chão de mármore do Senado!"
  * bridge_full_sentence: "Se você estivesse no meu lugar em 44 antes de Cristo, a única coisa que você veria era a coroa de César rolando no chão de mármore do Senado!"
- "ticking_clock":
  * loop_closing_fragment: "...e faltando três segundos para a erupção engolir Pompeia, o único reflexo que me restava era"
  * loop_opening_fragment: "correr em direção ao mar antes da cinza cobrir o céu!"
  * bridge_full_sentence: "E faltando três segundos para a erupção engolir Pompeia, o único reflexo que me restava era correr em direção ao mar antes da cinza cobrir o céu!"

4. BLACKLIST RÍGIDA DE ANTI-PADRÕES (DIRETRIZES NEGATIVAS ESTRITAS):
- PROIBIÇÃO ABSOLUTA DE PONTUAÇÃO FINAL NA CENA FINAL:
  A última fala da última cena (em "text" e no último item de "dialogues") e o "loop_closing_fragment" NUNCA PODEM TERMINAR COM PONTO FINAL (.), EXCLAMAÇÃO (!), INTERROGAÇÃO (?) OU RETICÊNCIAS (…). Devem terminar na palavra conectiva sem pontuação terminal (ex: "...que provou que" ou "...por que eu estava"). Pontuações forçam o sintetizador de voz (TTS) a decair o tom e criar silêncio, destruindo o loop!
- PROIBIÇÃO ABSOLUTA DE CTAs:
  NUNCA coloque pedidos de like, inscrição, comentários ou compartilhamento ("deixe seu like", "se inscreva", "comente", "siga o canal").
- PROIBIÇÃO DE BORDÕES CONCLUSIVOS:
  NUNCA use "E essa foi a história de...", "No fim das contas...", "Moral da história...", "Até a próxima".
- PROIBIÇÃO DE SAUDAÇÕES DE ABERTURA:
  A Cena 1 DEVE começar diretamente com a ação/revelação ("loop_opening_fragment"). NUNCA comece com "Fala galera", "Olá viajantes" ou "Hoje eu vou contar...".

EXEMPLO FEW-SHOT DA ESTRUTURA DE UMA OPÇÃO (BATE-BOLA BILLY x NARRADOR):
{
  "id": "myth_buster",
  "title": "Napoleão NÃO Destruiu a Esfinge?! 😱",
  "badge": "🔍 Quebra de Mito",
  "description": "Desconstrução do boato de Napoleão com gravuras anteriores a 1798.",
  "bgmVibe": "fun",
  "narrative_plan": {
    "architecture_id": "myth_buster",
    "hook_type": "paradox_split",
    "core_revelation": "O monumento já não tinha nariz muito antes das tropas francesas chegarem ao Egito.",
    "bridge_speaker": "protagonist",
    "bridge_full_sentence": "E foi essa gravura de 1737 que provou para os historiadores que Napoleão nunca atirou canhões contra a Esfinge!",
    "loop_closing_fragment": "e foi essa gravura de 1737 que provou para os historiadores que",
    "loop_opening_fragment": "Napoleão nunca atirou canhões contra a Esfinge!"
  },
  "scenes": [
    {
      "speaker": "protagonist",
      "text": "Napoleão nunca atirou canhões contra a Esfinge! Mas até hoje quase todo mundo repete esse absurdo.",
      "dialogues": [
        { "speaker": "protagonist", "text": "Napoleão nunca atirou canhões contra a Esfinge! Mas até hoje quase todo mundo repete esse absurdo." }
      ],
      "avatarSprite": "avatars/avatar_shocked.png",
      "visual_description": "Gizé sob sol escaldante: o protagonista no topo da Esfinge apontando chocado para gravuras antigas.",
      "imagePrompt": "Mixed media 2D/3D illustration...",
      "sfx_suggestion": "record-scratch",
      "sfx_prompt": "Abrupt comedic vinyl record scratch sudden stop..."
    },
    {
      "speaker": "narrator",
      "text": "Em 1798, as tropas francesas marcharam pelo deserto egípcio. Peraí... então o Napoleão levou a culpa de graça?!",
      "dialogues": [
        { "speaker": "narrator", "text": "Em 1798, as tropas francesas marcharam pelo deserto egípcio." },
        { "speaker": "protagonist", "text": "Peraí... então o Napoleão levou a culpa de graça?!" }
      ],
      "avatarSprite": "avatars/avatar_confused.png",
      "visual_description": "O protagonista coça a cabeça confuso enquanto tropas napoleônicas marcham ao fundo.",
      "imagePrompt": "Mixed media 2D/3D illustration...",
      "sfx_suggestion": "cartoon-blink",
      "sfx_prompt": "Playful cartoon eye blink sound effect..."
    },
    {
      "speaker": "narrator",
      "text": "O explorador Frederic Norden desenhou a estátua mutilada décadas antes dos franceses chegarem, e foi essa gravura de 1737 que provou para os historiadores que",
      "dialogues": [
        { "speaker": "narrator", "text": "O explorador Frederic Norden desenhou a estátua mutilada décadas antes dos franceses chegarem," },
        { "speaker": "protagonist", "text": "e foi essa gravura de 1737 que provou para os historiadores que" }
      ],
      "avatarSprite": "avatars/avatar_determined.png",
      "visual_description": "O protagonista desenrola um pergaminho antigo de 1737 mostrando a Esfinge sem o nariz no deserto.",
      "imagePrompt": "Mixed media 2D/3D illustration...",
      "sfx_suggestion": "footsteps-stone",
      "sfx_prompt": "Ancient paper unfurling sound effect with soft desert wind..."
    }
  ]
}

INTERPRETAÇÃO INTELIGENTE DO BRIEFING DO UTILIZADOR:
- SE O UTILIZADOR DETALHAR CENAS ESPECÍFICAS NO BRIEFING (ex: "Cena 1: ...", "Cena 2: ..." ou tópicos narrativos):
  Segue rigorosamente essa ordem cronológica e progressão de acontecimentos em TODAS as 4 opções, adaptando o tom das falas ("text"), as emoções/sprites do avatar e as piadas/tensão ao estilo específico de cada ângulo.
- SE O UTILIZADOR FORNECER APENAS O CONTEXTO OU FATOS GERAIS:
  Estrutura livremente a história dividindo-a em Gancho, Desenvolvimento e Clímax com base nos fatos fornecidos.

Duração Selecionada para CADA uma das 4 opções (${rule.label}):
- Estrutura por opção: ${rule.sceneRange} (total de ~${rule.targetSeconds} segundos de fala por opção).
- CONTAGEM OBRIGATÓRIA DE PALAVRAS POR OPÇÃO: A soma de todas as falas ("text") de cada opção DEVE CONTER OBRIGATORIAMENTE ENTRE ${rule.minWords} E ${rule.maxWords} PALAVRAS! É expressamente proibido gerar menos de ${rule.minWords} palavras no total de uma opção, pois o áudio ficaria incompleto.
- Em média, cada cena de desenvolvimento deve conter ${rule.avgWordsPerScene}.

DESCRIÇÃO VISUAL DO CENÁRIO EM PORTUGUÊS ("visual_description"):
Para CADA cena, gera uma descrição em PORTUGUÊS (1 frase concisa e cinematográfica) no campo "visual_description" resumindo o que aparece no cenário e o que o personagem está fazendo (ex: "Gizé em 1798 sob o sol escaldante: o viajante sobe no topo da cabeça da Esfinge enquanto soldados e mercadores se aglomeram furiosos lá embaixo").
Esta descrição será lida pelo criador do vídeo no topo do cartão da cena para entender o visual antes da fala.

${VIRAL_PACING_INSTRUCTION}

APARÊNCIA CUSTOMIZADA DO AVATAR PROTAGONISTA (OBRIGATÓRIO EM TODOS OS "imagePrompt"):
O utilizador configurou o protagonista no Camarim 360º com a seguinte aparência exata:
"${avatarDescriptor}"

DIRETRIZES OBRIGATÓRIAS DE ENGENHARIA DE PROMPT VISUAL ("imagePrompt" — ESTILO MIXED MEDIA 2D/3D):
Cada "imagePrompt" DEVE ser escrito em INGLÊS e estruturado para difusão (FLUX / Imagen), garantindo dinamismo e coerência:

1. ESTRUTURA DO PROMPT POR CENA:
   Inicie SEMPRE o prompt com:
   "Mixed media 2D/3D illustration, a ${avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA DA CENA], [POSE E AÇÃO DINÂMICA DO PERSONAGEM], [CENÁRIO HISTÓRICO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."

2. EXPRESSÕES FACIAIS E POSES NUNCA DEVEM SER REPETIDAS NEM ESTÁTICAS:
   - É expressamente PROIBIDO colocar "with hands on hips" ou expressão cocky/confiante em todas as cenas!
   - A EXPRESSÃO FACIAL DEVE variar cena a cena de acordo com a emoção do momento e o "avatarSprite" escolhido:
     * talking/narrando: "expressive speaking face with open animated mouth and lively eyes"
     * shocked/surpreso: "shocked face with wide circular eyes and dropped jaw in disbelief"
     * scared/em pânico: "panicking face with wide frightened eyes, raised eyebrows and cartoon sweat drops"
     * happy/aliviado: "beaming cheerful grin with friendly eyes"
     * angry/determinado: "focused determined grimace with intense furrowed brows"
     * laughing/cômico: "laughing cheerful expression with squinched comic eyes"
     * thinking/curioso: "curious thoughtful squint looking up, one eyebrow raised"
     * wink/irônico: "cheeky one-eye wink with subtle smirk"
   - A POSE E AÇÃO FÍSICA DEVE ser ativa e específica da cena:
     * escalando a rocha histórica com uma das mãos na borda (corpo inclinado e pé apoiado, como na referência)
     * correndo assustado com pernas de palito em movimento acelerado e bandana esvoaçando ao vento
     * escorregando e se desequilibrando de forma cômica
     * apontando com o braço de palito estendido para a multidão ou monumento
     * espiando cautelosamente por trás de uma estátua ou coluna de pedra
     * quebrando a 4ª parede olhando diretamente para a câmara com expressão de culpa

3. ANATOMIA E REGRA GERAL DE TODOS OS PERSONAGENS (PROTAGONISTA E SECUNDÁRIOS):
   - TRONCO BRANCO COM ESPESSURA: Tanto o protagonista quanto qualquer personagem devem ter tronco branco com espessura visível (cápsula/torso branco 2D contornado a nanquim, similar a Henry Stickmin). É expressamente PROIBIDO gerar o tronco como uma linha única de palito (evitar tronco de fio único).
   - BRAÇOS E PERNAS DE PALITO: Apenas os braços e pernas são traços pretos finos de palito.
   - TODOS OS PERSONAGENS NO MESMO ESTILO: Figuras secundárias, soldados de Napoleão, Sa'im al-Dahr, sacerdotes, operários e multidões históricas DEVEM ser desenhados no MESMO formato de cartoon 2D:
     "all secondary characters and historical figures are also stylized 2D cartoon stickmen with smooth round white heads, distinct solid white capsule torsos with thickness, and thin stick limbs, wearing cartoon historical costumes (e.g. 18th-century military coats, turbans, robes). ABSOLUTELY NO photorealistic human skin or realistic human faces."

4. CENÁRIO 3D REALISTA E ILUMINAÇÃO:
   - O cenário de fundo é renderizado como ambiente 3D cinematográfico ultra-realista com texturas ricas de pedra, poeira e areia.
   - Os personagens 2D interagem fisicamente e projetam sombras 3D realistas sobre o solo e pedras.

DIRETRIZES DE TRILHA SONORA (BGM) E DESIGN DE SOM (SFX):
1. TRILHA SONORA POR OPÇÃO ("bgmVibe"):
   Como Diretor de Som do estúdio, deves escolher para CADA uma das 4 opções a trilha sonora ideal ("bgmVibe") que melhor amplifica o tom daquele ângulo:
   - "comedy": Humor, ironia, vlog cómico ou desmistificação com quebra de mitos (bgm/music/funny-vlog.mp3)
   - "fun": Curiosidade leve, descoberta divertida e tom descontraído (bgm/music/fun-light.mp3)
   - "action": Corrida contra o tempo, perigo e adrenalina máxima (bgm/music/action-run.mp3)
   - "hiphop": Batida épica moderna, ritmo veloz ou corte caótico (bgm/music/epic-hiphop.mp3)
   - "dark": Conspirações, segredos proibidos, mistério denso e tensão (bgm/music/dark.mp3)
   - "piano": Mistério refinado, investigação histórica e tensão clássica (bgm/music/fast-piano.mp3)
   - "adventure": Expedições arqueológicas, descobrimentos e aventura (bgm/music/mountain-intro.mp3)
   - "epic": Batalhas lendárias e monumentos grandiosos (bgm/music/epic.mp3)
   - "none": Sem música de fundo (foco total na voz/efeitos)

2. EFEITOS SONOROS POR CENA ("sfx_suggestion"):
   A nossa biblioteca de áudio possui efeitos cirúrgicos. Para CADA cena, escolhe ESTRITAMENTE um dos seguintes identificadores (ou "none"):
   - "cannon-artillery": Tiros de canhão, artilharia militar, bombas, explosões ou batalhas bélicas (ex: quando o roteiro cita as tropas de Napoleão atirando).
   - "record-scratch": Parada brusca de som / quebra de 4ª parede, quando o viajante desmente um mito histórico ou confessa a sua culpa olhando para a câmara.
   - "cartoon-blink": Momento cômico, piscada de olhos, confusão engraçada do viajante, cara de bobo.
   - "riser-hit": Gancho tenso inicial (Cena 1), revelação chocante que prende o espectador.
   - "heartbeat": Tensão máxima, batimentos cardíacos acelerados, suspense antes de um desastre.
   - "metal-hits": Ferramentas quebrando pedra, marretadas, impacto mecânico ou armaduras.
   - "sword-clash": Choque de espadas em duelo ou combate medieval.
   - "sword-draw": Desembainhar lâmina ou preparação para confronto.
   - "footsteps-stone": Passos cautelosos em tumbas egípcias, pirâmides ou corredores de pedra.
   - "piano-flourish": Floreio de piano elegante, ironia sutil ou conclusão refinada.
   - "trex-roar" ou "trex-roar-fight": Feras perigosas, dinossauros ou criaturas monstruosas.
   - "whoosh" ou "swoosh": Transição rápida de cena ou movimento dinâmico.
   - "none": Se a cena não precisa de efeito sonoro no corte.

3. PROMPT DE DESIGN DE SOM TEXT-TO-SFX ("sfx_prompt"):
   Para CADA cena, deves escrever um prompt acústico descritivo e expressivo em INGLÊS no campo "sfx_prompt" (1 a 2 frases curtas) pronto para a API de Sound Effects da ElevenLabs. Descreva o timbre, reverberação, distância e ação física do som.
   Exemplos:
   - "Loud explosive blast of an 18th-century military cannon in a sandy desert, deep thunderous echoing rumble with falling sand debris."
   - "Abrupt comedic vinyl record scratch sudden stop, followed by awkward silence and a tiny cartoon pop."
   - "Playful cartoon eye blink sound effect with a gentle spring boing and cheeky comic chime."
   - "Tense cinematic riser crescendo building into a deep dramatic impact hit with sub bass."
   - "Eerie stone footsteps echoing in an ancient Egyptian tomb corridor with subtle whispering wind."

DIRETRIZES DE DIÁLOGOS E INTERAÇÃO MULTI-VOZ POR CENA ("dialogues"):
Na nossa arquitetura, cada cena pode conter UMA FALA DIRETA ou UMA INTERAÇÃO ENTRE PERSONAGENS (1 a 3 falas sequenciais no array "dialogues").
1. DECISÃO ORGÂNICA / CONTEXTUAL:
   - Cenas com 1 fala única: Quando um personagem narra ou expressa um pensamento contínuo.
     Exemplo: dialogues: [{ "speaker": "protagonist", "text": "..." }]
   - Cenas com Diálogo / Interação (2 a 3 falas): Quando a cena pede um confronto, réplica, pergunta e resposta ou comentário irônico.
     Qualquer combinação entre "protagonist", "character" e "narrator" é bem-vinda (Protagonista x Personagem, Personagem x Personagem, ou Protagonista x Narrador pontuando).
     Exemplo:
       dialogues: [
         { "speaker": "protagonist", "text": "Espera aí... foram vocês mesmos que quebraram a estátua?!" },
         { "speaker": "character", "text": "Ninguém tocou nela! Foi um tiro de canhão perdido das tropas de Napoleão!" }
       ]
2. RITMO E LIMITE DE PALAVRAS:
   - A divisão de palavras entre as falas do diálogo é livre pelo roteirista para soar natural, mas a soma de todas as falas de todas as cenas da opção DEVE obrigatoriamente respeitar o piso e teto global (${rule.minWords} a ${rule.maxWords} palavras).
3. INTERAÇÃO VISUAL OBRIGATÓRIA NO "imagePrompt" E "visual_description":
   - Quando a cena contiver diálogo entre personagens (ex: protagonist e character), o "imagePrompt" e a "visual_description" DEVEM OBRIGATORIAMENTE retratar AMBOS os personagens interagindo e contracenando no mesmo cenário!
   - Exemplo no "imagePrompt": "The stickman protagonist in forehead goggles is looking shocked and arguing with an ancient Egyptian worker stickman holding a copper chisel, who is angrily pointing back at the monument. Both 2D cartoon characters with smooth white capsule torsos..."
   - Exemplo na "visual_description": "O viajante confronta um operário egípcio na base da pirâmide, enquanto o trabalhador gesticula irritado segurando um cinzel de cobre."
4. CAMPOS DA RAIZ:
   - O campo "speaker" na raiz da cena deve refletir o orador da primeira fala de "dialogues", e o campo "text" deve conter o texto consolidado da cena.

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
        enum: [
          'cannon-artillery',
          'record-scratch',
          'cartoon-blink',
          'riser-hit',
          'heartbeat',
          'metal-hits',
          'sword-clash',
          'sword-draw',
          'footsteps-stone',
          'piano-flourish',
          'trex-roar',
          'trex-roar-fight',
          'whoosh',
          'swoosh',
          'none',
        ],
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
}): Promise<{
  imagePrompt: string;
  visual_description: string;
  sfx_suggestion: string;
  sfx_prompt: string;
  avatarSprite: AvatarSprite;
}> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no backend/.env.');
  }

  const avatarDescriptor = buildAvatarPromptDescriptor(params.avatarConfig);

  const visualHint = params.visualDescription?.trim()
    ? `\nDescrição do Cenário fornecida pelo Utilizador: "${params.visualDescription}"\nIMPORTANTE: Deves basear a ação, pose e elementos do "imagePrompt" estritamente nas orientações fornecidas pelo utilizador nesta descrição do cenário!`
    : '';

  const systemInstruction = `És o Diretor de Arte e Som especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts.
A tua tarefa é gerar os metadados visuais e sonoros cinematográficos para UMA CENA específica de vídeo curto a partir do briefing histórico, da fala do locutor e da descrição do cenário do utilizador.

Contexto Geral do Vídeo: "${params.theme}"
Locutor da Cena: "${params.speaker}"
Fala da Cena: "${params.sceneText}"${visualHint}

Aparência base do protagonista configurada no Camarim:
"${avatarDescriptor}"

DIRETRIZES OBRIGATÓRIAS DO PROMPT VISUAL ("imagePrompt" — EM INGLÊS):
- Inicie SEMPRE com: "Mixed media 2D/3D illustration, a ${avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA], [POSE E AÇÃO DINÂMICA DA CENA BASEADA NO CENÁRIO DO USUÁRIO], [CENÁRIO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
- Expressão facial dinâmica adaptada à emoção exata da fala (talking, shocked, scared, happy, angry, laughing, thinking, etc.).
- Pose e ação física ativas no cenário histórico 3D (ex: escalando pedras, correndo, tropeçando, apontando, espiando, etc. NUNCA estático com mãos na cintura!).
- Tronco branco com espessura (cápsula 2D branca contornada a nanquim), braços e pernas de palito (NUNCA tronco de linha única de palito).
- Se houver personagens secundários, soldados ou multidão, TODOS devem ser 2D cartoon stickmen com cabeça redonda branca, tronco branco com espessura e roupas históricas em nanquim (NUNCA humanos fotorrealistas).

DIRETRIZES DE DESCRIÇÃO VISUAL EM PORTUGUÊS ("visual_description"):
- Se o utilizador já forneceu uma descrição, preserva-a ou aprimora-a em uma frase cinematográfica concisa em PORTUGUÊS resumindo a ação visual para o criador.

DIRETRIZES DE DESIGN DE SOM:
- "sfx_suggestion": Escolha o som ideal da biblioteca local condizente com a ação: "cannon-artillery", "record-scratch", "cartoon-blink", "riser-hit", "heartbeat", "metal-hits", "sword-clash", "sword-draw", "footsteps-stone", "piano-flourish", "trex-roar", "whoosh", "none".
- "sfx_prompt": Prompt acústico descritivo em inglês para a API ElevenLabs condizente com o cenário.

AVATAR SPRITE:
- "avatarSprite": Uma destas opções: ${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}.`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      imagePrompt: { type: 'STRING' },
      visual_description: { type: 'STRING' },
      sfx_suggestion: { type: 'STRING' },
      sfx_prompt: { type: 'STRING' },
      avatarSprite: { type: 'STRING', enum: [...VALID_AVATAR_SPRITES] },
    },
    required: [
      'imagePrompt',
      'visual_description',
      'sfx_suggestion',
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
}): Promise<ScriptScene[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no backend/.env.');
  }

  const avatarDescriptor = buildAvatarPromptDescriptor(params.avatarConfig);

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

  const systemInstruction = `És o Roteirista-Chefe e Diretor de Arte do Fragata Shorts.
O utilizador acabou de submeter a sequência completa do seu "Roteiro Final" (${params.scenes.length} cenas) na sala de ideação.
Ele pode ter selecionado cenas de ideias prévias e/ou criado CENAS EXTRAS AUTORAIS, informando quem fala, a fala e a descrição do cenário em cada uma.

Contexto Geral / Título do Vídeo: "${params.theme}"

Aparência base do protagonista configurada no Camarim:
"${avatarDescriptor}"

A TUA MISSÃO AO REVISAR E APROVAR O ROTEIRO:
1. DEVES RETORNAR EXATAMENTE ${params.scenes.length} CENAS NA MESMA ORDEM CRONOLÓGICA.
2. PRESERVA rigorosamente as falas ("dialogues" ou "text") e os locutores ("speaker") de cada cena conforme definidos pelo utilizador.
3. INTERAÇÃO MULTI-VOZ NO PROMPT VISUAL ("imagePrompt"):
   - Se uma cena contiver múltiplos diálogos entre personagens (ex: protagonist e character), o "imagePrompt" e a "visual_description" DEVEM OBRIGATORIAMENTE retratar visualmente a interação e contracena física entre ambos os personagens (ex: o viajante gesticulando ou surpreso enquanto o personagem histórico reage ativamente no ambiente).
4. GERAÇÃO DE PROMPTS VISUAIS ("imagePrompt" em INGLÊS):
   - PARA CENAS EXTRAS CRIADAS PELO UTILIZADOR OU CENAS COM DESCRIÇÃO DE CENÁRIO:
     DEVES OBRIGATORIAMENTE basear o "imagePrompt" nas informações, ações, monumentos e detalhes que o utilizador colocou na "Descrição do Cenário" ("visual_description") e nas falas ("dialogues" / "text")!
   - Se uma cena já tiver um prompt visual completo e adequado que já represente bem a cena, podes preservá-lo garantindo a qualidade.
5. DIRETRIZES OBRIGATÓRIAS DO "imagePrompt" (MIXED MEDIA 2D/3D):
   - Inicie SEMPRE com: "Mixed media 2D/3D illustration, a ${avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA], [POSE E AÇÃO DINÂMICA BASEADA NA DESCRIÇÃO DO CENÁRIO], [CENÁRIO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
   - O protagonista e TODOS os personagens secundários/soldados/multidões DEVEM ser 2D cartoon stickmen com cabeça redonda branca, tronco branco com espessura (cápsula 2D contornada a nanquim, NUNCA linha de palito única) e membros de palito.
   - NUNCA repita a mesma expressão ou pose em todas as cenas (varie de acordo com a emoção e a ação descrita).
6. DESCRIÇÃO VISUAL EM PORTUGUÊS ("visual_description"):
   - Preenche ou aprimora a descrição em português com uma frase cinematográfica clara resumindo a cena para o criador.
7. DESIGN DE SOM:
   - "sfx_suggestion": Escolhe o som ideal da biblioteca local condizente com a ação ("cannon-artillery", "record-scratch", "cartoon-blink", "riser-hit", "heartbeat", "metal-hits", "sword-clash", "sword-draw", "footsteps-stone", "piano-flourish", "trex-roar", "whoosh", "none").
   - "sfx_prompt": Prompt acústico descritivo em inglês para a API ElevenLabs condizente com o cenário.
8. EXPRESSÃO DO AVATAR ("avatarSprite"):
   - Escolha o sprite mais adequado para a emoção da fala entre: ${VALID_AVATAR_SPRITES.map((s) => `"${s}"`).join(', ')}.
9. LOOP PERFEITO / SEAMLESS LOOP NO ROTEIRO FINAL:
   - Verifique a transição entre a última fala da última cena e a primeira fala da Cena 1.
   - A última fala da última cena NUNCA deve ter encerramento conclusivo ou CTA ("se inscreva", "deixe o like"), e JAMAIS deve terminar com pontuação terminal (sem ponto final, sem exclamação, sem reticências).
   - A última fala deve atuar como conector sintático natural em direção ao gancho de abertura da Cena 1.
10. ESTILO DO PROTAGONISTA (BILLY) E DINÂMICA EM DUPLA:
   - O protagonista ("protagonist" / Billy) expressa-se em português coloquial brasileiro, com reações viscerais ("Peraí...", "O quê?!", "Caramba...", "deu ruim"), contrações ("pra", "tá", "né") e zero afetação de professor.
   - O narrador ("narrator") mantém a postura documental e sóbria dos fatos, contracenando em bate-bola com o protagonista.`;

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
            sfx_suggestion: { type: 'STRING' },
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
