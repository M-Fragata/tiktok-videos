import type {
  ContentBalance,
  DurationPreset,
  EpisodeFormat,
  ProtagonistAgency,
  SeriesContext,
} from '../schemas/video.schema.ts';
import type { SfxOption } from '../services/sfx-library.service.ts';

export interface DurationRule {
  targetSeconds: number;
  minWords: number;
  maxWords: number;
  sceneRange: string;
  avgWordsPerScene: string;
  label: string;
}

export const DURATION_RULES: Record<DurationPreset, DurationRule> = {
  short: {
    minWords: 32,
    maxWords: 42,
    sceneRange: '3 a 5 cenas',
    targetSeconds: 15,
    avgWordsPerScene: '8 a 10 palavras por cena',
    label: 'Curto (15s • 32 a 42 palavras)',
  },
  medium: {
    minWords: 65,
    maxWords: 78,
    sceneRange: '5 a 7 cenas',
    targetSeconds: 30,
    avgWordsPerScene: '10 a 14 palavras por cena',
    label: 'Médio (30s • 65 a 78 palavras)',
  },
  long: {
    minWords: 145,
    maxWords: 175,
    sceneRange: '10 a 14 cenas',
    targetSeconds: 65,
    avgWordsPerScene: '12 a 16 palavras por cena',
    label: 'Longo (65s • 145 a 175 palavras - Monetização)',
  },
};

/**
 * 1. IDENTIDADE CENTRAL & PERSONALIDADE DO BILLY (INVARIANTE)
 * Define a voz autoral do canal: português coloquial brasileiro, dinamismo em dupla e ritmo orgânico.
 */
export const CORE_IDENTITY_AND_BILLY_BLOCK = `PERSONALIDADE E ESTILO DE VOZ DO BILLY (PROTAGONISTA) — OBRIGATÓRIO:
O Billy é um aventureiro curioso, expressivo, com energia caótica e humor SARCÁSTICO/IRÔNICO LEVE. Ele NUNCA fala como um professor formal ou apresentador de TV.
1. NATURALIDADE COLOQUIAL E DESCONTRAÍDA:
   - Use português brasileiro coloquial, fluído e dinâmico, exatamente como alguém contando um absurdo ou fofoca inacreditável para um amigo.
   - Use contrações e gírias leves do cotidiano: "pra", "tá", "né", "olha só", "peraí", "cara", "sério", "deu ruim", "bizarro".
   - Frases curtas e diretas. Evite construções rebuscadas (proibido usar mesóclise, termos como "outrossim", "portanto", "com efeito" ou vocabulário pedante).
2. RITMO E REAÇÕES ESPONTÂNEAS:
   - Inclua reações viscerais e cômicas no meio da fala: "Espera aí...", "O quê?!", "Caramba...", "Não, sério mesmo?", "Bom... deu ruim."
   - Quando confrontado com perigo ou erro, a fala deve transmitir desespero cômico ou cara de pau ("Bom, a culpa não foi totalmente minha...").
3. DINÂMICA EM DUPLA (NARRADOR SÉRIO x BILLY ATRAPALHADO):
   - "narrator": Estilo documental e voz da razão. Expõe fatos históricos exatos, datas, locais e contexto real com precisão e sobriedade.
   - "protagonist" (Billy): O protagonista leigo e caótico. Interrompe, questiona o narrador, tira conclusões precipitadas e se mete em apuros físicos na cena.
   - "character": Personagens de época (generais, imperadores, líderes) falam com pompa histórica ou solenidade de época. O humor surge do choque imediato entre a solenidade histórica e as respostas sarcásticas/rápidas do Billy.
4. RITMO VISUAL ORGÂNICO (ORGANIC PACING):
   - Alterne organicamente entre cenas rápidas de impacto/ação (1 fala direta de 5 a 8 palavras do Billy com corte veloz) e cenas de desenvolvimento em bate-bola com o Narrador (2 a 3 falas de 10 a 16 palavras cada).
   - Respeite rigorosamente a contagem global de palavras calculada para o preset de duração.`;

/**
 * 2. SEAMLESS LOOP & BLACKLIST DE ANTI-PADRÕES (INVARIANTE)
 * Garante retenção algorítmica acima de 100% no TikTok/Shorts/Reels.
 */
export const SEAMLESS_LOOP_AND_BLACKLIST_BLOCK = `TÉCNICA MANDATÓRIA: LOOP PERFEITO (SEAMLESS LOOP / NARRATIVA CIRCULAR):
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
  NUNCA coloque pedidos de like, inscrição, comentários ou compartilhamento ("deixe seu like", "se inscreva", "comente", "siga o canal", "curte pra parte 2").
- PROIBIÇÃO DE BORDÕES CONCLUSIVOS:
  NUNCA use "E essa foi a história de...", "No fim das contas...", "Moral da história...", "Até a próxima".
- PROIBIÇÃO DE SAUDAÇÕES DE ABERTURA:
  A Cena 1 DEVE começar diretamente com a ação/revelação ("loop_opening_fragment"). NUNCA comece com "Fala galera", "Olá viajantes" ou "Hoje eu vou contar...".`;

/**
 * 3. NÍVEL DE INTERFERÊNCIA DO PROTAGONISTA (PROTAGONIST AGENCY)
 */
export const PROTAGONIST_AGENCY_BLOCKS: Record<ProtagonistAgency, string> = {
  chaos_agent: `NÍVEL DE INTERFERÊNCIA DO BILLY: AGENTE DO CAOS (AÇÃO FÍSICA DIRETA).
O Billy NÃO é mero espectador: ele mexe onde não deve, toca em relíquias sagradas, aperta alavancas proibidas, esbarra em sentinelas ou soldados e provoca acidentes que desencadeiam a confusão histórica.
O "imagePrompt" e a "visual_description" de suas cenas DEVEM retratar ações físicas ativas e desajeitadas (escorregando, quebrando algo sem querer, fugindo apavorado ou escondendo a relíquia às pressas).`,
  observer: `NÍVEL DE INTERFERÊNCIA DO BILLY: OBSERVADOR / TESTEMUNHA (SEM INTERVENÇÃO FÍSICA).
O Billy atua como testemunha ocular à margem dos acontecimentos, reagindo com sarcasmo e quebrando a 4ª parede enquanto os fatos históricos desenrolam-se ao seu redor. Ele comenta os absurdos históricos sem alterar o curso físico dos eventos.
O "imagePrompt" e a "visual_description" devem mostrá-lo espiando atrás de colunas ou estátuas, registrando com luneta/pergaminho ou reagindo chocado em primeiro plano enquanto a História acontece no fundo.`,
};

/**
 * 4. DENSIDADE DE CONTEÚDO (CONTENT BALANCE)
 */
export const CONTENT_BALANCE_BLOCKS: Record<ContentBalance, string> = {
  balanced: `DENSIDADE DE CONTEÚDO: EQUILIBRADA (50/50).
Divida o peso narrativo harmonicamente: ~50% de contextualização histórica documental exposta com clareza pelo Narrador e ~50% de comédia, reações caóticas e comentários do Billy.`,
  comedy_action: `DENSIDADE DE CONTEÚDO: FOCO EM COMÉDIA & AÇÃO FÍSICA (~70% Gags / ~30% Fatos).
Priorize o ritmo veloz de humor físico, gags visuais absurdas, mal-entendidos hilários e efeitos sonoros de impacto (SFX). A contextualização histórica deve ser sucinta e servir de pretexto para o caos e as trapalhadas do Billy.`,
  historical_focus: `DENSIDADE DE CONTEÚDO: FOCO EM CURIOSIDADE HISTÓRICA (~70% Fatos / ~30% Humor).
Aprofunde nos fatos documentados, nomes reais, datas precisas e reviravoltas históricas através do Narrador. O Billy atua como alívio cômico pontual, pontuando perguntas inteligentes ou surpresas legítimas sem ofuscar a riqueza factual do episódio.`,
};

/**
 * 5. FORMATO DE EPISÓDIO (EPISODE FORMAT)
 */
export function formatEpisodeFormatBlock(
  format: EpisodeFormat = 'single',
  context?: SeriesContext
): string {
  if (format === 'series') {
    const epNum = context?.episodeNumber || 1;
    const seriesTitleLine = context?.seriesTitle?.trim()
      ? `\nSÉRIE: "${context.seriesTitle.trim()}"`
      : '';

    const historyBlock = context?.resolvedHistory?.trim()
      ? `\n\nHISTÓRICO COMPLETO DOS EPISÓDIOS ANTERIORES DESTA SÉRIE (MEMÓRIA OBRIGATÓRIA):\n${context.resolvedHistory.trim()}\n\nDIRETRIZES ESTRITAS DE CONTINUAÇÃO:\n1. Dê continuidade imediata e orgânica a partir do cliffhanger/situação onde o episódio anterior terminou.\n2. NÃO repita os mesmos fatos históricos, piadas ou explicações já contados nos episódios anteriores — avance a trama e revele novos desdobramentos.\n3. NUNCA use frases clichês de recap ("no episódio anterior...", "como vimos na parte 1...", "continuando..."). Entre direto na ação da cena!`
      : '';

    const notesText = context?.previousContext?.trim()
      ? `\n${context?.isContinuation ? 'NOTAS / DIREÇÃO EXTRA DO UTILIZADOR PARA ESTE EPISÓDIO' : 'PREMISSA / ARCO GERAL DA SÉRIE'}: "${context.previousContext.trim()}"`
      : '';

    return `FORMATO DE NARRATIVA: MINI-SÉRIE (EPISÓDIO #${epNum} COM CLIFFHANGER).${seriesTitleLine}${notesText}${historyBlock}
- ESTRUTURA DO ARCO: O episódio é parte de uma saga contínua.
- REVELAÇÃO DO CLÍMAX: O desfecho NÃO encerra o mistério completo por definitivo; ele resolve a situação imediata mas descobre uma revelação ainda mais intrigante, perigosa ou inacreditável (cliffhanger narrativo).
- CONTINUIDADE DO SEAMLESS LOOP: Mesmo sendo episódico, a última fala engata obrigatoriamente na emenda sintática circular para a Cena 1, sem pontuação terminal. É EXPRESSAMENTE PROIBIDO usar CTAs como "curte para a parte seguinte", "veja a parte 2" ou "continua no próximo vídeo".`;
  }

  return `FORMATO DE NARRATIVA: EPISÓDIO ÚNICO (ARCO NARRATIVO FECHADO).
A história possui começo, meio e desfecho completo e conclusivo dentro da duração selecionada. O mistério ou perigo é esclarecido antes da emenda sintática do Seamless Loop.`;
}

/**
 * 6. DIRETRIZES VISUAIS MIXED MEDIA 2D/3D (INVARIANTE)
 */
export function buildMixedMediaVisualBlock(avatarDescriptor: string): string {
  return `APARÊNCIA CUSTOMIZADA DO AVATAR PROTAGONISTA (OBRIGATÓRIO EM TODOS OS "imagePrompt"):
O utilizador configurou o protagonista no Camarim 360º com a seguinte aparência exata:
"${avatarDescriptor}"

DIRETRIZES OBRIGATÓRIAS DE ENGENHARIA DE PROMPT VISUAL ("imagePrompt" — ESTILO MIXED MEDIA 2D/3D):
Cada "imagePrompt" DEVE ser escrito em INGLÊS e estruturado para difusão (FLUX / Imagen), garantindo dinamismo e coerência:
1. ESTRUTURA DO PROMPT POR CENA:
   Inicie SEMPRE o prompt com:
   "Mixed media 2D/3D illustration, a ${avatarDescriptor}, [EXPRESSÃO FACIAL DINÂMICA DA CENA], [POSE E AÇÃO DINÂMICA DO PERSONAGEM], [CENÁRIO HISTÓRICO 3D REALISTA E PERSONAGENS SECUNDÁRIOS], integrated perfectly into the 3D scene, illuminated by warm volumetric rim lighting, casting realistic 3D shadows onto the environment, cinematic atmosphere, shallow depth of field, 9:16 vertical composition."
2. EXPRESSÕES FACIAIS E POSES NUNCA DEVEM SER REPETIDAS NEM ESTÁTICAS:
   - É expressamente PROIBIDO colocar "with hands on hips" ou pose cocky/confiante em todas as cenas!
   - A EXPRESSÃO FACIAL DEVE variar cena a cena de acordo com a emoção do momento e o "avatarSprite" escolhido (talking, shocked, scared, happy, angry, laughing, thinking, etc.).
   - A POSE E AÇÃO FÍSICA DEVE ser ativa (escalando, correndo, tropeçando, apontando, espiando, etc. — NUNCA todos com mãos na cintura).
3. ANATOMIA E REGRA GERAL DE TODOS OS PERSONAGENS (PROTAGONISTA E SECUNDÁRIOS):
   - TRONCO BRANCO COM ESPESSURA: Tanto o protagonista quanto qualquer personagem devem ter tronco branco com espessura visível (cápsula/torso branco 2D contornado a nanquim, similar a Henry Stickmin). É expressamente PROIBIDO gerar o tronco como uma linha única de palito (evitar tronco de fio único).
   - BRAÇOS E PERNAS DE PALITO: Apenas os braços e pernas são traços pretos finos de palito.
   - TODOS OS PERSONAGENS NO MESMO ESTILO: Figuras secundárias, soldados de Napoleão, sacerdotes, operários e multidões históricas DEVEM ser desenhados no MESMO formato de cartoon 2D ("all secondary characters and historical figures are also stylized 2D cartoon stickmen with smooth round white heads, distinct solid white capsule torsos with thickness, and thin stick limbs, wearing cartoon historical costumes. ABSOLUTELY NO photorealistic human skin or realistic human faces").
4. CENÁRIO 3D REALISTA E ILUMINAÇÃO:
   - O cenário de fundo é renderizado como ambiente 3D cinematográfico ultra-realista com texturas ricas de pedra, poeira, areia e arquitetura histórica.
   - Os personagens 2D interagem fisicamente e projetam sombras 3D realistas sobre o solo e pedras.`;
}

/**
 * 7. FORMATAÇÃO DINÂMICA DE SFX (BIBLIOTECA LOCAL + CUSTOM)
 */
export function formatSfxInstructions(availableSfx: SfxOption[]): {
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

/**
 * 8. EXEMPLO FEW-SHOT PARA O BRAINSTORMING DE 4 OPÇÕES
 */
export const FEW_SHOT_IDEATION_EXAMPLE = `EXEMPLO FEW-SHOT DA ESTRUTURA DE UMA OPÇÃO (BATE-BOLA BILLY x NARRADOR):
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
      "sfx_label": "🛑 Quebra de 4ª Parede",
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
      "sfx_label": "👀 Efeito Cômico",
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
      "sfx_label": "👣 Passos em Pedra",
      "sfx_prompt": "Ancient paper unfurling sound effect with soft desert wind..."
    }
  ]
}`;

