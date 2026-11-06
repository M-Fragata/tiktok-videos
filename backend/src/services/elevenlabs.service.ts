import fs from 'node:fs';
import path from 'node:path';
import type { ScriptScene } from './gemini.service.ts';

const FPS = 30;
const WORDS_PER_SUBTITLE_CHUNK = 4; // Agrupamento de 3 a 5 palavras por tela

export interface SubtitleItem {
  frameStart: number;
  frameEnd: number;
  text: string;
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

    subtitles.push({
      frameStart,
      frameEnd,
      text: chunk.map((w) => w.word).join(' '),
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
 * Pilar 2 (O Narrador e Sincronizador):
 * Chama POST /v1/text-to-speech/:voice_id/with-timestamps da ElevenLabs,
 * salva o áudio em backend/storage/<videoId>/audio.mp3 e calcula os frames exatos.
 */
export async function generateNarrationWithTimestamps(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<NarrationSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY não configurada no ficheiro backend/.env.'
    );
  }

  // 1. Concatena as falas das cenas e regista o intervalo de caracteres de cada cena
  const sceneCharRanges: Array<{ startChar: number; endChar: number }> = [];
  let fullScriptText = '';

  scenes.forEach((scene, index) => {
    const cleanText = scene.text.trim();
    const startChar = fullScriptText.length;
    fullScriptText += cleanText;
    const endChar = fullScriptText.length - 1;
    sceneCharRanges.push({ startChar, endChar });

    if (index < scenes.length - 1) {
      fullScriptText += ' ';
    }
  });

  // 2. Faz a chamada única ao endpoint /with-timestamps da ElevenLabs
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: fullScriptText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erro na API da ElevenLabs (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as ElevenLabsWithTimestampsResponse;

  // 3. Salva o áudio retornado em backend/storage/<videoId>/audio.mp3
  fs.mkdirSync(storageVideoDir, { recursive: true });
  const audioFilePath = path.join(storageVideoDir, 'audio.mp3');
  fs.writeFileSync(audioFilePath, Buffer.from(data.audio_base64, 'base64'));

  // 4. Extrai timestamps e calcula durationInFrames = Math.ceil((ultimoTimestampSegundos + 0.5) * 30)
  const alignment = data.alignment || data.normalized_alignment;
  if (!alignment || alignment.character_end_times_seconds.length === 0) {
    throw new Error(
      'A resposta da ElevenLabs não contém dados de alignment válidos.'
    );
  }

  const endTimes = alignment.character_end_times_seconds;
  const ultimoTimestampSegundos = endTimes[endTimes.length - 1] ?? 15;
  const durationInFrames = Math.ceil((ultimoTimestampSegundos + 0.5) * FPS);

  const words = extractWordsFromAlignment(alignment);
  const subtitles = buildSubtitlesFromWords(words, WORDS_PER_SUBTITLE_CHUNK);

  // 5. Calcula os intervalos exatos de cada cena (para Avatar e Hard Cut de Background)
  const totalSeconds = durationInFrames / FPS;
  const sceneTimings: SceneFrameTiming[] = sceneCharRanges.map((range, idx) => {
    const safeStartIdx = Math.min(
      range.startChar,
      alignment.character_start_times_seconds.length - 1
    );
    const safeEndIdx = Math.min(
      range.endChar,
      alignment.character_end_times_seconds.length - 1
    );

    const startSecond =
      idx === 0
        ? 0
        : (alignment.character_start_times_seconds[safeStartIdx] ?? 0);
    const endSecond =
      idx === scenes.length - 1
        ? totalSeconds
        : (alignment.character_end_times_seconds[safeEndIdx] ?? totalSeconds);

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

  // Garante continuidade sem lacunas entre o fim de uma cena e o início da próxima
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
    subtitles,
    avatarTimeline,
    sceneTimings,
  };
}

