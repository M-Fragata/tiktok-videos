import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VoiceDefinition {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age?: string;
  style?: string;
  description: string;
  preview_url?: string;
}

export interface VoiceCatalog {
  narrator: VoiceDefinition;
  protagonist: VoiceDefinition;
  characters: VoiceDefinition[];
}

const VOICES_CONFIG_PATH = path.resolve(__dirname, '../config/voices.json');

let cachedCatalog: VoiceCatalog | null = null;

export function loadVoiceCatalog(): VoiceCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  try {
    const raw = fs.readFileSync(VOICES_CONFIG_PATH, 'utf-8');
    cachedCatalog = JSON.parse(raw) as VoiceCatalog;
    return cachedCatalog;
  } catch (err) {
    console.error(`[VoiceCatalog] Erro ao carregar ${VOICES_CONFIG_PATH}:`, err);
    // Fallback defensivo
    return {
      narrator: {
        id: 'TX3LPaxmHKxFdv7VOQHJ',
        name: 'Liam',
        gender: 'male',
        description: 'Voz do narrador',
      },
      protagonist: {
        id: 'SOYHLrjzK2X1ezoPC6cr',
        name: 'Harry',
        gender: 'male',
        description: 'Voz do protagonista',
      },
      characters: [
        {
          id: 'N2lVS1w4EtoT3dr4eOWO',
          name: 'Callum',
          gender: 'male',
          description: 'Voz masculina padrão de personagem',
        },
        {
          id: 'EXAVITQu4vr4xnSDxMaL',
          name: 'Sarah',
          gender: 'female',
          description: 'Voz feminina padrão de personagem',
        },
      ],
    };
  }
}

export function getNarratorVoice(): VoiceDefinition {
  return loadVoiceCatalog().narrator;
}

export function getProtagonistVoice(): VoiceDefinition {
  return loadVoiceCatalog().protagonist;
}

export function getCharacterVoices(): VoiceDefinition[] {
  return loadVoiceCatalog().characters;
}

export function findVoiceById(id?: string): VoiceDefinition | undefined {
  if (!id) return undefined;
  const catalog = loadVoiceCatalog();
  if (catalog.narrator.id === id) return catalog.narrator;
  if (catalog.protagonist.id === id) return catalog.protagonist;
  return catalog.characters.find((c) => c.id === id);
}

/**
 * Retorna o bloco textual formatado do catálogo para injeção no prompt do Gemini,
 * instruindo a IA a escolher a voz correta para cada personagem histórico secundário.
 */
export function getCharacterVoicesPromptPart(): string {
  const characters = getCharacterVoices();
  const lines = characters.map((c) => {
    const genderLabel = c.gender === 'female' ? 'Feminina' : 'Masculina';
    return `  - ID: "${c.id}" | Nome: ${c.name} (${genderLabel}, ${c.age || 'adulto'}) -> ${c.description}`;
  });

  return `CATÁLOGO DE VOZES DISPONÍVEIS PARA PERSONAGENS SECUNDÁRIOS ("character"):
Quando uma cena tiver fala de personagem histórico secundário ("speaker": "character"), deves OBRIGATORIAMENTE:
1. Definir o campo "characterName" com o nome da figura histórica ou papel (ex: "Cleópatra", "Napoleão", "Sa'im al-Dahr", "Guarda Romano").
2. Avaliar o gênero e tom do personagem e escolher o "voiceId" correspondente dentre as seguintes opções:
${lines.join('\n')}
3. CONSISTÊNCIA DE VOZ: Se a mesma figura histórica falar em múltiplas cenas, DEVES MANTER O MESMO "characterName" E O MESMO "voiceId" em todas as suas falas!`;
}

