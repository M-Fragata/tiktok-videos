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

export interface ScriptScene {
  speaker: SpeakerType;
  text: string;
  avatarSprite: AvatarSprite;
  visual_description?: string;
  imagePrompt: string;
  sfx_suggestion?: string;
  sfx_prompt?: string;
  custom_sfx_url?: string | null;
}

export interface IdeationScriptOption {
  id: 'humor' | 'action' | 'dark' | 'chaotic' | string;
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
    label: 'Longo (60s • 130 a 150 palavras)',
    sceneRange: '8 a 12 cenas dinâmicas (~4 a 6s por cena)',
    minWords: 130,
    maxWords: 150,
    targetSeconds: 60,
    avgWordsPerScene: '11 a 15 palavras por cena',
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

A tua missão é criar um BRAINSTORMING DE ROTEIROS com EXATAMENTE 4 OPÇÕES de ângulos narrativos distintos a partir do BRIEFING HISTÓRICO fornecido pelo utilizador:
1. id: "humor" | badge: "😂 Humor" -> Abordagem cómica, sarcástica, destacando o absurdo quotidiano ou quebrando mitos com ironia.
2. id: "action" | badge: "⚔️ Ação" -> Ritmo frenético, perigo iminente, adrenalina no olho do furacão histórico.
3. id: "dark" | badge: "🌑 Sombrio" -> Atmosfera densa, segredos ocultos, tensão psicológica, teorias e conspirações históricas.
4. id: "chaotic" | badge: "🔥 Caótico" -> Ritmo imprevisível, reviravoltas rápidas e choque extremo do viajante do tempo.

TÍTULO VIRAL POR OPÇÃO (CAMPO "title" DE CADA OPÇÃO):
Para CADA uma das 4 opções, deves gerar um Título Viral ÚNICO, magnético e de alta retenção no estilo YouTube Shorts / TikTok (máximo 60 caracteres, com gancho instigante e emoji relevante).
Exemplos de bons títulos virais:
- "Napoleão NÃO Destruiu a Esfinge?! 😱" (Humor/Curiosidade)
- "Sobrevivendo ao Tiro de Canhão em Gizé ⚔️" (Ação)
- "O Segredo Sombrio do Nariz da Esfinge 🌑" (Sombrio)
- "Como o Nariz da Esfinge Sumiu de Verdade?! 🔥" (Caótico)
NUNCA uses títulos genéricos como "Humor & Ironia" ou "Ação & Sobrevivência". Cria sempre um título focado no tema e gancho do vídeo!

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
      'avatarSprite',
      'visual_description',
      'imagePrompt',
      'sfx_suggestion',
      'sfx_prompt',
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
            scenes: {
              type: 'ARRAY',
              items: sceneItemSchema,
            },
          },
          required: ['id', 'title', 'badge', 'description', 'bgmVibe', 'scenes'],
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

  const systemInstruction = `És o Diretor de Arte e Som especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts.
A tua tarefa é gerar os metadados visuais e sonoros cinematográficos para UMA CENA específica de vídeo curto a partir do briefing histórico e da fala do locutor.

Contexto Geral do Vídeo: "${params.theme}"
Locutor da Cena: "${params.speaker}"
Fala da Cena: "${params.sceneText}"

Aparência base do protagonista configurada no Camarim:
"${avatarDescriptor}"

DIRETRIZES OBRIGATÓRIAS DO PROMPT VISUAL ("imagePrompt" — EM INGLÊS):
- Inicie SEMPRE com: "Mixed media 2D/3D illustration, a ${avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA], [POSE E AÇÃO DINÂMICA DA CENA], [CENÁRIO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
- Expressão facial dinâmica adaptada à emoção exata da fala (talking, shocked, scared, happy, angry, laughing, thinking, etc.).
- Pose e ação física ativas no cenário histórico 3D (ex: escalando pedras, correndo, tropeçando, apontando, espiando, etc. NUNCA estático com mãos na cintura!).
- Tronco branco com espessura (cápsula 2D branca contornada a nanquim), braços e pernas de palito (NUNCA tronco de linha única de palito).
- Se houver personagens secundários, soldados ou multidão, TODOS devem ser 2D cartoon stickmen com cabeça redonda branca, tronco branco com espessura e roupas históricas em nanquim (NUNCA humanos fotorrealistas).

DIRETRIZES DE DESCRIÇÃO VISUAL EM PORTUGUÊS ("visual_description"):
- 1 frase em PORTUGUÊS resumindo o cenário histórico e a ação do personagem para o criador ler no card (ex: "Gizé em 1798: o viajante sobe no topo da cabeça da Esfinge enquanto soldados e mercadores se aglomeram furiosos lá embaixo").

DIRETRIZES DE DESIGN DE SOM:
- "sfx_suggestion": Escolha o som ideal da biblioteca local: "cannon-artillery", "record-scratch", "cartoon-blink", "riser-hit", "heartbeat", "metal-hits", "sword-clash", "sword-draw", "footsteps-stone", "piano-flourish", "trex-roar", "whoosh", "none".
- "sfx_prompt": Prompt acústico descritivo em inglês para a API ElevenLabs (ex: "Loud crumbling rock sound with sand debris echoing in desert").

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
