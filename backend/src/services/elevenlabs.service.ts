import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import type { ScriptScene, SpeakerType } from './gemini.service.ts';

const FPS = 30;
const WORDS_PER_SUBTITLE_CHUNK = 4; // Agrupamento de 3 a 5 palavras por tela

/**
 * Dicionário Multi-Voz mapeando cada tipo de personagem (SpeakerType)
 * para um voiceId distinto da ElevenLabs (compatíveis com Premade/Free Tier
 * e customizáveis via variáveis de ambiente no .env).
 */
export const SPEAKER_VOICE_MAP: Record<SpeakerType, string> = {
  // Protagonista (Viajante moderno): Liam - voz jovem, rápida e energética de criador
  protagonist:
    process.env.ELEVENLABS_VOICE_PROTAGONIST || 'TX3LPaxmHKxFdv7VOQHJ',
  // Personagem Histórico (Stick Figure): Callum - voz secundária marcante/característica
  character:
    process.env.ELEVENLABS_VOICE_CHARACTER || 'N2lVS1w4EtoT3dr4eOWO',
  // Narrador (Documentário épico): George - voz profunda e imponente de contador de histórias
  narrator:
    process.env.ELEVENLABS_VOICE_NARRATOR || 'JBFqnCBsd6RMkjVDRZzb',
};

const FALLBACK_FREE_VOICE_ID = 'IKne3meq5aSn9XLyUdCD'; // Charlie (Premade fallback)

export interface SubtitleWordTiming {
  word: string;
  frameStart: number;
  frameEnd: number;
}

export interface SubtitleItem {
  frameStart: number;
  frameEnd: number;
  text: string;
  words?: SubtitleWordTiming[];
}

export interface AvatarSegment {
  startSecond: number;
  endSecond: number;
  image: string;
}

export interface SceneFrameTiming {
  sceneIndex: number;
  startSecond: number;
  endSecond: number;
  frameStart: number;
  frameEnd: number;
}

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsWithTimestampsResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
}

interface WordTimestamp {
  word: string;
  startSecond: number;
  endSecond: number;
  charStartIndex: number;
  charEndIndex: number;
}

export interface NarrationSyncResult {
  audioUrl: string;
  durationInFrames: number;
  subtitles: SubtitleItem[];
  avatarTimeline: AvatarSegment[];
  sceneTimings: SceneFrameTiming[];
}

/**
 * Configura os binários do FFmpeg e FFprobe.
 * Caso o sistema operativo não tenha o ffmpeg instalado globalmente no PATH,
 * utiliza automaticamente os binários embutidos no @remotion/compositor local.
 */
function configureFfmpegBinaries(): void {
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  }
  if (process.env.FFPROBE_PATH) {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }

  const remotionScopeDir = path.resolve(
    import.meta.dirname,
    '../../node_modules/@remotion'
  );
  if (!fs.existsSync(remotionScopeDir)) return;

  const isWin = process.platform === 'win32';
  const ffmpegExe = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const ffprobeExe = isWin ? 'ffprobe.exe' : 'ffprobe';

  const entries = fs.readdirSync(remotionScopeDir);
  const compositorDir = entries.find((entry) =>
    entry.startsWith('compositor-')
  );

  if (compositorDir) {
    const fullCompositorPath = path.join(remotionScopeDir, compositorDir);
    const candidateFfmpeg = path.join(fullCompositorPath, ffmpegExe);
    const candidateFfprobe = path.join(fullCompositorPath, ffprobeExe);

    if (!process.env.FFMPEG_PATH && fs.existsSync(candidateFfmpeg)) {
      ffmpeg.setFfmpegPath(candidateFfmpeg);
    }
    if (!process.env.FFPROBE_PATH && fs.existsSync(candidateFfprobe)) {
      ffmpeg.setFfprobePath(candidateFfprobe);
    }
  }
}

configureFfmpegBinaries();

/**
 * Obtém a duração real de um ficheiro de áudio via ffprobe (em segundos).
 * Caso o ffprobe falhe, recorre ao último timestamp de caractere da ElevenLabs.
 */
function getAudioFileDurationSeconds(
  filePath: string,
  fallbackDurationSeconds: number
): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const duration = metadata?.format?.duration;
      if (!err && typeof duration === 'number' && Number.isFinite(duration)) {
        resolve(Math.max(duration, fallbackDurationSeconds));
      } else {
        resolve(fallbackDurationSeconds);
      }
    });
  });
}

/**
 * Utilitário FFmpeg:
 * Concatena os ficheiros de áudio ordenados (chunk_0.mp3, chunk_1.mp3, ...)
 * num único ficheiro final audio.mp3 na raiz de /storage/<videoId>/.
 */
export async function concatenateAudioChunks(
  chunkFilePaths: string[],
  outputFilePath: string,
  chunksDir: string
): Promise<void> {
  if (chunkFilePaths.length === 0) {
    throw new Error('Nenhum chunk de áudio fornecido para concatenação.');
  }

  if (chunkFilePaths.length === 1) {
    fs.copyFileSync(chunkFilePaths[0], outputFilePath);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg();

    for (const chunkPath of chunkFilePaths) {
      command.input(chunkPath);
    }

    command
      .on('error', (err) => {
        reject(
          new Error(`Erro ao concatenar chunks de áudio no FFmpeg: ${err.message}`)
        );
      })
      .on('end', () => {
        resolve();
      })
      .mergeToFile(outputFilePath, chunksDir);
  });
}

/**
 * Converte o array de caracteres da ElevenLabs em palavras individuais com startSecond e endSecond.
 */
function extractWordsFromAlignment(
  alignment: ElevenLabsAlignment
): WordTimestamp[] {
  const {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  } = alignment;

  const words: WordTimestamp[] = [];
  let currentWord = '';
  let wordStartSec = 0;
  let wordEndSec = 0;
  let charStartIndex = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const startSec = character_start_times_seconds[i] ?? wordEndSec;
    const endSec = character_end_times_seconds[i] ?? startSec;

    if (/\s/.test(char)) {
      if (currentWord.length > 0) {
        words.push({
          word: currentWord,
          startSecond: wordStartSec,
          endSecond: wordEndSec,
          charStartIndex,
          charEndIndex: i - 1,
        });
        currentWord = '';
      }
    } else {
      if (currentWord.length === 0) {
        wordStartSec = startSec;
        charStartIndex = i;
      }
      currentWord += char;
      wordEndSec = endSec;
    }
  }

  if (currentWord.length > 0) {
    words.push({
      word: currentWord,
      startSecond: wordStartSec,
      endSecond: wordEndSec,
      charStartIndex,
      charEndIndex: characters.length - 1,
    });
  }

  return words;
}

/**
 * Agrupa palavras soltas em blocos curtos (ex: 4 palavras por tela) e converte segundos em frames (x 30 FPS).
 */
function buildSubtitlesFromWords(
  words: WordTimestamp[],
  wordsPerChunk = WORDS_PER_SUBTITLE_CHUNK
): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk);
    if (chunk.length === 0) continue;

    const startSecond = chunk[0].startSecond;
    const endSecond = chunk[chunk.length - 1].endSecond;

    const frameStart = Math.floor(startSecond * FPS);
    const frameEnd = Math.max(frameStart + 1, Math.ceil(endSecond * FPS));

    const wordTimings: SubtitleWordTiming[] = chunk.map((w) => {
      const wStart = Math.floor(w.startSecond * FPS);
      const wEnd = Math.max(wStart + 1, Math.ceil(w.endSecond * FPS));
      return {
        word: w.word,
        frameStart: wStart,
        frameEnd: wEnd,
      };
    });

    subtitles.push({
      frameStart,
      frameEnd,
      text: chunk.map((w) => w.word).join(' '),
      words: wordTimings,
    });
  }

  // Evita sobreposição de frame entre legendas consecutivas
  for (let i = 0; i < subtitles.length - 1; i++) {
    if (subtitles[i].frameEnd >= subtitles[i + 1].frameStart) {
      subtitles[i].frameEnd = Math.max(
        subtitles[i].frameStart,
        subtitles[i + 1].frameStart - 1
      );
    }
  }

  return subtitles;
}

/**
 * Faz a requisição ao endpoint /with-timestamps da ElevenLabs para uma única cena.
 */
async function synthesizeSceneChunk(
  text: string,
  speaker: SpeakerType,
  apiKey: string,
  options?: { previous_text?: string; next_text?: string }
): Promise<ElevenLabsWithTimestampsResponse> {
  const targetVoiceId =
    SPEAKER_VOICE_MAP[speaker] || SPEAKER_VOICE_MAP.protagonist;

  async function requestTts(voiceIdToUse: string) {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceIdToUse}/with-timestamps`;
    const payload: Record<string, unknown> = {
      text: text.trim(),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: speaker === 'protagonist' ? 0.4 : 0.55,
        similarity_boost: 0.75,
      },
    };

    if (options?.previous_text && options.previous_text.trim().length > 0) {
      payload.previous_text = options.previous_text.trim();
    }
    if (options?.next_text && options.next_text.trim().length > 0) {
      payload.next_text = options.next_text.trim();
    }

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  let response = await requestTts(targetVoiceId);

  if (response.status === 402 && targetVoiceId !== FALLBACK_FREE_VOICE_ID) {
    console.warn(
      `[ElevenLabs] Voz "${targetVoiceId}" (${speaker}) requer plano pago. Alternando para fallback gratuito (${FALLBACK_FREE_VOICE_ID})...`
    );
    response = await requestTts(FALLBACK_FREE_VOICE_ID);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erro na API da ElevenLabs para cena [${speaker}] (${response.status}): ${errorText}`
    );
  }

  return (await response.json()) as ElevenLabsWithTimestampsResponse;
}

/**
 * Pilar 2 (O Narrador Multi-Voz e Sincronizador):
 * 1. Gera um áudio parcial por cena na ElevenLabs (/with-timestamps) usando a voz do respectivo speaker.
 * 2. Salva temporariamente em backend/storage/<videoId>/chunks/chunk_0.mp3, chunk_1.mp3, ...
 * 3. Soma o offset cumulativo de tempo aos arrays character_start_times_seconds e character_end_times_seconds.
 * 4. Concatena todos os chunks num único backend/storage/<videoId>/audio.mp3 via FFmpeg e remove a pasta chunks/.
 */
export async function generateNarrationWithTimestamps(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<NarrationSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY não configurada no ficheiro backend/.env.'
    );
  }

  if (scenes.length === 0) {
    throw new Error('O roteiro não possui cenas para gerar locução.');
  }

  const chunksDir = path.join(storageVideoDir, 'chunks');
  fs.mkdirSync(chunksDir, { recursive: true });

  const chunkFilePaths: string[] = [];
  const allSubtitles: SubtitleItem[] = [];
  const rawSceneTimings: Array<{ startSecond: number; endSecond: number }> = [];

  // Arrays cumulativos globais (para auditoria/alinhamento contínuo)
  const mergedAlignment: ElevenLabsAlignment = {
    characters: [],
    character_start_times_seconds: [],
    character_end_times_seconds: [],
  };

  // Constrói lista plana de todas as falas das cenas para injeção de previous_text e next_text (context stitching)
  const flatSpeechList: Array<{
    sceneIndex: number;
    dialogueIndex: number;
    speaker: SpeakerType;
    text: string;
  }> = [];

  for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
    const s = scenes[sIdx];
    const raw =
      s.dialogues && s.dialogues.length > 0
        ? s.dialogues
        : [
            {
              id: `dlg_${sIdx}`,
              speaker: s.speaker || 'protagonist',
              text: s.text || '',
            },
          ];
    const active = raw.filter((d) => d.text && d.text.trim().length > 0);
    const toUse =
      active.length > 0
        ? active
        : [
            {
              id: `dlg_${sIdx}_empty`,
              speaker: s.speaker || 'protagonist',
              text: s.text?.trim() || '...',
            },
          ];
    for (let dIdx = 0; dIdx < toUse.length; dIdx++) {
      flatSpeechList.push({
        sceneIndex: sIdx,
        dialogueIndex: dIdx,
        speaker: toUse[dIdx].speaker,
        text: toUse[dIdx].text,
      });
    }
  }

  const firstSpeechText = flatSpeechList[0]?.text || '';
  let globalSpeechIdx = 0;

  let cumulativeDurationSeconds = 0;
  let chunkCounter = 0;

  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const rawDialogues =
      scene.dialogues && scene.dialogues.length > 0
        ? scene.dialogues
        : [
            {
              id: `dlg_${index}`,
              speaker: scene.speaker || 'protagonist',
              text: scene.text || '',
            },
          ];

    const activeDialogues = rawDialogues.filter(
      (d) => d.text && d.text.trim().length > 0
    );

    const dialoguesToSynthesize =
      activeDialogues.length > 0
        ? activeDialogues
        : [
            {
              id: `dlg_${index}_empty`,
              speaker: scene.speaker || 'protagonist',
              text: scene.text?.trim() || '...',
            },
          ];

    const sceneStartSecond = cumulativeDurationSeconds;

    for (let dIdx = 0; dIdx < dialoguesToSynthesize.length; dIdx++) {
      const dialogue = dialoguesToSynthesize[dIdx];
      const chunkId = chunkCounter++;
      console.log(
        `[ElevenLabs] Gerando chunk #${chunkId} (cena #${index + 1}, fala #${dIdx + 1}, speaker: "${dialogue.speaker}")...`
      );

      const prevText =
        globalSpeechIdx > 0
          ? flatSpeechList[globalSpeechIdx - 1]?.text
          : undefined;
      const isVeryLastSpeech = globalSpeechIdx === flatSpeechList.length - 1;
      // No último chunk do vídeo, injetamos a primeira fala do vídeo em next_text
      // para a ElevenLabs manter a entonação ascendente/suspensa (Seamless Loop sem queda de pitch)
      const nextText = isVeryLastSpeech
        ? firstSpeechText
        : flatSpeechList[globalSpeechIdx + 1]?.text;

      globalSpeechIdx++;

      const data = await synthesizeSceneChunk(
        dialogue.text,
        dialogue.speaker,
        apiKey,
        { previous_text: prevText, next_text: nextText }
      );

      const chunkFilePath = path.join(chunksDir, `chunk_${chunkId}.mp3`);
      fs.writeFileSync(chunkFilePath, Buffer.from(data.audio_base64, 'base64'));
      chunkFilePaths.push(chunkFilePath);

      const alignment = data.alignment || data.normalized_alignment;
      if (!alignment || alignment.character_end_times_seconds.length === 0) {
        throw new Error(
          `A resposta da ElevenLabs para a cena #${index} (fala #${dIdx + 1}) não contém dados de alignment válidos.`
        );
      }

      // Matemática de Timestamps: desloca todos os tempos do chunk atual somando a duração cumulativa anterior
      const shiftedStartTimes = alignment.character_start_times_seconds.map(
        (t) => t + cumulativeDurationSeconds
      );
      const shiftedEndTimes = alignment.character_end_times_seconds.map(
        (t) => t + cumulativeDurationSeconds
      );

      const shiftedChunkAlignment: ElevenLabsAlignment = {
        characters: alignment.characters,
        character_start_times_seconds: shiftedStartTimes,
        character_end_times_seconds: shiftedEndTimes,
      };

      // Adiciona um espaço separador no alignment global entre falas/cenas
      if (chunkId > 0) {
        mergedAlignment.characters.push(' ');
        mergedAlignment.character_start_times_seconds.push(
          cumulativeDurationSeconds
        );
        mergedAlignment.character_end_times_seconds.push(
          cumulativeDurationSeconds
        );
      }
      mergedAlignment.characters.push(...shiftedChunkAlignment.characters);
      mergedAlignment.character_start_times_seconds.push(
        ...shiftedChunkAlignment.character_start_times_seconds
      );
      mergedAlignment.character_end_times_seconds.push(
        ...shiftedChunkAlignment.character_end_times_seconds
      );

      // Extrai as palavras e legendas desta fala já com os timestamps deslocados
      const sceneWords = extractWordsFromAlignment(shiftedChunkAlignment);
      const sceneSubtitles = buildSubtitlesFromWords(
        sceneWords,
        WORDS_PER_SUBTITLE_CHUNK
      );
      allSubtitles.push(...sceneSubtitles);

      // Calcula a duração real do chunk de áudio para manter sincronia exata com o arquivo concatenado pelo FFmpeg
      const lastCharEndSec =
        alignment.character_end_times_seconds[
          alignment.character_end_times_seconds.length - 1
        ] ?? 0;
      const chunkDurationSeconds = await getAudioFileDurationSeconds(
        chunkFilePath,
        lastCharEndSec
      );

      cumulativeDurationSeconds += chunkDurationSeconds;
    }

    const sceneEndSecond = cumulativeDurationSeconds;

    rawSceneTimings.push({
      startSecond: sceneStartSecond,
      endSecond: sceneEndSecond,
    });
  }

  // Evita sobreposição de frame entre legendas na transição entre cenas
  for (let i = 0; i < allSubtitles.length - 1; i++) {
    if (allSubtitles[i].frameEnd >= allSubtitles[i + 1].frameStart) {
      allSubtitles[i].frameEnd = Math.max(
        allSubtitles[i].frameStart,
        allSubtitles[i + 1].frameStart - 1
      );
    }
  }

  // Concatena todos os chunks num único audio.mp3 na raiz de /storage/<videoId>/
  const finalAudioFilePath = path.join(storageVideoDir, 'audio.mp3');
  console.log(
    `[FFmpeg] Concatenando ${chunkFilePaths.length} chunks de áudio em ${finalAudioFilePath}...`
  );
  await concatenateAudioChunks(chunkFilePaths, finalAudioFilePath, chunksDir);

  // Remove a pasta temporária de chunks/ após concatenação bem-sucedida
  fs.rmSync(chunksDir, { recursive: true, force: true });
  console.log(`[FFmpeg] Pasta temporária chunks/ removida com sucesso.`);

  // Calcula durationInFrames final com margem mínima de decaimento vocal (0.06s ~ 2 frames)
  // Substitui a margem antiga de +0.5s para viabilizar o Seamless Loop sem pausa morta perceptível
  // e sem mutilar a última consoante/vogal
  const AUDIO_DECAY_PADDING_SECONDS = 0.06;
  const lastGlobalCharEnd =
    mergedAlignment.character_end_times_seconds[
      mergedAlignment.character_end_times_seconds.length - 1
    ] ?? cumulativeDurationSeconds;
  const ultimoTimestampSegundos = Math.max(
    cumulativeDurationSeconds,
    lastGlobalCharEnd
  );
  const durationInFrames = Math.ceil(
    (ultimoTimestampSegundos + AUDIO_DECAY_PADDING_SECONDS) * FPS
  );
  const totalSeconds = durationInFrames / FPS;

  const sceneTimings: SceneFrameTiming[] = rawSceneTimings.map((timing, idx) => {
    const startSecond = idx === 0 ? 0 : timing.startSecond;
    const endSecond =
      idx === scenes.length - 1 ? totalSeconds : timing.endSecond;

    return {
      sceneIndex: idx,
      startSecond,
      endSecond,
      frameStart: idx === 0 ? 0 : Math.floor(startSecond * FPS),
      frameEnd:
        idx === scenes.length - 1
          ? durationInFrames
          : Math.ceil(endSecond * FPS),
    };
  });

  // Garante continuidade sem lacunas ou sobreposições entre cenas
  for (let i = 0; i < sceneTimings.length - 1; i++) {
    sceneTimings[i].endSecond = sceneTimings[i + 1].startSecond;
    sceneTimings[i].frameEnd = Math.max(
      sceneTimings[i].frameStart,
      sceneTimings[i + 1].frameStart - 1
    );
  }

  const avatarTimeline: AvatarSegment[] = scenes.map((scene, idx) => ({
    startSecond: sceneTimings[idx].startSecond,
    endSecond: sceneTimings[idx].endSecond,
    image: scene.avatarSprite,
  }));

  return {
    audioUrl: `${publicBaseUrl}/storage/${videoId}/audio.mp3`,
    durationInFrames,
    subtitles: allSubtitles,
    avatarTimeline,
    sceneTimings,
  };
}

/**
 * Gera um efeito sonoro sintético personalizado com a ElevenLabs Sound Effects API
 * Endpoint: POST https://api.elevenlabs.io/v1/sound-generation
 */
export async function generateSoundEffect({
  prompt,
  durationSeconds = 2.5,
}: {
  prompt: string;
  durationSeconds?: number;
}): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY não configurada no ficheiro backend/.env.'
    );
  }

  const response = await fetch(
    'https://api.elevenlabs.io/v1/sound-generation',
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: durationSeconds,
        prompt_influence: 0.3,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha na API da ElevenLabs Sound Effects (${response.status}): ${errorText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
