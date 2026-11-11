import type { VoiceCatalog, VoiceDefinition } from '../remotion/types';

export const DEFAULT_VOICE_CATALOG: VoiceCatalog = {
  narrator: {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    gender: 'male',
    age: 'young',
    style: 'Energetic, Social Media Creator',
    description: 'Voz masculina jovem e dinâmica de locutor moderno',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3',
  },
  protagonist: {
    id: 'SOYHLrjzK2X1ezoPC6cr',
    name: 'Harry',
    gender: 'male',
    age: 'young',
    style: 'Fierce Warrior / Expressive',
    description: 'Voz masculina jovem, enérgica e expressiva para o aventureiro',
    preview_url:
      'https://storage.googleapis.com/eleven-public-prod/premade/voices/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3',
  },
  characters: [
    {
      id: 'N2lVS1w4EtoT3dr4eOWO',
      name: 'Callum',
      gender: 'male',
      age: 'middle_aged',
      style: 'Husky Trickster',
      description: 'Malandro / cômico',
      preview_url:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3',
    },
    {
      id: 'JBFqnCBsd6RMkjVDRZzb',
      name: 'George',
      gender: 'male',
      age: 'middle_aged',
      style: 'Warm Storyteller',
      description: 'Imponente / líder / nobre',
      preview_url:
        'https://api.us.elevenlabs.io/v1/voices/JBFqnCBsd6RMkjVDRZzb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiJlNjIwNmQxYS0wNzIxLTQ3ODctYWFmYi0wNmE2ZTcwNWNhYzUubXAzIiwidGltZXN0YW1wIjoxNzk0NDIzNjAwMDAwMDAwfQ%3D%3D',
    },
    {
      id: 'EXAVITQu4vr4xnSDxMaL',
      name: 'Sarah',
      gender: 'female',
      age: 'young',
      style: 'Confident & Mature',
      description: 'Firme / rainha / líder',
      preview_url:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3',
    },
    {
      id: 'cgSgspJ2msm6clMCkdW9',
      name: 'Jessica',
      gender: 'female',
      age: 'young',
      style: 'Playful & Warm',
      description: 'Jovem / alegre / plebeia',
      preview_url:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3',
    },
    {
      id: 'hpp4J3VqNfWAUOO0d1Us',
      name: 'Bella',
      gender: 'female',
      age: 'middle_aged',
      style: 'Professional & Warm',
      description: 'Calorosa / sacerdotisa / sábia',
      preview_url:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3',
    },
    {
      id: 'Xb7hH8MSUJpSbSDYk0k2',
      name: 'Alice',
      gender: 'female',
      age: 'middle_aged',
      style: 'Clear & Refined',
      description: 'Refinada / nobre / educada',
      preview_url:
        'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3',
    },
  ],
};

let cachedCatalog: VoiceCatalog = DEFAULT_VOICE_CATALOG;

export async function fetchVoiceCatalog(): Promise<VoiceCatalog> {
  try {
    const res = await fetch('/api/voices');
    if (res.ok) {
      cachedCatalog = (await res.json()) as VoiceCatalog;
    }
  } catch (err) {
    console.warn('[VoiceCatalog] Usando catálogo padrão:', err);
  }
  return cachedCatalog;
}

export function getCachedVoiceCatalog(): VoiceCatalog {
  return cachedCatalog;
}

