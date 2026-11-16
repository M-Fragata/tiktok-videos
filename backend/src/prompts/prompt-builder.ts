import type {
  ContentBalance,
  DurationPreset,
  EpisodeFormat,
  ProtagonistAgency,
  SeriesContext,
} from '../schemas/video.schema.ts';
import type { SfxOption } from '../services/sfx-library.service.ts';
import { getCharacterVoicesPromptPart } from '../services/voice-catalog.service.ts';
import {
  buildMixedMediaVisualBlock,
  CONTENT_BALANCE_BLOCKS,
  CORE_IDENTITY_AND_BILLY_BLOCK,
  DURATION_RULES,
  FEW_SHOT_IDEATION_EXAMPLE,
  formatEpisodeFormatBlock,
  formatSfxInstructions,
  PROTAGONIST_AGENCY_BLOCKS,
  SEAMLESS_LOOP_AND_BLACKLIST_BLOCK,
} from './prompt-blocks.ts';

export const VALID_AVATAR_SPRITES_LIST = [
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

export interface PromptBuilderOptions {
  theme?: string;
  durationPreset?: DurationPreset;
  avatarDescriptor?: string;
  episodeFormat?: EpisodeFormat;
  seriesContext?: SeriesContext;
  protagonistAgency?: ProtagonistAgency;
  contentBalance?: ContentBalance;
  tone?: string;
  sfxOptions?: SfxOption[];
}

export class ScriptPromptBuilder {
  private options: PromptBuilderOptions = {
    durationPreset: 'short',
    episodeFormat: 'single',
    protagonistAgency: 'chaos_agent',
    contentBalance: 'balanced',
    sfxOptions: [],
  };

  constructor(initialOptions?: Partial<PromptBuilderOptions>) {
    if (initialOptions) {
      this.options = { ...this.options, ...initialOptions };
    }
  }

  withTheme(theme: string): this {
    this.options.theme = theme;
    return this;
  }

  withDuration(preset: DurationPreset = 'short'): this {
    this.options.durationPreset = preset;
    return this;
  }

  withAvatarDescriptor(descriptor: string): this {
    this.options.avatarDescriptor = descriptor;
    return this;
  }

  withEpisodeFormat(
    format: EpisodeFormat = 'single',
    context?: SeriesContext
  ): this {
    this.options.episodeFormat = format;
    this.options.seriesContext = context;
    return this;
  }

  withProtagonistAgency(agency: ProtagonistAgency = 'chaos_agent'): this {
    this.options.protagonistAgency = agency;
    return this;
  }

  withContentBalance(balance: ContentBalance = 'balanced'): this {
    this.options.contentBalance = balance;
    return this;
  }

  withTone(tone?: string): this {
    this.options.tone = tone;
    return this;
  }

  withSfxOptions(sfxOptions: SfxOption[]): this {
    this.options.sfxOptions = sfxOptions;
    return this;
  }

  /**
   * Constrói o systemInstruction em 3 camadas hierárquicas para o gerador de 4 opções (Ideation)
   */
  buildIdeationInstruction(): {
    systemInstruction: string;
    enumSlugs: string[];
  } {
    const durationRule =
      DURATION_RULES[this.options.durationPreset || 'short'] ||
      DURATION_RULES.short;
    const { systemPromptPart, enumSlugs } = formatSfxInstructions(
      this.options.sfxOptions || []
    );

    const episodeBlock = formatEpisodeFormatBlock(
      this.options.episodeFormat,
      this.options.seriesContext
    );
    const agencyBlock =
      PROTAGONIST_AGENCY_BLOCKS[
        this.options.protagonistAgency || 'chaos_agent'
      ];
    const contentBalanceBlock =
      CONTENT_BALANCE_BLOCKS[this.options.contentBalance || 'balanced'];

    const toneModifier =
      this.options.tone && this.options.tone !== 'auto'
        ? `\nDIRETRIZ DE TOM TRANSVERSAL: Adapte a linguagem, humor e tensão de todas as 4 opções ao tom "${this.options.tone}" selecionado pelo utilizador.`
        : '';

    const avatarVisualBlock = buildMixedMediaVisualBlock(
      this.options.avatarDescriptor ||
        '2D cartoon stickman protagonist with a smooth round white head, a distinct solid white capsule torso with smooth thickness outlined in clean ink'
    );

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

THUMBNAIL E CAPA VIRAL POR OPÇÃO (CAMPOS "thumbnail_prompt" e "thumbnail_title_hook"):
Para CADA uma das 4 opções, deves gerar:
1. "thumbnail_prompt": Prompt visual descritivo e cinematográfico em inglês para a geração de imagem vertical 9:16 da capa do vídeo. Deve retratar o Billy (2D stickman doodle com expressão ultra dramática, assustada ou eufórica) interagindo com um elemento histórico imponente no ambiente 3D realista, com alto contraste, iluminação de contorno (rim lighting) e foco que chame atenção imediata no feed.
2. "thumbnail_title_hook": Texto de impacto curto (2 a 5 palavras em MAIÚSCULAS) para estampar diretamente na thumbnail, gerando curiosidade e clique (ex: "PIOR IDEIA DE TODAS!", "COMO SOBREVIVER?", "NÃO FOI ELE?! 😱").

${CORE_IDENTITY_AND_BILLY_BLOCK}

${getCharacterVoicesPromptPart()}

${SEAMLESS_LOOP_AND_BLACKLIST_BLOCK}

${episodeBlock}

${agencyBlock}

${contentBalanceBlock}

${FEW_SHOT_IDEATION_EXAMPLE}

INTERPRETAÇÃO INTELIGENTE DO BRIEFING DO UTILIZADOR:
- SE O UTILIZADOR DETALHAR CENAS ESPECÍFICAS NO BRIEFING (ex: "Cena 1: ...", "Cena 2: ..." ou tópicos narrativos):
  Segue rigorosamente essa ordem cronológica e progressão de acontecimentos em TODAS as 4 opções, adaptando o tom das falas ("text"), as emoções/sprites do avatar e as piadas/tensão ao estilo específico de cada ângulo.
- SE O UTILIZADOR FORNECER APENAS O CONTEXTO OU FATOS GERAIS:
  Estrutura livremente a história dividindo-a em Gancho, Desenvolvimento e Clímax com base nos fatos fornecidos.

Duração Selecionada para CADA uma das 4 opções (${durationRule.label}):
- Estrutura por opção: ${durationRule.sceneRange} (total de ~${durationRule.targetSeconds} segundos de fala por opção).
- CONTAGEM OBRIGATÓRIA DE PALAVRAS POR OPÇÃO: A soma de todas as falas ("text") de cada opção DEVE CONTER OBRIGATORIAMENTE ENTRE ${durationRule.minWords} E ${durationRule.maxWords} PALAVRAS! É expressamente proibido gerar menos de ${durationRule.minWords} palavras no total de uma opção, pois o áudio ficaria incompleto.
- Em média, cada cena de desenvolvimento deve conter ${durationRule.avgWordsPerScene}.

DESCRIÇÃO VISUAL DO CENÁRIO EM PORTUGUÊS ("visual_description"):
Para CADA cena, gera uma descrição em PORTUGUÊS (1 frase concisa e cinematográfica) no campo "visual_description" resumindo o que aparece no cenário e o que o personagem está fazendo (ex: "Gizé em 1798 sob o sol escaldante: o viajante sobe no topo da cabeça da Esfinge enquanto soldados e mercadores se aglomeram furiosos lá embaixo").
Esta descrição será lida pelo criador do vídeo no topo do cartão da cena para entender o visual antes da fala.

${avatarVisualBlock}

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

${systemPromptPart}

DIRETRIZES DE DIÁLOGOS E INTERAÇÃO MULTI-VOZ POR CENA ("dialogues"):
Na nossa arquitetura, cada cena DEVE priorizar o BATE-BOLA DINÂMICO ENTRE PERSONAGENS (2 a 3 falas sequenciais no array "dialogues" dentro da mesma cena).
1. REGRA PADRÃO DE BATE-BOLA POR CENA (80% A 100% DAS CENAS):
   - Cenas com Diálogo / Interação (2 a 3 falas na mesma cena): É o formato padrão obrigatório! Cada cena deve combinar locutores diferentes interagindo ("narrator" + "protagonist", "protagonist" + "narrator", "character" + "protagonist", ou "narrator" + "character" + "protagonist").
     Exemplo 1 (Narrador + Billy):
       dialogues: [
         { "speaker": "narrator", "text": "Por milênios, entradas secretas atraíram saqueadores que nunca voltaram." },
         { "speaker": "protagonist", "text": "Opa, achei uma fresta escura! O ângulo vai ficar perfeito!" }
       ]
     Exemplo 2 (Personagem + Billy):
       dialogues: [
         { "speaker": "character", "characterName": "Vigia de Gizé", "voiceId": "N2lVS1w4EtoT3dr4eOWO", "text": "Ei, você aí! Fique longe das frestas na pedra!" },
         { "speaker": "protagonist", "text": "Relaxa, chefia, é só um take rapidinho na sombra!" }
       ]
   - Cenas com 1 fala única (Exceção pontual, máx. 1 ou 2 cenas no vídeo): Apenas na abertura de 1 frase rápida se necessário, mas mesmo na abertura e no clímax prefira dividir a cena em 2 falas (ex: Narrador prepara a ação e o Billy fecha com o gancho do loop).
2. RITMO E LIMITE DE PALAVRAS:
   - A divisão de palavras entre as falas do diálogo é livre pelo roteirista para soar natural, mas a soma de todas as falas de todas as cenas da opção DEVE obrigatoriamente respeitar o piso e teto global (${durationRule.minWords} a ${durationRule.maxWords} palavras).
3. INTERAÇÃO VISUAL OBRIGATÓRIA NO "imagePrompt" E "visual_description":
   - Quando a cena contiver diálogo entre personagens (ex: protagonist e character), o "imagePrompt" e a "visual_description" DEVEM OBRIGATORIAMENTE retratar AMBOS os personagens interagindo e contracenando no mesmo cenário!
4. CAMPOS DA RAIZ:
   - O campo "speaker" na raiz da cena deve refletir o orador da primeira fala de "dialogues", e o campo "text" deve conter o texto consolidado da cena.

Regras de Saída (JSON Estrito):
O campo "avatarSprite" deve ser ESTRITAMENTE UMA destas strings:
${VALID_AVATAR_SPRITES_LIST.map((s) => `"${s}"`).join(', ')}`;

    return { systemInstruction, enumSlugs };
  }

  /**
   * Constrói o systemInstruction para gerar metadados visuais e sonoros de uma cena individual
   */
  buildSingleSceneInstruction(params: {
    sceneText: string;
    speaker: string;
    visualDescription?: string;
  }): {
    systemInstruction: string;
    enumSlugs: string[];
  } {
    const { systemPromptPart, enumSlugs } = formatSfxInstructions(
      this.options.sfxOptions || []
    );
    const agencyBlock =
      PROTAGONIST_AGENCY_BLOCKS[
        this.options.protagonistAgency || 'chaos_agent'
      ];

    const visualHint = params.visualDescription?.trim()
      ? `\nDescrição do Cenário fornecida pelo Utilizador: "${params.visualDescription}"\nIMPORTANTE: Deves basear a ação, pose e elementos do "imagePrompt" estritamente nas orientações fornecidas pelo utilizador nesta descrição do cenário!`
      : '';

    const systemInstruction = `És o Diretor de Arte e Som especialista em Mídia Mista (Mixed Media 2D/3D) para o Fragata Shorts.
A tua tarefa é gerar os metadados visuais e sonoros cinematográficos para UMA CENA específica de vídeo curto a partir do briefing histórico, da fala do locutor e da descrição do cenário do utilizador.

Contexto Geral do Vídeo: "${this.options.theme || 'Viagem no Tempo'}"
Locutor da Cena: "${params.speaker}"
Fala da Cena: "${params.sceneText}"${visualHint}

Aparência base do protagonista configurada no Camarim:
"${this.options.avatarDescriptor}"

${agencyBlock}

DIRETRIZES OBRIGATÓRIAS DO PROMPT VISUAL ("imagePrompt" — EM INGLÊS):
- Inicie SEMPRE com: "Mixed media 2D/3D illustration, a ${this.options.avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA], [POSE E AÇÃO DINÂMICA DA CENA BASEADA NO CENÁRIO DO USUÁRIO], [CENÁRIO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
- Expressão facial dinâmica adaptada à emoção exata da fala (talking, shocked, scared, happy, angry, laughing, thinking, etc.).
- Pose e ação física ativas no cenário histórico 3D (ex: escalando pedras, correndo, tropeçando, apontando, espiando, etc. NUNCA estático com mãos na cintura!).
- Tronco branco com espessura (cápsula 2D branca contornada a nanquim), braços e pernas de palito (NUNCA tronco de linha única de palito).
- Se houver personagens secundários, soldados ou multidão, TODOS devem ser 2D cartoon stickmen com cabeça redonda branca, tronco branco com espessura e roupas históricas em nanquim (NUNCA humanos fotorrealistas).

DIRETRIZES DE DESCRIÇÃO VISUAL EM PORTUGUÊS ("visual_description"):
- Se o utilizador já forneceu uma descrição, preserva-a ou aprimora-a em uma frase cinematográfica concisa em PORTUGUÊS resumindo a ação visual para o criador.

DIRETRIZES DE DESIGN DE SOM:
${systemPromptPart}

AVATAR SPRITE:
- "avatarSprite": Uma destas opções: ${VALID_AVATAR_SPRITES_LIST.map((s) => `"${s}"`).join(', ')}.`;

    return { systemInstruction, enumSlugs };
  }

  /**
   * Constrói o systemInstruction para revisão holística do Roteiro Final montado
   */
  buildReviewFinalScriptInstruction(sceneCount: number): {
    systemInstruction: string;
    enumSlugs: string[];
  } {
    const { systemPromptPart, enumSlugs } = formatSfxInstructions(
      this.options.sfxOptions || []
    );
    const agencyBlock =
      PROTAGONIST_AGENCY_BLOCKS[
        this.options.protagonistAgency || 'chaos_agent'
      ];
    const contentBalanceBlock =
      CONTENT_BALANCE_BLOCKS[this.options.contentBalance || 'balanced'];

    const systemInstruction = `És o Roteirista-Chefe e Diretor de Arte do Fragata Shorts.
O utilizador acabou de submeter a sequência completa do seu "Roteiro Final" (${sceneCount} cenas) na sala de ideação.
Ele pode ter selecionado cenas de ideias prévias e/ou criado CENAS EXTRAS AUTORAIS, informando quem fala, a fala e a descrição do cenário em cada uma.

Contexto Geral / Título do Vídeo: "${this.options.theme || 'Viagem no Tempo'}"

Aparência base do protagonista configurada no Camarim:
"${this.options.avatarDescriptor}"

A TUA MISSÃO AO REVISAR E APROVAR O ROTEIRO:
1. DEVES RETORNAR EXATAMENTE ${sceneCount} CENAS NA MESMA ORDEM CRONOLÓGICA.
2. PRESERVA rigorosamente as falas ("dialogues" ou "text") e os locutores ("speaker") de cada cena conforme definidos pelo utilizador.
3. INTERAÇÃO MULTI-VOZ NO PROMPT VISUAL ("imagePrompt"):
   - Se uma cena contiver múltiplos diálogos entre personagens (ex: protagonist e character), o "imagePrompt" e a "visual_description" DEVEM OBRIGATORIAMENTE retratar visualmente a interação e contracena física entre ambos os personagens (ex: o viajante gesticulando ou surpreso enquanto o personagem histórico reage ativamente no ambiente).
4. GERAÇÃO DE PROMPTS VISUAIS ("imagePrompt" em INGLÊS):
   - PARA CENAS EXTRAS CRIADAS PELO UTILIZADOR OU CENAS COM DESCRIÇÃO DE CENÁRIO:
     DEVES OBRIGATORIAMENTE basear o "imagePrompt" nas informações, ações, monumentos e detalhes que o utilizador colocou na "Descrição do Cenário" ("visual_description") e nas falas ("dialogues" / "text")!
   - Se uma cena já tiver um prompt visual completo e adequado que já represente bem a cena, podes preservá-lo garantindo a qualidade.
5. DIRETRIZES OBRIGATÓRIAS DO "imagePrompt" (MIXED MEDIA 2D/3D):
   - Inicie SEMPRE com: "Mixed media 2D/3D illustration, a ${this.options.avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA], [POSE E AÇÃO DINÂMICA BASEADA NA DESCRIÇÃO DO CENÁRIO], [CENÁRIO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
   - O protagonista e TODOS os personagens secundários/soldados/multidões DEVEM ser 2D cartoon stickmen com cabeça redonda branca, tronco branco com espessura (cápsula 2D contornada a nanquim, NUNCA linha de palito única) e membros de palito.
   - NUNCA repita a mesma expressão ou pose em todas as cenas (varie de acordo com a emoção e a ação descrita).
6. DESCRIÇÃO VISUAL EM PORTUGUÊS ("visual_description"):
   - Preenche ou aprimora a descrição em português com uma frase cinematográfica clara resumindo a cena para o criador.

${agencyBlock}

${contentBalanceBlock}

7. DESIGN DE SOM:
${systemPromptPart}

8. EXPRESSÃO DO AVATAR ("avatarSprite"):
   - Escolha o sprite mais adequado para a emoção da fala entre: ${VALID_AVATAR_SPRITES_LIST.map((s) => `"${s}"`).join(', ')}.

9. LOOP PERFEITO / SEAMLESS LOOP NO ROTEIRO FINAL:
   - Verifique a transição entre a última fala da última cena e a primeira fala da Cena 1.
   - A última fala da última cena NUNCA deve ter encerramento conclusivo ou CTA ("se inscreva", "deixe o like"), e JAMAIS deve terminar com pontuação terminal (sem ponto final, sem exclamação, sem reticências).
   - A última fala deve atuar como conector sintático natural em direção ao gancho de abertura da Cena 1.

10. ESTILO DO PROTAGONISTA (BILLY) E DINÂMICA EM DUPLA:
   - O protagonista ("protagonist" / Billy) expressa-se em português coloquial brasileiro, com reações viscerais ("Peraí...", "O quê?!", "Caramba...", "deu ruim"), contrações ("pra", "tá", "né") e zero afetação de professor.
   - BLACKLIST DE PALAVRAS PROIBIDAS PARA O BILLY: É proibido o Billy usar termos rebuscados ou teatrais ("alçapões", "ensurdecedores", "babando", "perecer", "destarte", "outrossim"). Use termos ágeis e diretos de pânico ("veio louco pra cima", "chão cedendo", "sem saída").
   - PROIBIÇÃO ABSOLUTA DE ONOMATOPEIAS NO TEXTO: NUNCA coloque onomatopeias escritas no texto falado (ex: "CRAQUE!", "POW!", "BUM!"). Mova qualquer ruído físico ou impacto para o array "sfx_list" da cena.
   - O narrador ("narrator") mantém a postura documental e sóbria dos fatos e contexto histórico, contracenando em bate-bola com o protagonista na mesma cena.
   - Personagens secundários ("character") devem dar ordens curtas e autoritárias de época que engatilham a reação do Billy.

11. VOZES E NOMES DE PERSONAGENS SECUNDÁRIOS:
${getCharacterVoicesPromptPart()}
   - Se a cena contiver fala de personagem ("character"), preserve ou defina o "characterName" e o "voiceId" correspondente.`;

    return { systemInstruction, enumSlugs };
  }
}
