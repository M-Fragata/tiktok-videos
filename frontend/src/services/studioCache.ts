/**
 * Utilitários de cache para a página do Studio (armazenamento temporário de abas e accordions por vídeo).
 *
 * Regra de ciclo de vida:
 * - Durante a sessão no vídeo: F5 ou troca de abas internas no Studio preserva a aba ativa e as seções expandidas.
 * - Ao sair do vídeo (navegar para Home, Dashboard ou unmount): o cache é limpo para que ao retornar ao vídeo
 *   todas as abas e seções iniciem recolhidas por padrão.
 */

export function clearStudioVideoCache(videoId?: string): void {
  try {
    if (videoId) {
      const keysToRemove = [
        `studio_active_tab_${videoId}`,
        `studio_collapsed_scenes_${videoId}`,
        `studio_sub_style_collapsed_${videoId}`,
        `studio_sub_blocks_collapsed_${videoId}`,
        `studio_audio_narration_collapsed_${videoId}`,
        `studio_audio_mixer_collapsed_${videoId}`,
        `studio_audio_sfx_collapsed_${videoId}`,
        `studio_collapsed_sfx_scenes_${videoId}`,
        `ideation_avatar_open_${videoId}`,
        `ideation_script_gen_open_${videoId}`,
        `ideation_final_script_open_${videoId}`,
      ];
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } else {
      // Limpa todas as chaves de estúdio e ideação do localStorage
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.startsWith('studio_') || key.startsWith('ideation_')) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    /* ignore storage error */
  }
}
