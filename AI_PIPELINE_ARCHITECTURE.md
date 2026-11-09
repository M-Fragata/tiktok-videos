# Arquitetura da Pipeline de IA — Fragata Shorts

Este documento especifica a arquitetura técnica e a implementação detalhada dos **3 pilares de Inteligência Artificial** do motor de vídeos automatizados para o TikTok:

1. **O Roteirista (`gemini.service.ts`)**: Geração de roteiro estruturado dividido em cenas com **Google Gemini** (`gemini-3.8-flash`), associando cada cena a uma expressão do Avatar e a um prompt visual específico.
2. **O Narrador e Sincronizador (`elevenlabs.service.ts`)**: Síntese de voz e extração nativa de timestamps caractere-a-caractere via **ElevenLabs (`/with-timestamps`)**, descartando o uso do Whisper para reduzir latência e custos.
3. **O Diretor de Arte (`imagen.service.ts`)**: Geração paralela de múltiplos cenários históricos verticais (`9:16`) por cena com **Google Gemini Image / Imagen** (`gemini-3.1-flash-image`), realizando cortes secos (*hard cuts*) sincronizados com a narração.

---

## 1. Visão Geral da Arquitetura e Orquestração

```mermaid
sequenceDiagram
    autonumber
    participant UI as Front-end (Vite + Player)
    participant API as Back-end (Express)
    participant DB as PostgreSQL (Prisma)
    participant Gem as Google Gemini (Roteirista)
    participant EL as ElevenLabs (/with-timestamps)
    participant Img as Google Imagen (Diretor de Arte)
    participant Rem as @remotion/renderer

    UI->>API: POST /api/generate-video { theme }
    API->>DB: Cria Video (status: "PENDING")
    API-->>UI: 202 Accepted { video }

    Note over API,Gem: Fase 1: Roteiro Estruturado por Cena
    API->>Gem: Gera scenes[{ text, avatarSprite, imagePrompt }]
    Gem-->>API: JSON Estruturado (Cenas)

    Note over API,Img: Fase 2: Execução Paralela (Promise.all)
    par Narração Única + Timestamps
        API->>EL: POST /v1/text-to-speech/:voiceId/with-timestamps
        EL-->>API: audio_base64 + alignment (char timestamps)
        API->>API: Salva storage/<id>/audio.mp3
        API->>API: Calcula durationInFrames, Subtitles (3-5 palavras) e Timelines
    and Múltiplos Cenários (scenes.map)
        API->>Img: Gera 1 imagem (9:16) para cada scene.imagePrompt
        Img-->>API: Imagens Base64
        API->>API: Salva storage/<id>/scene_0.jpg, scene_1.jpg...
    end

    Note over API,DB: Fase 3: Retenção para Edição + Renderização MP4
    API->>DB: Salva remotionProps (JSON completo) no Video
    API->>Rem: selectComposition + renderMedia (durationInFrames dinâmico)
    Rem-->>API: Grava backend/renders/<id>.mp4
    API->>DB: Atualiza status = "RENDERED", videoUrl = "/renders/<id>.mp4"

    Note over UI,Rem: Fase 4 (Opcional): Edição Fina Sem Custo de IA
    UI->>API: GET /api/videos/:id (Carrega remotionProps no @remotion/player)
    UI->>API: POST /api/videos/:id/rerender { remotionProps editadas }
    API->>DB: Atualiza remotionProps e status = "PENDING"
    API->>Rem: Re-renderiza .mp4 usando ficheiros já salvos em /storage/<id>/
    API->>DB: Atualiza status = "RENDERED"
```

---

## 2. Decisões Arquiteturais Consolidadas

| Domínio | Decisão Técnica | Motivação |
| :--- | :--- | :--- |
| **Sincronização de Legendas** | Endpoint nativo `POST /v1/text-to-speech/:voice_id/with-timestamps` da ElevenLabs | Elimina a chamada extra ao Whisper, reduzindo latência em ~4–8s por vídeo e poupando custos de transcrição. |
| **Chunking de Legendas** | Agrupamento de **3 a 5 palavras por tela** com conversão direta `segundos * 30 = frames` | Garante leitura rápida e dinâmica típica de vídeos virais no TikTok. |
| **Duração do Vídeo (`durationInFrames`)** | Calculada no back-end via `Math.ceil((ultimoTimestampSegundos + 0.5) * 30)` e injetada em `inputProps` | Evita que a fala da IA seja cortada ou sobre espaço mudo, sem depender de `calculateMetadata` assíncrono no front-end. |
| **Múltiplos Cenários Dinâmicos** | Cada cena gerada pelo Gemini possui o seu próprio `imagePrompt`; o componente `Background.tsx` recebe `backgroundTimeline` | Maximiza a retenção visual com cortes secos (*hard cuts*) sincronizados com o início de cada frase/cena. |
| **Paralelismo (`Promise.all`)** | Disparo simultâneo da chamada única à ElevenLabs e do `.map()` de imagens por cena | Reduz drasticamente o tempo total de geração dos assets. |
| **Armazenamento e Retenção** | Diretório persistente `backend/storage/<videoId>/` servido em `/storage` + coluna `remotionProps Json?` no Prisma | Permite recarregar o vídeo no `@remotion/player` do front-end, editar legendas/tempos e acionar `POST /api/videos/:id/rerender` sem gastar créditos de IA. |

---

## 3. Evolução do Banco de Dados e Armazenamento

### 3.1. Atualização do Prisma Schema (`backend/prisma/schema.prisma`)

Adicionamos a coluna `remotionProps` do tipo `Json?` para persistir todas as propriedades calculadas (`durationInFrames`, `audioSrc`, `subtitles`, `avatarTimeline`, `backgroundTimeline`):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Video {
  id            String   @id @default(uuid())
  theme         String
  status        String   @default("PENDING") // PENDING | RENDERED | FAILED
  videoUrl      String?
  remotionProps Json?
  createdAt     DateTime @default(now())

  @@map("videos")
}
```

### 3.2. Estrutura de Diretórios de Armazenamento (`backend/storage/`)

Para cada vídeo com ID `<videoId>`, os assets brutos ficam retidos em disco e expostos via Express (`app.use('/storage', express.static(STORAGE_DIR))`):

```text
backend/
├── storage/
│   └── <videoId>/
│       ├── audio.mp3          # Narração gerada pela ElevenLabs
│       ├── scene_0.jpg        # Cenário da Cena 0 (9:16)
│       ├── scene_1.jpg        # Cenário da Cena 1 (9:16)
│       └── scene_2.jpg        # Cenário da Cena 2 (9:16)
└── renders/
    └── <videoId>.mp4          # Vídeo final renderizado pelo Remotion
```

### 3.3. Variáveis de Ambiente (`backend/.env.example`)

```env
PORT=3333
PUBLIC_BASE_URL="http://localhost:3333"
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/tiktok_videos?schema=public"

# Google Gemini & Imagen (@google/genai)
GEMINI_API_KEY="sua-chave-gemini-aqui"

# ElevenLabs TTS
ELEVENLABS_API_KEY="sua-chave-elevenlabs-aqui"
ELEVENLABS_VOICE_ID="JBFqnCBsd6RMkjVDRZzb"
```

---

## 4. Especificação dos 3 Serviços de IA no Back-end

### 4.1. Pilar 1: O Roteirista (`backend/src/services/gemini.service.ts`)

Utiliza o SDK oficial `@google/genai` (`>= 2.3.0`) com o modelo `gemini-3.8-flash` e **Structured Output (`response_format`)** para garantir que o retorno respeite estritamente o contrato JSON de cenas e utilize apenas os 12 ficheiros de avatar existentes em `frontend/public/avatars/`.

```ts
// backend/src/services/gemini.service.ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

export interface ScriptScene {
  text: string;
  avatarSprite: AvatarSprite;
  imagePrompt: string;
}

export interface GeneratedScript {
  scenes: ScriptScene[];
}

export async function generateTimeMachineScript(
  theme: string
): Promise<GeneratedScript> {
  const interaction = await ai.interactions.create({
    model: 'gemini-3.8-flash',
    system_instruction: `És um roteirista especialista em vídeos curtos virais para o TikTok no nicho "Máquina do Tempo / História".
Cria um roteiro dinâmico em Português dividido entre 3 a 5 cenas curtas (totalizando cerca de 15 a 25 segundos de fala).
Regras obrigatórias:
1. A primeira cena deve começar com um gancho forte de viajante do tempo.
2. O campo "text" de cada cena deve conter apenas o texto falado pelo narrador (sem marcações de cena ou colchetes).
3. O campo "avatarSprite" deve ser escolhido estrategicamente conforme a emoção da frase.
4. O campo "imagePrompt" deve ser uma descrição visual detalhada em INGLÊS para gerar o cenário histórico daquela cena em formato vertical 9:16, estilo cinematográfico hiper-realista, sem texto escrito na imagem.`,
    input: `Tema Histórico da Viagem no Tempo: ${theme}`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        required: ['scenes'],
        properties: {
          scenes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['text', 'avatarSprite', 'imagePrompt'],
              properties: {
                text: {
                  type: 'string',
                  description: 'Fala do narrador para esta cena.',
                },
                avatarSprite: {
                  type: 'string',
                  enum: [...VALID_AVATAR_SPRITES],
                  description: 'Sprite do avatar correspondente à emoção da cena.',
                },
                imagePrompt: {
                  type: 'string',
                  description:
                    'Prompt detalhado em inglês para gerar a imagem de fundo 9:16 desta cena.',
                },
              },
            },
          },
        },
      },
    },
  });

  if (!interaction.output_text) {
    throw new Error('O Gemini não retornou texto para o roteiro.');
  }

  return JSON.parse(interaction.output_text) as GeneratedScript;
}
```

---

### 4.2. Pilar 2: O Narrador e Sincronizador (`backend/src/services/elevenlabs.service.ts`)

Responsável por:
1. Concatenar as falas das cenas (`scenes.map(s => s.text.trim()).join(' ')`), registando o intervalo exato de caracteres (`charStart` e `charEnd`) de cada cena.
2. Chamar `POST https://api.elevenlabs.io/v1/text-to-speech/:voice_id/with-timestamps`.
3. Gravar o `audio_base64` em `backend/storage/<videoId>/audio.mp3`.
4. Converter o array `alignment` (`characters`, `character_start_times_seconds`, `character_end_times_seconds`) em:
   - `subtitles: SubtitleItem[]` (agrupados de **3 a 5 palavras por tela**, com `frameStart = Math.floor(start * 30)` e `frameEnd = Math.ceil(end * 30)`).
   - `sceneTimings`: o `startSecond`, `endSecond`, `frameStart` e `frameEnd` exatos de cada cena para alimentar o `avatarTimeline` e o `backgroundTimeline` (garantindo que o corte seco do cenário aconteça exatamente no frame inicial da cena).
   - `durationInFrames = Math.ceil((ultimoTimestampSegundos + 0.5) * 30)`.

```ts
// backend/src/services/elevenlabs.service.ts
import fs from 'node:fs';
import path from 'node:path';
import type { ScriptScene } from './gemini.service.ts';

const FPS = 30;
const WORDS_PER_SUBTITLE_CHUNK = 4; // Entre 3 a 5 palavras por tela

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
 * Converte o array de caracteres da ElevenLabs em palavras com timestamps exatos.
 */
function extractWordsFromAlignment(alignment: ElevenLabsAlignment): WordTimestamp[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } =
    alignment;

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
 * Agrupa palavras em blocos curtos (3 a 5 palavras) e converte segundos em frames (30 FPS).
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

  // Evita sobreposição de 1 frame entre legendas consecutivas
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

export async function generateNarrationWithTimestamps(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<NarrationSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY não configurada no .env');
  }

  // 1. Monta o texto completo e mapeia o intervalo de caracteres de cada cena
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

  // 2. Chama o endpoint nativo /with-timestamps da ElevenLabs
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
    throw new Error(`Erro na API da ElevenLabs (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ElevenLabsWithTimestampsResponse;

  // 3. Salva o ficheiro de áudio em backend/storage/<videoId>/audio.mp3
  fs.mkdirSync(storageVideoDir, { recursive: true });
  const audioFilePath = path.join(storageVideoDir, 'audio.mp3');
  fs.writeFileSync(audioFilePath, Buffer.from(data.audio_base64, 'base64'));

  // 4. Processa o alignment para calcular durationInFrames e legendas
  const alignment = data.alignment || data.normalized_alignment;
  if (!alignment || alignment.character_end_times_seconds.length === 0) {
    throw new Error('A ElevenLabs não retornou dados de alignment.');
  }

  const endTimes = alignment.character_end_times_seconds;
  const lastTimestampSeconds = endTimes[endTimes.length - 1] ?? 15;
  const durationInFrames = Math.ceil((lastTimestampSeconds + 0.5) * FPS);

  const words = extractWordsFromAlignment(alignment);
  const subtitles = buildSubtitlesFromWords(words, WORDS_PER_SUBTITLE_CHUNK);

  // 5. Calcula os tempos exatos de cada cena para sincronizar Avatar e Cenários (Hard Cut)
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
      idx === 0 ? 0 : (alignment.character_start_times_seconds[safeStartIdx] ?? 0);
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

  // Garante continuidade sem buracos de frames entre cenas consecutivas
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
```

---

### 4.3. Pilar 3: O Diretor de Arte (`backend/src/services/imagen.service.ts`)

Gera em paralelo (`Promise.all(scenes.map(...))`) uma imagem vertical `9:16` para cada cena do roteiro usando `@google/genai` (`gemini-3.1-flash-image`) e persiste cada imagem em `backend/storage/<videoId>/scene_<index>.jpg`.

```ts
// backend/src/services/imagen.service.ts
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { ScriptScene } from './gemini.service.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Gera uma única imagem de cenário 9:16 para uma cena específica e salva em disco.
 */
async function generateSingleSceneImage(
  imagePrompt: string,
  sceneIndex: number,
  videoId: string,
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string> {
  const interaction = await ai.interactions.create({
    model: 'gemini-3.1-flash-image',
    input: `${imagePrompt}. Vertical 9:16 format, cinematic historical photography, dramatic lighting, ultra-detailed, no text, no watermarks.`,
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '9:16',
      image_size: '1K',
    },
  });

  const generatedImage = interaction.output_image;
  if (!generatedImage?.data) {
    throw new Error(`Falha ao gerar imagem para a cena ${sceneIndex}`);
  }

  fs.mkdirSync(storageVideoDir, { recursive: true });
  const fileName = `scene_${sceneIndex}.jpg`;
  const filePath = path.join(storageVideoDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(generatedImage.data, 'base64'));

  return `${publicBaseUrl}/storage/${videoId}/${fileName}`;
}

/**
 * Dispara simultaneamente a geração de imagem para todas as cenas do roteiro.
 */
export async function generateAllSceneBackgrounds(
  videoId: string,
  scenes: ScriptScene[],
  storageVideoDir: string,
  publicBaseUrl: string
): Promise<string[]> {
  return Promise.all(
    scenes.map((scene, index) =>
      generateSingleSceneImage(
        scene.imagePrompt,
        index,
        videoId,
        storageVideoDir,
        publicBaseUrl
      )
    )
  );
}
```

---

## 5. Orquestração no Back-end (Express Controllers & Rotas)

### 5.1. Rotas Semânticas (`backend/src/routes/video.routes.ts`)

- `POST /api/generate-video`: Recebe apenas `{ theme }`, executa o Gemini, dispara `Promise.all` para ElevenLabs + Imagen (`.map()`), monta e salva `remotionProps` no Prisma e renderiza o `.mp4`.
- `POST /api/videos/:id/rerender`: Recebe as `remotionProps` editadas no front-end (`subtitles`, `avatarTimeline`, `backgroundTimeline`, `durationInFrames`), atualiza o JSON no banco e re-renderiza o `.mp4` usando os ficheiros já existentes em `backend/storage/<videoId>/` (zero custo de IA).
- `GET /api/videos/:id` e `GET /api/videos`: Consulta de status e carregamento de `remotionProps` no `@remotion/player`.

### 5.2. Orquestrador de Geração (`backend/src/controllers/video.controller.ts`)

```ts
// Fluxo interno do POST /api/generate-video em background:
const storageVideoDir = path.join(STORAGE_OUTPUT_DIR, videoRecord.id);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Passo 1: Roteirista (Gemini) gera as cenas com { text, avatarSprite, imagePrompt }
const { scenes } = await generateTimeMachineScript(inputData.theme);

// Passo 2: Execução Paralela — ElevenLabs (Áudio + Timestamps) + Imagen (scenes.map)
const [narrationResult, sceneImageUrls] = await Promise.all([
  generateNarrationWithTimestamps(
    videoRecord.id,
    scenes,
    storageVideoDir,
    publicBaseUrl
  ),
  generateAllSceneBackgrounds(
    videoRecord.id,
    scenes,
    storageVideoDir,
    publicBaseUrl
  ),
]);

// Passo 3: Monta o backgroundTimeline sincronizado com os frames de cada cena
const backgroundTimeline = narrationResult.sceneTimings.map((timing, idx) => ({
  imageSrc: sceneImageUrls[idx],
  frameStart: timing.frameStart,
  frameEnd: timing.frameEnd,
}));

// Passo 4: Monta o objeto completo remotionProps (inputProps)
const remotionProps = {
  theme: inputData.theme,
  durationInFrames: narrationResult.durationInFrames,
  audioSrc: narrationResult.audioUrl,
  subtitles: narrationResult.subtitles,
  avatarTimeline: narrationResult.avatarTimeline,
  backgroundTimeline,
};

// Passo 5: Salva remotionProps no Prisma para permitir edição futura no @remotion/player
await prisma.video.update({
  where: { id: videoRecord.id },
  data: { remotionProps },
});

// Passo 6: Renderiza o ficheiro .mp4 no disco com a duração dinâmica
const { publicVideoUrl } = await renderTimeMachineVideoOnDisk(
  videoRecord.id,
  remotionProps
);

await prisma.video.update({
  where: { id: videoRecord.id },
  data: {
    status: 'RENDERED',
    videoUrl: publicVideoUrl,
  },
});
```

### 5.3. Suporte à Duração Dinâmica no `@remotion/renderer` (`backend/src/services/remotion.service.ts`)

Como o back-end já calculou `durationInFrames = Math.ceil((ultimoTimestampSegundos + 0.5) * 30)`, basta sobrescrever `composition.durationInFrames` antes de invocar `renderMedia`:

```ts
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'TimeMachineVideo',
  inputProps,
});

// Aplica a duração dinâmica calculada a partir do último timestamp da ElevenLabs
if (inputProps.durationInFrames && inputProps.durationInFrames > 0) {
  composition.durationInFrames = inputProps.durationInFrames;
}

await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: outputFilePath,
  inputProps,
});
```

---

## 6. Atualizações no Front-end (Remotion)

### 6.1. Novas Tipagens (`frontend/src/remotion/types.ts`)

Adição de `BackgroundSegment`, `backgroundTimeline` e `durationInFrames`:

```ts
export interface BackgroundSegment {
  imageSrc: string;
  frameStart: number;
  frameEnd: number;
}

export type TimeMachineVideoProps = {
  theme: string;
  durationInFrames?: number;
  backgroundSrc?: string; // Fallback caso backgroundTimeline não seja enviado
  backgroundTimeline?: BackgroundSegment[];
  audioSrc?: string;
  subtitles?: SubtitleItem[];
  avatarTimeline?: AvatarSegment[];
};
```

### 6.2. Componente `Background.tsx` com Múltiplos Cenários e Corte Seco (*Hard Cut*)

O componente verifica o frame atual (`useCurrentFrame()`) contra o array `backgroundTimeline`, efetuando o corte seco exato para o cenário correspondente à cena ativa e aplicando um efeito de zoom lento individual por cena:

```tsx
// frontend/src/remotion/components/Background.tsx
import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BackgroundSegment, resolveAssetSrc } from '../types';

export interface BackgroundProps {
  src?: string;
  backgroundTimeline?: BackgroundSegment[];
  theme?: string;
}

export const Background: React.FC<BackgroundProps> = ({
  src = 'background.jpg',
  backgroundTimeline,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Seleciona o cenário ativo da cena atual (Hard Cut)
  const activeSegment = backgroundTimeline?.find(
    (segment) => frame >= segment.frameStart && frame <= segment.frameEnd
  );

  const activeImageSrc = activeSegment ? activeSegment.imageSrc : src;
  const segmentStart = activeSegment ? activeSegment.frameStart : 0;
  const segmentEnd = activeSegment ? activeSegment.frameEnd : durationInFrames;

  // Zoom progressivo reiniciado a cada corte seco de cena
  const scale = interpolate(
    frame,
    [segmentStart, Math.max(segmentStart + 1, segmentEnd)],
    [1, 1.1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#090d16' }}>
      <Img
        src={resolveAssetSrc(activeImageSrc)}
        alt={theme ?? 'Cenário Histórico'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
      {/* Vinheta de contraste e badge superior mantidos */}
    </AbsoluteFill>
  );
};
```

---

## 7. Checklist de Implementação (Próximos Passos)

- [x] **Passo 1**: Instalar `@google/genai` no `/backend` (`npm --prefix backend install @google/genai`) e adicionar `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID` ao `backend/.env`.
- [x] **Passo 2**: Atualizar `backend/prisma/schema.prisma` com o campo `remotionProps Json?` e rodar `npm --prefix backend run db:push`.
- [x] **Passo 3**: Criar os 3 serviços em `backend/src/services/`:
  - `gemini.service.ts` (Roteirista com cenas e `imagePrompt` individual)
  - `elevenlabs.service.ts` (Narrador e Sincronizador via `/with-timestamps` + chunking de 3–5 palavras + `durationInFrames`)
  - `imagen.service.ts` (Diretor de Arte paralelo com `Promise.all(scenes.map(...))`)
- [x] **Passo 4**: Expor `/storage` estaticamente no `backend/src/server.ts` e implementar as rotas `POST /api/generate-video` e `POST /api/videos/:id/rerender`.
- [x] **Passo 5**: Atualizar `frontend/src/remotion/types.ts`, `Background.tsx` e `App.tsx` para suportar `backgroundTimeline`, `durationInFrames` dinâmico no `<Player />` e edição/re-renderização de vídeos salvos.

