import fs from 'node:fs/promises';
import path from 'node:path';
import type { GeneratedIdeation } from './gemini.service.ts';
import type { RenderVideoInput } from '../types/video.types.ts';

interface SeriesMeta {
  seriesId?: string | null;
  seriesTitle?: string | null;
  episodeNumber?: number | null;
}

/**
 * Garante que a pasta do vídeo em backend/storage/{videoId} existe
 */
export async function ensureVideoStorageDir(videoId: string): Promise<string> {
  const dirPath = path.resolve(process.cwd(), 'storage', videoId);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Salva o prompt de ideação quando as chamadas de API falharem
 * para que o agente assistente possa intervir e gerar o JSON
 */
export async function saveTempIdeationPrompt(
  promptText: string,
  meta?: { videoId?: string; theme?: string }
): Promise<string> {
  const filePath = path.resolve(process.cwd(), 'temp_ideation_prompt.txt');
  const header = [
    '=================================================================',
    'PROMPT DE IDEAÇÃO DO VÍDEO (FALLBACK PARA ASSISTENTE)',
    `DATA: ${new Date().toISOString()}`,
    meta?.videoId ? `VIDEO_ID: ${meta.videoId}` : null,
    meta?.theme ? `THEME: ${meta.theme}` : null,
    '=================================================================\n\n',
  ]
    .filter(Boolean)
    .join('\n');

  await fs.writeFile(filePath, `${header}${promptText}`, 'utf-8');
  return filePath;
}

/**
 * FASE 1: Salva ou inicializa o script-bible.md na pasta do vídeo com o tema e as 4 opções geradas
 */
export async function recordScriptBibleIdeationPhase(params: {
  videoId: string;
  theme: string;
  durationPreset: string;
  seriesMeta?: SeriesMeta;
  ideation: GeneratedIdeation;
}): Promise<string> {
  const dirPath = await ensureVideoStorageDir(params.videoId);
  const filePath = path.join(dirPath, 'script-bible.md');

  const { videoId, theme, durationPreset, seriesMeta, ideation } = params;

  let content = `# 📜 Bíblia do Roteiro • Fragata Shorts\n\n`;
  content += `- **ID do Vídeo:** \`${videoId}\`\n`;
  content += `- **Data de Criação:** ${new Date().toLocaleString('pt-BR')}\n`;
  content += `- **Duração / Formato:** ${durationPreset.toUpperCase()}\n`;

  if (seriesMeta?.seriesTitle) {
    content += `- **Minissérie:** ${seriesMeta.seriesTitle} (Episódio ${seriesMeta.episodeNumber || 1})\n`;
    content += `- **Series ID:** \`${seriesMeta.seriesId || 'N/A'}\`\n`;
  } else {
    content += `- **Formato:** Episódio Único (Single)\n`;
  }

  content += `\n---\n\n`;
  content += `## 🎯 Briefing & Fatos Históricos Fornecidos\n\n`;
  content += `${theme.trim()}\n\n`;
  content += `\n---\n\n`;
  content += `## 💡 Opções Narrativas Geradas na Ideação (4 Ângulos)\n\n`;

  ideation.options.forEach((opt, idx) => {
    content += `### Opção ${idx + 1}: ${opt.title} (${opt.badge})\n`;
    content += `- **ID:** \`${opt.id}\`\n`;
    content += `- **Vibe Trilha Sonora:** \`${opt.bgmVibe}\`\n`;
    content += `- **Descrição:** ${opt.description}\n`;

    if (opt.narrative_plan) {
      content += `- **Seamless Loop:**\n`;
      content += `  - *Orador da Ponte:* \`${opt.narrative_plan.bridge_speaker}\`\n`;
      content += `  - *Frase Completa:* "${opt.narrative_plan.bridge_full_sentence}"\n`;
      content += `  - *Fecho (Fim):* "${opt.narrative_plan.loop_closing_fragment}"\n`;
      content += `  - *Abertura (Início):* "${opt.narrative_plan.loop_opening_fragment}"\n`;
    }

    content += `\n#### Cenas (${opt.scenes.length}):\n\n`;

    opt.scenes.forEach((sc, sIdx) => {
      content += `**Cena ${sIdx + 1}** | *Orador:* \`${sc.speaker}\` | *Sprite:* \`${sc.avatarSprite}\` | *SFX:* \`${sc.sfx_suggestion || 'nenhum'}\`\n`;
      if (sc.dialogues && sc.dialogues.length > 0) {
        sc.dialogues.forEach((d) => {
          content += `- **${d.speaker}:** "${d.text}"\n`;
        });
      } else {
        content += `- "${sc.text}"\n`;
      }
      if (sc.visual_description) {
        content += `- *Visual:* ${sc.visual_description}\n`;
      }
      content += `- *Image Prompt:* \`${sc.imagePrompt}\`\n\n`;
    });

    content += `---\n\n`;
  });

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * FASE 2: Atualiza o script-bible.md com o Roteiro Final Escolhido e Revisado
 */
export async function recordScriptBibleFinalPhase(params: {
  videoId: string;
  selectedOptionId?: string;
  remotionProps: RenderVideoInput;
}): Promise<void> {
  const dirPath = await ensureVideoStorageDir(params.videoId);
  const filePath = path.join(dirPath, 'script-bible.md');

  let existing = '';
  try {
    existing = await fs.readFile(filePath, 'utf-8');
  } catch {
    existing = `# 📜 Bíblia do Roteiro • Fragata Shorts\n\n- **ID do Vídeo:** \`${params.videoId}\`\n\n`;
  }

  // Remove seção de roteiro final anterior se já existir
  const splitIdx = existing.indexOf('## 🎬 Roteiro Final Escolhido & Revisado');
  const baseContent = splitIdx !== -1 ? existing.substring(0, splitIdx).trim() : existing.trim();

  const storyboard = params.remotionProps.storyboard;
  const scenes = storyboard?.scenes || [];

  let finalSection = `\n\n---\n\n## 🎬 Roteiro Final Escolhido & Revisado\n\n`;
  finalSection += `- **Data de Aprovação/Salvamento:** ${new Date().toLocaleString('pt-BR')}\n`;
  if (params.selectedOptionId) {
    finalSection += `- **Baseado na Opção:** \`${params.selectedOptionId}\`\n`;
  }
  finalSection += `- **Total de Cenas:** ${scenes.length}\n`;
  finalSection += `- **BGM Vibe:** \`${params.remotionProps.bgmVibe || 'epic'}\`\n\n`;

  scenes.forEach((sc, idx) => {
    finalSection += `### Cena ${idx + 1}\n`;
    finalSection += `- **Orador:** \`${sc.speaker}\`\n`;
    finalSection += `- **Expressão do Billy:** \`${sc.avatarSprite}\`\n`;
    if (sc.dialogues && sc.dialogues.length > 0) {
      finalSection += `- **Diálogos:**\n`;
      sc.dialogues.forEach((d) => {
        finalSection += `  - **${d.speaker}:** "${d.text}"\n`;
      });
    } else {
      finalSection += `- **Texto:** "${sc.text}"\n`;
    }
    if (sc.visual_description) {
      finalSection += `- **Cenário Visual:** ${sc.visual_description}\n`;
    }
    if (sc.imagePrompt) {
      finalSection += `- **Image Prompt:** \`${sc.imagePrompt}\`\n`;
    }
    if (sc.sfx_suggestion) {
      finalSection += `- **SFX:** \`${sc.sfx_suggestion}\` (${sc.sfx_prompt || ''})\n`;
    }
    finalSection += `\n`;
  });

  await fs.writeFile(filePath, `${baseContent}${finalSection}`, 'utf-8');
}

/**
 * Lê o script-bible.md de um episódio anterior para enriquecer a continuidade da minissérie
 */
export async function readPreviousEpisodeBible(videoId: string): Promise<string | null> {
  try {
    const filePath = path.resolve(process.cwd(), 'storage', videoId, 'script-bible.md');
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

