import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ffmpeg from 'fluent-ffmpeg';
import type { ScriptScene, SpeakerType } from './gemini.service.ts';
import {
  getNarratorVoice,
  getProtagonistVoice,
  getCharacterVoices,
  findVoiceById,
} from './voice-catalog.service.ts';

const FPS = 30;
const WORDS_PER_SUBTITLE_CHUNK = 4; // Agrupamento de 3 a 5 palavras por tela

/**
 * Mapeamento padrão de vozes a partir do catálogo central (backend/src/config/voices.json).
 * - Protagonista (Harry): Jovem, enérgico e expressivo para o viajante atrapalhado
 * - Personagem padrão (Callum): Rouco e cômico (caso a fala não especifique um voiceId próprio)
 * - Narrador (Liam): Locutor moderno de ritmo acelerado
 */
export const SPEAKER_VOICE_MAP: Record<SpeakerType, string> = {
  protagonist: getProtagonistVoice().id,
  character: getCharacterVoices()[0]?.id || 'N2lVS1w4EtoT3dr4eOWO',
  narrator: getNarratorVoice().id,
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
  sceneIndex?: number;
  speaker?: SpeakerType;
  characterGender?: 'male' | 'female';
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

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface ChunkManifestItem {
  chunkId: number;
  fileName: string;
  sceneIndex: number;
  dialogueIndex: number;
  dialogueId?: string;
  speaker: SpeakerType;
  voiceId?: string;
  characterName?: string;
  text: string;
  alignment: ElevenLabsAlignment;
  durationSeconds: number;
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

export const INTER_SCENE_PADDING_SECONDS = 0.45;
export const INTER_SCENE_POST_ROLL_RATIO = 0.5;

function createSilentWavBuffer(
  durationSeconds: number,
  sampleRate = 44100,
  numChannels = 1
): Buffer {
  const bytesPerSample = 2;
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

export async function ensureSilentMp3File(
  filePath: string,
  durationSeconds: number
): Promise<void> {
  if (fs.existsSync(filePath)) return;
  const wavTempPath = `${filePath}.wav`;
  fs.writeFileSync(wavTempPath, createSilentWavBuffer(durationSeconds));
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(wavTempPath)
      .output(filePath)
      .on('end', () => {
        try {
          if (fs.existsSync(wavTempPath)) fs.unlinkSync(wavTempPath);
        } catch {
          // ignore
        }
        resolve();
      })
      .on('error', (err) => {
        try {
          if (fs.existsSync(wavTempPath)) fs.unlinkSync(wavTempPath);
        } catch {
          // ignore
        }
        reject(err);
      })
      .run();
  });
}

/**
 * Mede a duração exata de qualquer ficheiro de áudio no disco (ex: efeitos sonoros .mp3).
 */
export function probeAudioDurationSeconds(
  filePath: string,
  fallbackDuration: number = 2.0
): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const duration = metadata?.format?.duration;
      if (!err && typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        resolve(Number(duration.toFixed(2)));
      } else {
        resolve(fallbackDuration);
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

const WEAK_END_WORDS = new Set([
  // Preposições & Contrações
  'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas',
  'a', 'ao', 'aos', 'à', 'às',
  'com', 'por', 'pelo', 'pela', 'pelos', 'pelas',
  'para', 'pra', 'pro', 'pras', 'pros',
  'sem', 'sob', 'sobre', 'até', 'contra', 'desde', 'entre',
  'dum', 'duma', 'duns', 'dumas', 'num', 'numa', 'nuns', 'numas',
  // Conjunções & Conectivos
  'que', 'e', 'mas', 'ou', 'se', 'porque', 'pois', 'como', 'quando', 'enquanto',
  // Artigos & Demonstrativos / Possessivos
  'o', 'os', 'um', 'uma', 'uns', 'umas',
  'meu', 'minha', 'meus', 'minhas',
  'seu', 'sua', 'seus', 'suas',
  'nosso', 'nossa', 'nossos', 'nossas',
  'este', 'esta', 'estes', 'estas',
  'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas'
]);

function isTerminalPunctuation(word: string): boolean {
  return /[.!?…;:]+$/.test(word.trim());
}

function isClausePausePunctuation(word: string): boolean {
  return /[,–—]+$/.test(word.trim());
}

function isWeakEndingWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return WEAK_END_WORDS.has(clean);
}

function getItemWordText<T extends string | { word: string }>(item: T): string {
  return typeof item === 'string' ? item : item.word;
}

function splitClauseIntoSemanticChunks<T extends string | { word: string }>(words: T[]): T[][] {
  const N = words.length;
  if (N === 0) return [];
  if (N <= 5) return [words];

  // Se tem 6 palavras, divide em 3 + 3 caso a palavra divisora não seja fraca
  if (N === 6) {
    const wordAt2 = getItemWordText(words[2]);
    if (!isWeakEndingWord(wordAt2)) {
      return [words.slice(0, 3), words.slice(3)];
    }
    return [words];
  }

  const k = Math.max(2, Math.round(N / 4.2));

  if (k === 2) {
    let bestSplit = Math.round(N / 2);
    let bestScore = -Infinity;

    for (let split = 3; split <= N - 3; split++) {
      let score = 0;
      const leftLen = split;
      const rightLen = N - split;

      const diff = Math.abs(leftLen - rightLen);
      score -= diff * 1.5;

      if (leftLen > 5) score -= (leftLen - 5) * 1.0;
      if (rightLen > 5) score -= (rightLen - 5) * 1.0;

      const lastLeftWord = getItemWordText(words[split - 1]);
      if (isWeakEndingWord(lastLeftWord)) {
        score -= 5.0;
      }

      const nextWord = getItemWordText(words[split]);
      if (isWeakEndingWord(nextWord)) {
        score += 2.0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSplit = split;
      }
    }

    return [words.slice(0, bestSplit), words.slice(bestSplit)];
  }

  // k >= 3:
  let bestFirstSize = Math.round(N / k);
  let bestFirstScore = -Infinity;

  for (let size = 3; size <= Math.min(5, N - (k - 1) * 3); size++) {
    let score = 0;
    const remaining = N - size;
    const remainingTarget = (k - 1) * 4;
    score -= Math.abs(remaining - remainingTarget) * 1.2;

    const endWord = getItemWordText(words[size - 1]);
    if (isWeakEndingWord(endWord)) score -= 5.0;

    const nextWord = getItemWordText(words[size]);
    if (isWeakEndingWord(nextWord)) score += 2.0;

    if (score > bestFirstScore) {
      bestFirstScore = score;
      bestFirstSize = size;
    }
  }

  const firstChunk = words.slice(0, bestFirstSize);
  const remainingChunks = splitClauseIntoSemanticChunks(words.slice(bestFirstSize));
  return [firstChunk, ...remainingChunks];
}

export function splitWordsSemantically<T extends string | { word: string }>(words: T[]): T[][] {
  if (!words || words.length === 0) return [];

  const sentences: T[][] = [];
  let currentSentence: T[] = [];

  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    const text = getItemWordText(item);
    currentSentence.push(item);
    if (isTerminalPunctuation(text) || i === words.length - 1) {
      sentences.push(currentSentence);
      currentSentence = [];
    }
  }

  const chunks: T[][] = [];

  for (const sentence of sentences) {
    if (sentence.length === 0) continue;

    if (sentence.length <= 5) {
      chunks.push(sentence);
      continue;
    }

    const pauseIndices: number[] = [];
    for (let i = 0; i < sentence.length - 1; i++) {
      if (isClausePausePunctuation(getItemWordText(sentence[i]))) {
        pauseIndices.push(i);
      }
    }

    let chosenPause = -1;
    for (const pIdx of pauseIndices) {
      const leftLen = pIdx + 1;
      const rightLen = sentence.length - leftLen;
      if (leftLen >= 3 && rightLen >= 3) {
        chosenPause = pIdx;
        break;
      }
    }

    if (chosenPause !== -1) {
      const leftClause = sentence.slice(0, chosenPause + 1);
      const rightClause = sentence.slice(chosenPause + 1);
      chunks.push(...splitClauseIntoSemanticChunks(leftClause));
      chunks.push(...splitClauseIntoSemanticChunks(rightClause));
    } else {
      chunks.push(...splitClauseIntoSemanticChunks(sentence));
    }
  }

  return chunks;
}

/**
 * Agrupa palavras soltas em blocos semânticos e equilibrados (3 a 5 palavras por tela, respeitando pontuações e pausas)
 * e converte segundos em frames (x 30 FPS).
 */
function buildSubtitlesFromWords(
  words: WordTimestamp[],
  _wordsPerChunk = WORDS_PER_SUBTITLE_CHUNK,
  sceneIndex?: number,
  speaker?: SpeakerType,
  characterGender?: 'male' | 'female'
): SubtitleItem[] {
  if (!words || words.length === 0) return [];

  const chunks = splitWordsSemantically(words);
  const subtitles: SubtitleItem[] = [];

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;

    const startSecond = chunk[0].startSecond;
    const endSecond = chunk[chunk.length - 1].endSecond;

    // Calibração de Sincronia: antecipa 10 frames (~333ms) para casar o impacto visual da legenda
    // e o realce das palavras no karaokê com a percepção acústica do espectador
    const SUBTITLE_LEAD_IN_FRAMES = 10;
    const rawFrameStart = Math.floor(startSecond * FPS);
    const frameStart = Math.max(0, rawFrameStart - SUBTITLE_LEAD_IN_FRAMES);
    const frameEnd = Math.max(frameStart + 1, Math.ceil(endSecond * FPS));

    const wordTimings: SubtitleWordTiming[] = chunk.map((w) => {
      const wRawStart = Math.floor(w.startSecond * FPS);
      const wRawEnd = Math.ceil(w.endSecond * FPS);
      const wStart = Math.max(0, wRawStart - SUBTITLE_LEAD_IN_FRAMES);
      const wEnd = Math.max(wStart + 1, wRawEnd - SUBTITLE_LEAD_IN_FRAMES);
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
      ...(typeof sceneIndex === 'number' ? { sceneIndex } : {}),
      ...(speaker ? { speaker } : {}),
      ...(characterGender ? { characterGender } : {}),
    });
  }

  // Evita sobreposição de frame entre legendas consecutivas sem esmagar nenhum bloco
  for (let i = 0; i < subtitles.length - 1; i++) {
    if (subtitles[i + 1].frameStart <= subtitles[i].frameStart) {
      subtitles[i + 1].frameStart = subtitles[i].frameStart + 10;
    }
    if (subtitles[i].frameEnd >= subtitles[i + 1].frameStart) {
      subtitles[i].frameEnd = Math.max(
        subtitles[i].frameStart + 5,
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
  options?: { previous_text?: string; next_text?: string; voiceId?: string }
): Promise<ElevenLabsWithTimestampsResponse> {
  const targetVoiceId =
    options?.voiceId ||
    SPEAKER_VOICE_MAP[speaker] ||
    SPEAKER_VOICE_MAP.protagonist;

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
  const manifestItems: ChunkManifestItem[] = [];
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
  let nextVisualStartSecond = 0;

  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    const sceneVisualStartSecond = nextVisualStartSecond;
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

    for (let dIdx = 0; dIdx < dialoguesToSynthesize.length; dIdx++) {
      const dialogue = dialoguesToSynthesize[dIdx];
      const chunkId = chunkCounter++;
      console.log(
        `[ElevenLabs] Gerando chunk #${chunkId} (cena #${index + 1}, fala #${dIdx + 1}, speaker: "${dialogue.speaker}", voiceId: "${dialogue.voiceId || 'default'}", character: "${dialogue.characterName || 'N/A'}")...`
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
        {
          previous_text: prevText,
          next_text: nextText,
          voiceId: dialogue.voiceId,
        }
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
      const charGender: 'male' | 'female' | undefined =
        dialogue.speaker === 'character'
          ? (findVoiceById(dialogue.voiceId)?.gender === 'female'
              ? 'female'
              : 'male')
          : undefined;

      const sceneSubtitles = buildSubtitlesFromWords(
        sceneWords,
        WORDS_PER_SUBTITLE_CHUNK,
        index,
        dialogue.speaker,
        charGender
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

      manifestItems.push({
        chunkId,
        fileName: `chunk_${chunkId}.mp3`,
        sceneIndex: index,
        dialogueIndex: dIdx,
        dialogueId: dialogue.id,
        speaker: dialogue.speaker,
        voiceId: dialogue.voiceId,
        characterName: dialogue.characterName,
        text: dialogue.text,
        alignment,
        durationSeconds: chunkDurationSeconds,
      });

      cumulativeDurationSeconds += chunkDurationSeconds;
    }

    const sceneSpeechEndSecond = cumulativeDurationSeconds;
    let sceneVisualEndSecond: number;

    if (index < scenes.length - 1) {
      const silenceFilePath = path.join(
        chunksDir,
        `silence_inter_scene_${index}.mp3`
      );
      await ensureSilentMp3File(silenceFilePath, INTER_SCENE_PADDING_SECONDS);
      chunkFilePaths.push(silenceFilePath);

      const postRoll =
        INTER_SCENE_PADDING_SECONDS * INTER_SCENE_POST_ROLL_RATIO;
      sceneVisualEndSecond = sceneSpeechEndSecond + postRoll;
      nextVisualStartSecond = sceneVisualEndSecond;
      cumulativeDurationSeconds += INTER_SCENE_PADDING_SECONDS;
    } else {
      sceneVisualEndSecond = sceneSpeechEndSecond;
    }

    rawSceneTimings.push({
      startSecond: sceneVisualStartSecond,
      endSecond: sceneVisualEndSecond,
    });
  }

  // Evita sobreposição de frame entre legendas na transição entre cenas sem esmagar nenhum bloco
  for (let i = 0; i < allSubtitles.length - 1; i++) {
    if (allSubtitles[i + 1].frameStart <= allSubtitles[i].frameStart) {
      allSubtitles[i + 1].frameStart = allSubtitles[i].frameStart + 10;
    }
    if (allSubtitles[i].frameEnd >= allSubtitles[i + 1].frameStart) {
      allSubtitles[i].frameEnd = Math.max(
        allSubtitles[i].frameStart + 5,
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

  // Salva o manifest com metadados e alignments de cada chunk para permitir regravação pontual cirúrgica
  const manifestFilePath = path.join(chunksDir, 'chunks_manifest.json');
  fs.writeFileSync(
    manifestFilePath,
    JSON.stringify({ items: manifestItems }, null, 2),
    'utf-8'
  );
  console.log(`[ElevenLabs] Manifest salvo em ${manifestFilePath} com ${manifestItems.length} chunks.`);

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
 * Remonta o áudio final (audio.mp3), timestamps das legendas e timeline das cenas a partir dos chunks existentes
 */
export async function rebuildNarrationFromChunks({
  videoId,
  manifestItems,
  scenes,
  storageVideoDir,
  publicBaseUrl,
}: {
  videoId: string;
  manifestItems: ChunkManifestItem[];
  scenes: ScriptScene[];
  storageVideoDir: string;
  publicBaseUrl: string;
}): Promise<NarrationSyncResult> {
  const chunksDir = path.join(storageVideoDir, 'chunks');
  const chunkFilePaths: string[] = [];
  const allSubtitles: SubtitleItem[] = [];
  const rawSceneTimings: Array<{ startSecond: number; endSecond: number }> = [];

  const mergedAlignment: ElevenLabsAlignment = {
    characters: [],
    character_start_times_seconds: [],
    character_end_times_seconds: [],
  };

  let cumulativeDurationSeconds = 0;
  let nextVisualStartSecond = 0;

  for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
    const sceneVisualStartSecond = nextVisualStartSecond;
    const sceneChunks = manifestItems.filter((m) => m.sceneIndex === sIdx);

    for (const chunk of sceneChunks) {
      chunkFilePaths.push(path.join(chunksDir, chunk.fileName));
      const alignment = chunk.alignment;
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

      if (mergedAlignment.characters.length > 0) {
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

      const sceneWords = extractWordsFromAlignment(shiftedChunkAlignment);
      const charGender: 'male' | 'female' | undefined =
        chunk.speaker === 'character'
          ? (findVoiceById(chunk.voiceId)?.gender === 'female'
              ? 'female'
              : 'male')
          : undefined;

      const sceneSubtitles = buildSubtitlesFromWords(
        sceneWords,
        WORDS_PER_SUBTITLE_CHUNK,
        sIdx,
        chunk.speaker,
        charGender
      );
      allSubtitles.push(...sceneSubtitles);

      cumulativeDurationSeconds += chunk.durationSeconds;
    }

    const sceneSpeechEndSecond = cumulativeDurationSeconds;
    let sceneVisualEndSecond: number;

    if (sIdx < scenes.length - 1) {
      const silenceFilePath = path.join(
        chunksDir,
        `silence_inter_scene_${sIdx}.mp3`
      );
      await ensureSilentMp3File(silenceFilePath, INTER_SCENE_PADDING_SECONDS);
      chunkFilePaths.push(silenceFilePath);

      const postRoll =
        INTER_SCENE_PADDING_SECONDS * INTER_SCENE_POST_ROLL_RATIO;
      sceneVisualEndSecond = sceneSpeechEndSecond + postRoll;
      nextVisualStartSecond = sceneVisualEndSecond;
      cumulativeDurationSeconds += INTER_SCENE_PADDING_SECONDS;
    } else {
      sceneVisualEndSecond = sceneSpeechEndSecond;
    }

    rawSceneTimings.push({
      startSecond: sceneVisualStartSecond,
      endSecond: sceneVisualEndSecond,
    });
  }

  for (let i = 0; i < allSubtitles.length - 1; i++) {
    if (allSubtitles[i + 1].frameStart <= allSubtitles[i].frameStart) {
      allSubtitles[i + 1].frameStart = allSubtitles[i].frameStart + 10;
    }
    if (allSubtitles[i].frameEnd >= allSubtitles[i + 1].frameStart) {
      allSubtitles[i].frameEnd = Math.max(
        allSubtitles[i].frameStart + 5,
        allSubtitles[i + 1].frameStart - 1
      );
    }
  }

  const finalAudioFilePath = path.join(storageVideoDir, 'audio.mp3');
  console.log(
    `[FFmpeg] Re-concatenando ${chunkFilePaths.length} chunks de áudio em ${finalAudioFilePath}...`
  );
  await concatenateAudioChunks(chunkFilePaths, finalAudioFilePath, chunksDir);

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
 * Regrava cirurgicamente uma única frase/diálogo na ElevenLabs e remonta o áudio global do vídeo
 */
export async function regenerateSingleDialogueNarration({
  videoId,
  sceneIndex,
  dialogueIndex,
  speaker,
  voiceId,
  characterName,
  text,
  scenes,
  storageVideoDir,
  publicBaseUrl,
}: {
  videoId: string;
  sceneIndex: number;
  dialogueIndex: number;
  speaker: SpeakerType;
  voiceId?: string;
  characterName?: string;
  text?: string;
  scenes: ScriptScene[];
  storageVideoDir: string;
  publicBaseUrl: string;
}): Promise<NarrationSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY não configurada no ficheiro backend/.env.'
    );
  }

  const chunksDir = path.join(storageVideoDir, 'chunks');
  const manifestPath = path.join(chunksDir, 'chunks_manifest.json');

  // Atualiza as cenas com o novo speaker/voiceId/characterName/text
  const updatedScenes = scenes.map((sc, sIdx) => {
    if (sIdx !== sceneIndex) return sc;
    const dialogues =
      sc.dialogues && sc.dialogues.length > 0
        ? sc.dialogues
        : [
            {
              id: `dlg_${sIdx}`,
              speaker: sc.speaker || 'protagonist',
              text: sc.text || '',
            },
          ];
    const updatedDialogues = dialogues.map((d, dIdx) => {
      if (dIdx !== dialogueIndex) return d;
      return {
        ...d,
        speaker,
        voiceId,
        characterName,
        text: text?.trim() || d.text,
      };
    });
    return {
      ...sc,
      speaker: updatedDialogues[0]?.speaker || sc.speaker,
      dialogues: updatedDialogues,
      text: updatedDialogues.map((d) => d.text).join(' '),
    };
  });

  // Se a pasta chunks ou manifest não existir, executa geração global para criar o cache de chunks
  if (!fs.existsSync(chunksDir) || !fs.existsSync(manifestPath)) {
    console.log(
      `[ElevenLabs] Manifest não encontrado em ${manifestPath}. Gerando narração global para criar cache de chunks...`
    );
    return generateNarrationWithTimestamps(
      videoId,
      updatedScenes,
      storageVideoDir,
      publicBaseUrl
    );
  }

  const manifestData: { items: ChunkManifestItem[] } = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8')
  );

  const targetItemIndex = manifestData.items.findIndex(
    (item) =>
      item.sceneIndex === sceneIndex && item.dialogueIndex === dialogueIndex
  );

  if (targetItemIndex === -1) {
    console.warn(
      `[ElevenLabs] Item da cena #${sceneIndex + 1} fala #${dialogueIndex + 1} não encontrado no manifest. Regenerando narração global...`
    );
    return generateNarrationWithTimestamps(
      videoId,
      updatedScenes,
      storageVideoDir,
      publicBaseUrl
    );
  }

  const targetItem = manifestData.items[targetItemIndex];
  const textToSynthesize = text?.trim() || targetItem.text;

  console.log(
    `[ElevenLabs] Regravando cirurgicamente diálogo da cena #${sceneIndex + 1}, fala #${dialogueIndex + 1} (speaker: "${speaker}", voiceId: "${voiceId || 'padrão'}", texto: "${textToSynthesize}")...`
  );

  const prevText =
    targetItemIndex > 0
      ? manifestData.items[targetItemIndex - 1]?.text
      : undefined;
  const isVeryLast = targetItemIndex === manifestData.items.length - 1;
  const nextText = isVeryLast
    ? manifestData.items[0]?.text
    : manifestData.items[targetItemIndex + 1]?.text;

  const data = await synthesizeSceneChunk(textToSynthesize, speaker, apiKey, {
    previous_text: prevText,
    next_text: nextText,
    voiceId,
  });

  const chunkFilePath = path.join(chunksDir, targetItem.fileName);
  fs.writeFileSync(chunkFilePath, Buffer.from(data.audio_base64, 'base64'));

  const alignment = data.alignment || data.normalized_alignment;
  if (!alignment || alignment.character_end_times_seconds.length === 0) {
    throw new Error(
      `A resposta da ElevenLabs para a cena #${sceneIndex + 1} (fala #${dialogueIndex + 1}) não contém dados de alignment válidos.`
    );
  }

  const lastCharEndSec =
    alignment.character_end_times_seconds[
      alignment.character_end_times_seconds.length - 1
    ] ?? 0;
  const newDurationSeconds = await getAudioFileDurationSeconds(
    chunkFilePath,
    lastCharEndSec
  );

  // Atualiza o item no manifest com novo texto, alinhamento e duração
  manifestData.items[targetItemIndex] = {
    ...targetItem,
    text: textToSynthesize,
    speaker,
    voiceId,
    characterName,
    alignment,
    durationSeconds: newDurationSeconds,
  };

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifestData, null, 2),
    'utf-8'
  );

  return rebuildNarrationFromChunks({
    videoId,
    manifestItems: manifestData.items,
    scenes: updatedScenes,
    storageVideoDir,
    publicBaseUrl,
  });
}

/**
 * Pós-processa o áudio gerado pela ElevenLabs Sound Effects via FFmpeg:
 * 1. Remove silêncio inicial morto (silencedetect + atrim) para evitar engasgos e delay no loop;
 * 2. Normaliza o ganho e volume acústico (loudnorm) para presença e clareza no vídeo.
 */
async function optimizeSoundEffectAudio(rawBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const uid = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tmpIn = path.join(tmpDir, `sfx_raw_${uid}.mp3`);
  const tmpOut = path.join(tmpDir, `sfx_opt_${uid}.mp3`);

  try {
    fs.writeFileSync(tmpIn, rawBuffer);

    // 1. Detecta silêncio no início via silencedetect
    let silenceStartOffset = 0;
    await new Promise<void>((resolve) => {
      ffmpeg(tmpIn)
        .audioFilters('silencedetect=noise=-40dB:d=0.03')
        .output('NUL')
        .format('null')
        .on('stderr', (line: string) => {
          const matchEnd = line.match(/silence_end:\s*([\d.]+)/);
          if (matchEnd && silenceStartOffset === 0) {
            const endSec = parseFloat(matchEnd[1]);
            if (endSec > 0.02 && endSec < 2.0) {
              silenceStartOffset = endSec;
            }
          }
        })
        .on('end', () => resolve())
        .on('error', () => resolve())
        .run();
    });

    // 2. Aplica corte do silêncio inicial (se detectado) + normalização de loudness
    const filters: string[] = [];
    if (silenceStartOffset > 0.02) {
      filters.push(`atrim=start=${silenceStartOffset.toFixed(3)}`);
    }
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpIn)
        .audioFilters(filters)
        .audioCodec('libmp3lame')
        .save(tmpOut)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 1000) {
      return fs.readFileSync(tmpOut);
    }
    return rawBuffer;
  } catch (err) {
    console.warn(
      '[ElevenLabs] Falha ao pós-processar SFX com FFmpeg, usando áudio original:',
      err
    );
    return rawBuffer;
  } finally {
    try {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      // Ignora erro de limpeza temporária
    }
  }
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
  const rawBuffer = Buffer.from(arrayBuffer);
  return optimizeSoundEffectAudio(rawBuffer);
}
