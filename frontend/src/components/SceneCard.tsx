import React from 'react';
import type { DialogueItem, SfxOption, SpeakerType, StoryboardScene } from '../remotion/types';
import { getSceneDialogues, SFX_OPTIONS } from '../remotion/types';

export interface SceneCardProps {
  scene: StoryboardScene;
  sceneIndex: number;
  sceneId: string;
  sourceBadge?: string;
  isDraggable?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemoveScene?: () => void;
  // Field updates (visual_description, sfx_suggestion, sfx_prompt, etc.)
  onUpdateField: (field: keyof StoryboardScene, value: unknown) => void;
  // Dynamic dialogues manipulation
  onAddDialogue: (sceneId: string) => void;
  onUpdateDialogue: (
    sceneId: string,
    dialogueId: string,
    field: 'speaker' | 'text',
    value: string
  ) => void;
  onRemoveDialogue: (sceneId: string, dialogueId: string) => void;
  // Visual Prompt generation
  onGenerateVisualPrompt?: () => void;
  isGeneratingVisualPrompt?: boolean;
  // SFX generation & audio preview
  sfxOptions?: SfxOption[];
  onGenerateSfx?: (prompt: string) => void;
  isGeneratingSfx?: boolean;
  onPlayAudioPreview?: (url: string) => void;
  onPromoteSfx?: () => void;
  isPromotingSfx?: boolean;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  sceneIndex,
  sceneId,
  sourceBadge,
  isDraggable = false,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onRemoveScene,
  onUpdateField,
  onAddDialogue,
  onUpdateDialogue,
  onRemoveDialogue,
  onGenerateVisualPrompt,
  isGeneratingVisualPrompt = false,
  sfxOptions,
  onGenerateSfx,
  isGeneratingSfx = false,
  onPlayAudioPreview,
  onPromoteSfx,
  isPromotingSfx = false,
}) => {
  const dialogues: DialogueItem[] = getSceneDialogues(scene);

  const hasAnyText = dialogues.some((d) => d.text.trim().length > 0);

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`rounded-xl border p-3 transition-all duration-200 ${
        isDragging
          ? 'border-amber-400 bg-amber-500/15 opacity-75 scale-[0.99]'
          : 'border-[#2c2c32] bg-[#1b1b20] hover:border-amber-500/40'
      }`}
    >
      {/* ====================================================================
          1. Cabeçalho do Card: Posição, Badge de Origem e Ações
         ==================================================================== */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isDraggable && (
            <span
              title="Arraste para reordenar"
              className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 px-1 select-none"
            >
              ⋮⋮
            </span>
          )}
          <span className="rounded-md bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-slate-950">
            #{sceneIndex + 1}
          </span>
          {sourceBadge && (
            <span className="truncate rounded border border-[#2c2c32] bg-[#121214] px-2 py-0.5 text-[10px] font-semibold text-teal-300">
              {sourceBadge}
            </span>
          )}
        </div>

        {/* Controles de Reordenação (Cima / Baixo) e Remoção da Cena */}
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              title="Mover cena para cima"
              className="flex h-6 w-6 items-center justify-center rounded border border-[#2c2c32] bg-[#121214] text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              title="Mover cena para baixo"
              className="flex h-6 w-6 items-center justify-center rounded border border-[#2c2c32] bg-[#121214] text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
            >
              ↓
            </button>
          )}
          {onRemoveScene && (
            <button
              type="button"
              onClick={onRemoveScene}
              title="Remover cena do roteiro"
              className="ml-1 flex h-6 w-6 items-center justify-center rounded border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          2. Descrição Visual do Cenário
         ==================================================================== */}
      <div className="mb-2 text-[11px] text-slate-300">
        <div className="flex items-center justify-between gap-1.5 mb-1 font-semibold text-amber-400">
          <span className="flex items-center gap-1.5">
            <span>🖼️ Cenário:</span>
          </span>
          {onGenerateVisualPrompt && (
            <button
              type="button"
              disabled={isGeneratingVisualPrompt || !hasAnyText}
              onClick={onGenerateVisualPrompt}
              title="Gerar prompt de imagem e enriquecer descrição visual com IA"
              className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 disabled:opacity-40 transition"
            >
              {isGeneratingVisualPrompt ? (
                <>
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amber-300 border-t-transparent" />
                  <span>Criando prompt...</span>
                </>
              ) : (
                <>
                  <span>🪄</span>
                  <span>Gerar Prompt Visual</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          type="text"
          value={scene.visual_description || ''}
          onChange={(e) => onUpdateField('visual_description', e.target.value)}
          placeholder="Descrição visual do cenário histórico..."
          className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none transition italic"
        />
      </div>

      {/* ====================================================================
          3. Diálogos Dinâmicos (.map() de falas com Orador + Texto + Remoção)
         ==================================================================== */}
      <div className="space-y-2 mb-2">
        {dialogues.map((dialogue, dIdx) => (
          <div
            key={dialogue.id || `dialogue_${dIdx}`}
            className="rounded-lg bg-[#141418] border border-[#272730] p-2 flex items-start gap-2"
          >
            {/* Dropdown do Orador */}
            <div className="shrink-0 w-36">
              <select
                value={dialogue.speaker}
                onChange={(e) =>
                  onUpdateDialogue(
                    sceneId,
                    dialogue.id,
                    'speaker',
                    e.target.value as SpeakerType
                  )
                }
                className="w-full rounded-md border border-[#30303c] bg-[#202028] px-2 py-1.5 text-[11px] font-bold text-amber-300 focus:border-amber-500 focus:outline-none"
              >
                <option value="protagonist">🧑 Protagonista</option>
                <option value="character">🎭 Personagem</option>
                <option value="narrator">🎙️ Narrador</option>
              </select>
            </div>

            {/* Campo de Texto da Fala */}
            <textarea
              rows={2}
              value={dialogue.text}
              onChange={(e) =>
                onUpdateDialogue(
                  sceneId,
                  dialogue.id,
                  'text',
                  e.target.value
                )
              }
              placeholder={`Fala #${dIdx + 1} / Legenda da cena...`}
              className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] p-2 text-xs text-slate-100 font-medium leading-relaxed focus:border-amber-500 focus:outline-none transition resize-none"
            />

            {/* Botão de Remoção de Fala Extra (aparece se houver mais de 1 fala) */}
            {dialogues.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveDialogue(sceneId, dialogue.id)}
                title="Remover esta fala"
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25 hover:text-rose-200"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Botão de Adição: [ + Nova Fala ] */}
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={() => onAddDialogue(sceneId)}
            title="Adicionar mais uma fala dentro desta mesma cena"
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#3a3a46] bg-[#16161b] px-2.5 py-1 text-[11px] font-medium text-amber-400/90 transition hover:border-amber-500/60 hover:bg-[#1f1f26] hover:text-amber-300 active:scale-[0.98]"
          >
            <span className="text-xs font-bold leading-none">+</span>
            <span>Nova Fala</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          4. Design de Som Integrado (Som Escolhido + Prompt ElevenLabs)
         ==================================================================== */}
      <div className="rounded-lg border border-[#262630] bg-[#121216] p-2.5 space-y-2">
        {/* Linha do Som Escolhido (Biblioteca Local) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-teal-400 flex items-center gap-1">
              <span>🔊 Som Escolhido:</span>
              {scene.sfx_label && (
                <span className="text-[10px] text-teal-300/80 font-normal">
                  ({scene.sfx_label})
                </span>
              )}
            </span>
            <select
              value={scene.sfx_suggestion || 'whoosh'}
              onChange={(e) => onUpdateField('sfx_suggestion', e.target.value)}
              className="rounded-md border border-[#2c2c32] bg-[#18181f] px-2 py-1 text-[11px] font-mono text-teal-300 focus:border-teal-500 focus:outline-none max-w-[220px]"
            >
              {(sfxOptions || SFX_OPTIONS).map((sfx) => (
                <option key={sfx.value} value={sfx.value}>
                  {sfx.label}
                </option>
              ))}
            </select>
          </div>

          {scene.custom_sfx_url && (
            <div className="flex items-center gap-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <span>✨ Áudio IA Ativo</span>
              {onPlayAudioPreview && (
                <button
                  type="button"
                  title="Ouvir áudio gerado pela ElevenLabs"
                  onClick={() => onPlayAudioPreview(scene.custom_sfx_url!)}
                  className="hover:scale-110 transition"
                >
                  ▶️
                </button>
              )}
              {onPromoteSfx && (
                <button
                  type="button"
                  disabled={isPromotingSfx}
                  title="Salvar este áudio na Biblioteca Global para reutilizar em futuros roteiros a custo zero"
                  onClick={onPromoteSfx}
                  className="flex items-center gap-1 rounded bg-teal-500/25 hover:bg-teal-500/40 border border-teal-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-teal-200 transition disabled:opacity-50"
                >
                  {isPromotingSfx ? (
                    <span className="h-2 w-2 animate-spin rounded-full border border-teal-200 border-t-transparent" />
                  ) : (
                    <span>💾 Salvar</span>
                  )}
                </button>
              )}
              <button
                type="button"
                title="Remover áudio customizado e voltar ao som da biblioteca"
                onClick={() => onUpdateField('custom_sfx_url', null)}
                className="text-slate-400 hover:text-rose-400 transition"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Linha do Prompt IA (ElevenLabs Text-to-SFX) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-slate-400">
            <span className="text-teal-400">🎧</span>
            <span>Prompt IA:</span>
          </div>
          <input
            type="text"
            value={scene.sfx_prompt || ''}
            onChange={(e) => onUpdateField('sfx_prompt', e.target.value)}
            placeholder="Ex: Quick dramatic whoosh followed by crumbling ancient stone..."
            className="flex-1 rounded-md border border-[#2c2c32] bg-[#121214] px-2.5 py-1 text-xs text-slate-300 placeholder-slate-600 focus:border-teal-500 focus:outline-none transition italic"
          />
          {onGenerateSfx && (
            <button
              type="button"
              disabled={isGeneratingSfx || !scene.sfx_prompt?.trim()}
              onClick={() => onGenerateSfx(scene.sfx_prompt || '')}
              title="Gerar efeito sonoro exclusivo com a ElevenLabs Sound Effects"
              className="flex shrink-0 items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-500/25 disabled:opacity-40"
            >
              {isGeneratingSfx ? (
                <>
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-teal-300 border-t-transparent" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Gerar SFX</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

