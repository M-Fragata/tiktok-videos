import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.ts';
import type { PromoteSfxInput, RenderVideoInput } from '../schemas/video.schema.ts';

export interface SfxOption {
  value: string;
  label: string;
  file: string | null;
  prompt?: string;
  isCustom?: boolean;
}

export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const FRONTEND_EFFECTS_DIR = path.resolve(
  import.meta.dirname,
  '../../../frontend/public/bgm/effects'
);

export const DEFAULT_SFX_OPTIONS: SfxOption[] = [
  {
    value: 'whoosh',
    label: '💨 Whoosh (Transição Padrão)',
    file: 'bgm/effects/whoosh.mp3',
    prompt: 'Transição suave ou movimento de cena padrão',
  },
  {
    value: 'swoosh',
    label: '⚡ Swoosh (Corte Rápido)',
    file: 'bgm/effects/swoosh.wav',
    prompt: 'Corte rápido, chicotada ou ação súbita',
  },
  {
    value: 'cannon-artillery',
    label: '💥 Tiro de Canhão / Artilharia',
    file: 'bgm/effects/cannon-artillery.wav',
    prompt: 'Explosão de tiro de canhão, bombardeio ou artilharia pesada',
  },
  {
    value: 'record-scratch',
    label: '🛑 Quebra de 4ª Parede (Scratch)',
    file: 'bgm/effects/record-scratch.wav',
    prompt: 'Quebra cômica da 4ª parede, parada brusca de disco ou erro hilário do Billy',
  },
  {
    value: 'cartoon-blink',
    label: '👀 Efeito Cômico (Blink)',
    file: 'bgm/effects/cartoon-blink.mp3',
    prompt: 'Efeito sonoro cartunesco, piscada cômica, momento bobo ou confusão visual',
  },
  {
    value: 'riser-hit',
    label: '🔥 Gancho Tenso (Riser Hit)',
    file: 'bgm/effects/riser-hit.wav',
    prompt: 'Impacto dramático tenso, choque inesperado ou gancho de suspense',
  },
  {
    value: 'heartbeat',
    label: '💓 Tensão Máxima (Heartbeat)',
    file: 'bgm/effects/heartbeat.wav',
    prompt: 'Batimento cardíaco acelerado sob perigo iminente ou adrenalina alta',
  },
  {
    value: 'metal-hits',
    label: '🔨 Impacto de Metal / Bigorna',
    file: 'bgm/effects/metal-hits.mp3',
    prompt: 'Impacto pesado de metal, martelada em bigorna ou queda de armadura de metal',
  },
  {
    value: 'sword-clash',
    label: '⚔️ Choque de Espadas',
    file: 'bgm/effects/sword-clash.wav',
    prompt: 'Choque estridente de lâminas de espadas em duelo corpo a corpo',
  },
  {
    value: 'sword-draw',
    label: '🗡️ Desembainhar Lâmina',
    file: 'bgm/effects/sword-draw.wav',
    prompt: 'Som metálico afiado de desembainhar uma lâmina ou sacar uma espada',
  },
  {
    value: 'footsteps-stone',
    label: '👣 Passos em Pedra / Tumba',
    file: 'bgm/effects/footsteps-stone.wav',
    prompt: 'Passos ecoando em piso de pedra antiga, castelo, catacumbas ou pirâmide',
  },
  {
    value: 'piano-flourish',
    label: '🎹 Floreio de Piano Dramático',
    file: 'bgm/effects/piano-flourish.wav',
    prompt: 'Floreio dramático de piano antigo, ironia elegante ou suspense clássico',
  },
  {
    value: 'trex-roar',
    label: '🦖 Rugido de Criatura / T-Rex',
    file: 'bgm/effects/trex-roar.wav',
    prompt: 'Rugido ameaçador de criatura pré-histórica ou dinossauro à distância',
  },
  {
    value: 'trex-roar-fight',
    label: '🐲 Rugido Feroz de Batalha',
    file: 'bgm/effects/trex-roar-fight.wav',
    prompt: 'Rugido feroz de predador atacando no ápice do combate',
  },
  {
    value: 'dog-bark',
    label: '🐶 Latido de Alerta',
    file: 'bgm/effects/dog-bark.wav',
    prompt: 'Latido repentino de alerta ou surpresa canina',
  },
];

export const NONE_SFX_OPTION: SfxOption = {
  value: 'none',
  label: '🔇 Sem Efeito Sonoro',
  file: null,
};

/**
 * Normaliza uma string gerando um slug legível e seguro para nomes de arquivos
 */
export function slugifySfx(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Retorna todos os efeitos sonoros disponíveis (Padrões do sistema + Biblioteca CustomSfx)
 */
export async function listAllSfxOptions(): Promise<SfxOption[]> {
  try {
    const customSfxList = await prisma.customSfx.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const customOptions: SfxOption[] = customSfxList.map((item) => ({
      value: item.slug,
      label: item.label,
      file: `bgm/effects/${item.slug}.mp3`,
      prompt: item.prompt,
      isCustom: true,
    }));

    return [...DEFAULT_SFX_OPTIONS, ...customOptions, NONE_SFX_OPTION];
  } catch (err) {
    console.warn('[SFX Library] Aviso ao listar custom_sfx:', err);
    return [...DEFAULT_SFX_OPTIONS, NONE_SFX_OPTION];
  }
}

/**
 * Promove o áudio gerado de uma cena (armazenado em /storage/<videoId>/...)
 * para a biblioteca global em frontend/public/bgm/effects/<slug>.mp3
 * e registra no banco de dados CustomSfx.
 */
export async function promoteSceneSfxToLibrary(input: PromoteSfxInput) {
  const { videoId, sceneIndex, customSfxUrl, sfxPrompt, sfxLabel } = input;

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error('Vídeo não encontrado.');
  }

  // 1. Localizar arquivo de origem
  let relativePath = customSfxUrl;
  if (relativePath.startsWith('/storage/')) {
    relativePath = relativePath.replace(/^\/storage\//, '');
  } else if (relativePath.startsWith('storage/')) {
    relativePath = relativePath.replace(/^storage\//, '');
  }

  const sourceFilePath = path.join(STORAGE_DIR, relativePath);
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Arquivo de áudio temporário não encontrado no caminho: ${sourceFilePath}`);
  }

  // 2. Gerar slug único
  const baseSeed = sfxLabel || sfxPrompt || `sfx-${Date.now()}`;
  let baseSlug = slugifySfx(baseSeed);
  if (!baseSlug) {
    baseSlug = `sfx-${Date.now()}`;
  }

  // Limitar tamanho do slug
  if (baseSlug.length > 40) {
    baseSlug = baseSlug.slice(0, 40).replace(/-+$/, '');
  }

  // Verificar colisão com slugs padrões ou existentes no banco
  let uniqueSlug = baseSlug;
  let counter = 1;
  const reservedSlugs = new Set([...DEFAULT_SFX_OPTIONS.map((o) => o.value), 'none']);

  while (
    reservedSlugs.has(uniqueSlug) ||
    (await prisma.customSfx.findUnique({ where: { slug: uniqueSlug } }))
  ) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  // 3. Garantir diretório frontend e copiar arquivo
  if (!fs.existsSync(FRONTEND_EFFECTS_DIR)) {
    fs.mkdirSync(FRONTEND_EFFECTS_DIR, { recursive: true });
  }

  const targetFileName = `${uniqueSlug}.mp3`;
  const targetFilePath = path.join(FRONTEND_EFFECTS_DIR, targetFileName);

  fs.copyFileSync(sourceFilePath, targetFilePath);

  const displayLabel = sfxLabel?.trim()
    ? sfxLabel.trim()
    : `🔊 ${uniqueSlug.replace(/-/g, ' ')}`;

  // 4. Inserir registro na tabela CustomSfx
  const customSfx = await prisma.customSfx.create({
    data: {
      slug: uniqueSlug,
      label: displayLabel,
      prompt: sfxPrompt || '',
      filePath: `bgm/effects/${targetFileName}`,
    },
  });

  // 5. Atualizar a cena no vídeo para usar o novo slug e limpar custom_sfx_url
  const currentProps = (video.remotionProps || {}) as RenderVideoInput;
  const currentStoryboard = currentProps.storyboard || {
    durationPreset: 'short',
    scenes: [],
    audioGenerated: false,
    isAssembled: false,
    sceneTimings: [],
  };

  const baseScenes = currentStoryboard.scenes || [];
  const updatedScenes = baseScenes.map((scene, idx) => {
    if (idx !== sceneIndex) return scene;
    return {
      ...scene,
      sfx_suggestion: uniqueSlug,
      sfx_label: displayLabel,
      sfx_prompt: sfxPrompt || scene.sfx_prompt || '',
      custom_sfx_url: null, // Promovido para a biblioteca global!
    };
  });

  const updatedProps: RenderVideoInput = {
    ...currentProps,
    storyboard: {
      ...currentStoryboard,
      scenes: updatedScenes,
    },
  };

  const updatedVideo = await prisma.video.update({
    where: { id: videoId },
    data: {
      remotionProps: updatedProps,
    },
  });

  return {
    customSfx,
    slug: uniqueSlug,
    label: displayLabel,
    video: updatedVideo,
  };
}

/**
 * Remove um SFX customizado da biblioteca e exclui o arquivo .mp3 correspondente
 */
export async function deleteCustomSfxFromLibrary(slug: string) {
  const existing = await prisma.customSfx.findUnique({ where: { slug } });
  if (!existing) {
    throw new Error('Efeito sonoro customizado não encontrado.');
  }

  const targetFilePath = path.join(FRONTEND_EFFECTS_DIR, `${slug}.mp3`);
  if (fs.existsSync(targetFilePath)) {
    try {
      fs.unlinkSync(targetFilePath);
    } catch (err) {
      console.warn(`[SFX Library] Não foi possível remover arquivo físico ${targetFilePath}:`, err);
    }
  }

  await prisma.customSfx.delete({ where: { slug } });

  return { success: true, slug };
}
