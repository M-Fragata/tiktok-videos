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
   - BLACKLIST DE PALAVRAS PROIBIDAS PARA O BILLY (NUNCA USAR NA FALA DO PROTAGONISTA):
     É TERMINANTEMENTE PROIBIDO o Billy usar termos rebuscados, poéticos, arcaicos ou teatrais como: "alçapões", "ensurdecedores", "babando", "perecer", "destarte", "doravante", "porventura", "outrossim", "portanto", "com efeito", "regozijo", "delírio", "infortúnio", "adentrando", "sucumbir".
     Substitua SEMPRE por expressões ágeis de pânico cotidiano brasileiro: "o chão de areia cedendo", "veio louco pra cima", "partida ao meio", "deu ruim", "sem ter pra onde correr", "ficou feio", "na raça".
2. RITMO E REAÇÕES ESPONTÂNEAS:
   - Inclua reações viscerais e cômicas no meio da fala: "Espera aí...", "O quê?!", "Caramba...", "Não, sério mesmo?", "Bom... deu ruim."
   - Quando confrontado com perigo ou erro, a fala deve transmitir desespero cômico ou cara de pau ("Bom, a culpa não foi totalmente minha...").
3. DINÂMICA EM DUPLA (NARRADOR SÉRIO x BILLY ATRAPALHADO):
   - REGRA DE CO-PRESENÇA E DISTRIBUIÇÃO HARMONIOSA (50/50): O Narrador e o Billy devem contracenar juntos em várias cenas ao longo de TODO o roteiro (NUNCA deixe o Narrador confinado apenas à Cena 2!).
   - Em cenas de desenvolvimento (especialmente abertura, viradas e clímax), utilize a estrutura de bate-bola na mesma cena (array "dialogues"):
     1) "narrator" (Estilo documental e voz da razão): Expõe o ambiente histórico, os fatos, nomes, locais ou ações de terceiros com precisão e sobriedade (ex: "Cinquenta mil romanos berravam nas arquibancadas sob o calor escaldante...", "Às ordens do imperador, comportas se abriam enquanto se ouviam os rugidos dos predadores.").
     2) "protagonist" (Billy - protagonista leigo e caótico): Quebra a 4ª parede imediatamente com uma reação visceral, pânico cômico ou comentário em primeira pessoa (ex: "...enquanto dois guerreiros trocavam golpes de espada velozes... e sobrou tudo pra mim!").
   - "character" (Personagens de época): Generais, imperadores, guardas ou líderes devem dar ordens e falas curtas, imperativas e autoritárias de 5 a 10 palavras (ex: "Não fique parado! Vá varrer toda essa areia!" ou "Atenção! Soltem os leões!"), servindo de gatilho causal imediato para o desespero e a resposta rápida do Billy ("Varrer?! Mas estou só de passagem!" ou "Espera aí... ele mandou soltar quem?!").
   - REGRA DE OURO DA EXPOSIÇÃO HISTÓRICA — QUEM CONTA OS FATOS:
     * O BILLY (PROTAGONISTA) NUNCA EXPLICA FATOS OU COSTUMES HISTÓRICOS: O Billy é um viajante leigo contemporâneo que acabou de cair na época histórica. Ele NÃO sabe e NÃO DEVE explicar por que os piratas misturavam rum na água, por que comiam no escuro, por que o imperador fazia tal coisa ou como funcionava uma lei antiga!
     * PROIBIDO: O Billy dizer falas explicativas/didáticas como: "A água apodrecia, então misturavam rum pra não morrer de escorbuto!" ou "Eles mastigavam no escuro pra não ver a nojeira!".
     * QUEM CONTA OS FATOS E CURIOSIDADES É SEMPRE:
       a) O NARRADOR ("narrator"): Com tom documental contextualizando o fato histórico real com sobriedade e precisão (ex: "A água estragava nos barris, e o rum com limão evitava que os dentes caíssem!").
       b) OU O PERSONAGEM DA ÉPOCA ("character"): Revelando o costume com a naturalidade de quem vive na época ou zombando da ignorância do Billy (ex: "No escuro a gente não vê os vermes se mexendo, novato!").
     * ESTRUTURA REAÇÃO/ESTRANHAMENTO (BILLY) ➔ EXPLICAÇÃO (NARRADOR OU PERSONAGEM DE ÉPOCA):
       Sempre que houver uma curiosidade histórica insólita, use esta dobradinha dinâmica:
       1º) Billy estranha, sente dor, nojo ou faz uma pergunta leiga: "Eca! Aquele pirata tá misturando bebida na água?!" ou "Quase quebrei dois dentes! Por que você tá comendo no escuro?!".
       2º) Narrador ou Personagem revela o fato histórico: "A água estragava nos barris..." ou "No escuro a gente não vê os vermes, novato!".
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
  * Variação A (Momento de Choque / Evento Histórico):
    - loop_closing_fragment: "...se você estivesse no meu lugar em 44 antes de Cristo, a única coisa que você veria era"
    - loop_opening_fragment: "a coroa de César rolando no chão de mármore do Senado!"
    - bridge_full_sentence: "Se você estivesse no meu lugar em 44 antes de Cristo, a única coisa que você veria era a coroa de César rolando no chão de mármore do Senado!"
  * Variação B (Rotina Diária / 24 Horas / "Um Dia na Pele de..."):
    - loop_closing_fragment: "...e se você passasse um dia inteiro no navio do Barba Negra, a primeira coisa que você faria era"
    - loop_opening_fragment: "acordar às cinco da manhã com uma ratazana mordendo o seu cadarço no porão!"
    - bridge_full_sentence: "E se você passasse um dia inteiro no navio do Barba Negra, a primeira coisa que você faria era acordar às cinco da manhã com uma ratazana mordendo o seu cadarço no porão!"
- "ticking_clock":
  * loop_closing_fragment: "...e faltando três segundos para a erupção engolir Pompeia, o único reflexo que me restava era"
  * loop_opening_fragment: "correr em direção ao mar antes da cinza cobrir o céu!"
  * bridge_full_sentence: "E faltando três segundos para a erupção engolir Pompeia, o único reflexo que me restava era correr em direção ao mar antes da cinza cobrir o céu!"

4. BLACKLIST RÍGIDA DE ANTI-PADRÕES (DIRETRIZES NEGATIVAS ESTRITAS):
- PROIBIÇÃO ABSOLUTA DE ONOMATOPEIAS E RUÍDOS ESCRITOS NO TEXTO FALADO:
  NUNCA coloque onomatopeias, barulhos mecânicos, quebras ou sons de impacto escritos dentro de "text" ou "dialogues[].text" (ex: É EXPRESSAMENTE PROIBIDO escrever "CRAQUE!", "POW!", "BUM!", "BOOM!", "CLANG!", "TCHIBUM!", "CABUM!", "SPLASH!", "VRUM!", "TOC-TOC!", "CRASH!", "BANG!").
  O sintetizador de voz (TTS) lê essas onomatopeias literalmente em voz alta ("Craque!"), o que destrói a imersão da dublagem! Qualquer som de impacto ou ruído físico DEVE ser colocado exclusivamente no array "sfx_list" da cena como efeito sonoro. No texto falado, o narrador ou personagem deve relatar a ação verbalmente com naturalidade (ex: "A espada partiu minha vassoura ao meio!", e NUNCA "CRAQUE! A espada partiu minha vassoura...").
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
Divida o peso narrativo harmonicamente: ~50% de contextualização histórica documental exposta com clareza pelo Narrador e ~50% de comédia, reações caóticas e comentários do Billy. O Narrador e o Billy devem contracenar na mesma cena em múltiplos momentos ao longo do vídeo, mantendo o tom documental e a comédia interligados do início ao clímax.`,
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

  const systemPromptPart = `DIRETRIZES DE DESIGN DE SOM (SFX) & LISTA DINÂMICA ("sfx_list"):
Você atua como um Diretor de Áudio de cinema e curador de som para vídeos virais. Adicione efeitos sonoros ao array "sfx_list" de cada cena com base em uma taxonomia de 2 papéis bem definidos: "Ação" (impactos pontuais, foley, comédia física ou crescendo de tensão) e "Ambiente" (som contínuo de atmosfera/soundscape do local).

PROCESSO OBRIGATÓRIO DE CRIAÇÃO EM 2 ETAPAS:
ETAPA 1: Escreva primeiro o roteiro e diálogos orgânicos completos de todas as cenas, amarrando as piadas, reações e fatos históricos.
ETAPA 2: Com a história INTEIRA fechada, revise cena a cena o sound design com CAUSALIDADE ESTRITA. NUNCA gere efeitos desconexos do diálogo!
* Exemplo Proibido: se o Billy espanta um animal com um espirro, o som da cena DEVE ser o espirro do Billy ("loud comical human sneeze echoing with sudden startled silence"), e JAMAIS um galho quebrando genérico.
* Se os personagens acendem uma fogueira, a cena deve ter o som de Ação da faísca/pederneira E o som de Ambiente do fogo estalando continuamente.

TAXONOMIA E ENGENHARIA ACÚSTICA PARA ELEVENLABS:
1. EFEITO DE AÇÃO ("slot": "action"):
   - Propósito: Impactos físicos, foley de objetos (pedra lascando, espada, flecha), tropeços cômicos, reações pontuais OU momentos de clímax/tensão.
   - Engenharia de Prompt em Inglês:
     * Para Impactos/Foley: Use termos como "crisp, punchy upfront foley, close mic, dry recording, clear physical sound, instant attack, no silence".
     * Para Tensão/Clímax (especialmente na última cena ou momentos de perigo iminente): Descreva uma evolução temporal com CRESCENDO, por exemplo: "steadily accelerating heartbeat thumps increasing in volume, tempo and pitch, building heavy suspense until an abrupt cutoff cliffhanger".
   - Timing ("start_time_sec"): Exato no segundo em que a ação/fala ocorre (ritmo aprox. 2.5 palavras por segundo).
   - Duração ("duration_sec"): 0.5s a 2.5s para impactos normais; para efeitos de crescendo de tensão, use a duração até o final da cena.
   - Volume ("suggested_volume"): 0.75 a 0.95 (som claro, presente e impactante).

2. EFEITO DE AMBIENTE ("slot": "ambient"):
   - Propósito: Som de fundo contínuo da atmosfera histórica (vento ártico uivando, fogueira estalando, floresta noturna com grilos, caverna úmida com gotejamento, murmúrio de multidão romana).
   - Engenharia de Prompt em Inglês:
     * Termos obrigatórios: "seamless steady continuous background bed, natural room tone, steady level, no silent gaps or abrupt pauses".
   - Timing ("start_time_sec"): Sempre 0.0 (inicia junto com a cena).
   - Duração ("duration_sec"): DEVE cobrir toda a cena (ex: 4.0s a 8.0s), para que venha da IA na duração exata sem necessidade de repetições forçadas.
   - Volume ("suggested_volume"): 0.35 a 0.50 (imersivo e audível, complementando a trilha BGM sem abafar as falas).

3. SILÊNCIO INTENCIONAL:
   - Se a cena não precisar de som ambiente ou se sustentar apenas no diálogo/BGM, não invente som desnecessário. Retorne "sfx_list": [] ou apenas o som pontual que for estritamente relevante.

VÍNCULO COM O CATÁLOGO LOCAL ("sfx_key"):
Se o som corresponder a um efeito existente no nosso catálogo de estúdio listado abaixo, preencha "sfx_key" com o identificador correspondente. Se for um som inédito para síntese com IA, omita "sfx_key" (ou null):
${itemsText}

CAMPOS DE RETROCOMPATIBILIDADE POR CENA:
- "sfx_suggestion": Se houver correspondência com o catálogo acima, use o slug escolhido (ou "whoosh", ou "none" se sfx_list for vazio).
- "sfx_prompt": O sound_prompt do som de Ação principal (em inglês).
- "sfx_label": Título curto em português com 1 emoji relevante (ex: "💥 Espirro Cômico", "🌿 Vento Ártico", "🔥 Fogueira Estalando", "💓 Tensão Crescente").`;

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
  "thumbnail_prompt": "Mixed media 2D/3D illustration, a 2D cartoon stickman protagonist with a smooth round white head, orange messy spiky hair, retro aviator goggles and fluttering red adventurer scarf, looking utterly terrified with wide open eyes pointing towards a giant ancient Egyptian sandstone statue in dramatic golden sunset, cinematic volumetric rim lighting, 9:16 vertical composition.",
  "thumbnail_title_hook": "NÃO FOI ELE?! 😱",
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
      "sfx_list": [
        {
          "sound_prompt": "Abrupt comedic vinyl record scratch sudden stop in dusty air",
          "match_score": 95,
          "start_time_sec": 1.2,
          "duration_sec": 0.6,
          "suggested_volume": 0.75,
          "sfx_key": "record-scratch"
        }
      ],
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
      "sfx_list": [],
      "sfx_suggestion": "none",
      "sfx_label": "🔇 Foco no Diálogo",
      "sfx_prompt": ""
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
      "sfx_list": [
        {
          "sound_prompt": "Ancient paper unfurling sound effect with soft desert wind",
          "match_score": 88,
          "start_time_sec": 0.2,
          "duration_sec": 1.8,
          "suggested_volume": 0.25,
          "sfx_key": "footsteps-stone"
        }
      ],
      "sfx_suggestion": "footsteps-stone",
      "sfx_label": "👣 Passos em Pedra",
      "sfx_prompt": "Ancient paper unfurling sound effect with soft desert wind..."
    }
  ]
}`;

