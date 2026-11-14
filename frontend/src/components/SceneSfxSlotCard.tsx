import React from 'react';
import {
  SfxItem,
  SfxOption,
  resolveSfxAudioUrl,
} from '../remotion/types';

interface SceneSfxSlotCardProps {
  slot: 'action' | 'ambient';
  title: string;
  icon: string;
  sceneIdx: number;
  sfxItem: SfxItem | null;
  sceneDuration: number;
  sfxLibraryOptions: SfxOption[];
  detectedSfxDurations: Record<string, number>;
  playingSfxPreview: string | null;
  generatingSfxKey: string | null;
  promotingSfxSceneIndex: number | null;
  onUpdate: (updates: Partial<SfxItem>) => void;
  onOptionChange: (newOption: string) => void;
  onGenerate: (prompt: string, duration?: number) => void;
  onPlayPreview: (
    url: string,
    key: string,
    options?: {
      targetDurationSec?: number;
      playbackRate?: number;
      volume?: number;
    }
  ) => void;
  onStopPreview: () => void;
  onRemoveCustom: () => void;
  onPromote?: () => void;
}

export const SceneSfxSlotCard: React.FC<SceneSfxSlotCardProps> = ({
  slot,
  title,
  icon,
  sceneIdx,
  sfxItem,
  sceneDuration,
  sfxLibraryOptions,
  detectedSfxDurations,
  playingSfxPreview,
  generatingSfxKey,
  promotingSfxSceneIndex,
  onUpdate,
  onOptionChange,
  onGenerate,
  onPlayPreview,
  onStopPreview,
  onRemoveCustom,
  onPromote,
}) => {
  const resolvedAudioUrl = sfxItem ? resolveSfxAudioUrl(sfxItem) : null;
  const hasActiveAudio = Boolean(resolvedAudioUrl);
  const previewKey = `sfx-${sceneIdx}-${slot}`;
  const isPlaying = playingSfxPreview === previewKey;
  const isGenerating = generatingSfxKey === `${sceneIdx}-${slot}`;

  const defaultVolume = slot === 'ambient' ? 0.45 : 0.85;
  const defaultStartTime = slot === 'ambient' ? 0.0 : 0.5;
  const defaultDuration = slot === 'ambient' ? Math.max(1.0, sceneDuration) : 2.0;

  const currentVolume = sfxItem?.suggested_volume ?? defaultVolume;
  const currentStartTime = sfxItem?.start_time_sec ?? defaultStartTime;
  const currentDuration = sfxItem?.duration_sec ?? defaultDuration;
  const currentSpeed = sfxItem?.playback_rate ?? 1.0;

  const originalAudioDuration =
    sfxItem?.original_duration_sec ??
    (resolvedAudioUrl ? detectedSfxDurations[resolvedAudioUrl] : undefined);

  const isLooping = Boolean(
    originalAudioDuration && currentDuration > originalAudioDuration
  );

  const hasSfxConfigured =
    hasActiveAudio ||
    (sfxItem?.sfx_key && sfxItem.sfx_key !== 'none') ||
    Boolean(sfxItem?.sound_prompt?.trim());

  const isAction = slot === 'action';

  return (
    <div
      className={`rounded-xl border p-2.5 space-y-2.5 transition-all ${
        isAction
          ? 'bg-[#15151c] border-amber-500/20 hover:border-amber-500/40'
          : 'bg-[#13161c] border-teal-500/20 hover:border-teal-500/40'
      }`}
    >
      {/* Cabeçalho do Bloco (Ação vs Ambiente) */}
      <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{icon}</span>
          <span
            className={`text-xs font-bold ${
              isAction ? 'text-amber-300' : 'text-teal-300'
            }`}
          >
            {title}
          </span>
          {sfxItem?.label && (
            <span
              className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]"
              title={sfxItem.label}
            >
              ({sfxItem.label})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {sfxItem?.audio_url ? (
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                ✨ ElevenLabs IA
              </span>
              {onPromote && (
                <button
                  type="button"
                  disabled={promotingSfxSceneIndex === sceneIdx}
                  title="Salvar na Biblioteca Global"
                  onClick={onPromote}
                  className="flex items-center gap-1 rounded bg-teal-500/25 hover:bg-teal-500/40 border border-teal-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-teal-200 transition disabled:opacity-50"
                >
                  <span>💾 Salvar</span>
                </button>
              )}
              <button
                type="button"
                title="Remover áudio customizado"
                onClick={onRemoveCustom}
                className="text-slate-400 hover:text-rose-400 transition text-[10px] ml-0.5"
              >
                ✕
              </button>
            </div>
          ) : sfxItem?.sfx_key && sfxItem.sfx_key !== 'none' ? (
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-300 truncate max-w-[110px]">
              {sfxItem.label || '🔊 Efeito'}
            </span>
          ) : sfxItem?.sound_prompt?.trim() ? (
            <span className="rounded bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 text-[9px] font-medium text-teal-300">
              🎧 Prompt Pronto
            </span>
          ) : (
            <span className="rounded bg-slate-800/80 border border-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-400">
              🔇 Sem Efeito
            </span>
          )}
        </div>
      </div>

      {/* Linha 1: Seletor de Som da Biblioteca & Botão de Pré-Escuta */}
      <div className="flex items-center gap-2 w-full min-w-0">
        <select
          value={
            sfxItem?.audio_url
              ? 'custom'
              : sfxItem?.sfx_key || 'none'
          }
          onChange={(e) => onOptionChange(e.target.value)}
          className="flex-1 min-w-0 w-full truncate rounded-lg border border-[#2c2c32] bg-[#1a1a22] py-1.5 px-2.5 text-xs text-slate-200 focus:border-teal-500 focus:outline-none cursor-pointer"
        >
          <option value="none">🔇 Sem Efeito</option>
          {sfxItem?.audio_url && (
            <option value="custom">✨ Áudio Gerado com IA (Ativo)</option>
          )}
          {sfxLibraryOptions
            .filter((opt) => opt.value !== 'none')
            .map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>

        {hasActiveAudio && resolvedAudioUrl && (
          <button
            type="button"
            onClick={() => {
              if (isPlaying) {
                onStopPreview();
              } else {
                onPlayPreview(resolvedAudioUrl, previewKey, {
                  targetDurationSec: currentDuration,
                  playbackRate: currentSpeed,
                  volume: currentVolume,
                });
              }
            }}
            title="Pré-escutar som com timing, loop e velocidade aplicados"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs transition ${
              isPlaying
                ? 'border-amber-400 bg-amber-500/20 text-amber-300 animate-pulse'
                : 'border-white/10 bg-[#252530] text-slate-200 hover:border-amber-500/50 hover:bg-[#2e2e3c]'
            }`}
          >
            {isPlaying ? '⏹' : '▶'}
          </button>
        )}
      </div>

      {/* Controles de Sound Design: Volume, Início, Duração e Velocidade */}
      {hasSfxConfigured && (
        <div className="space-y-2 pt-1 border-t border-white/[0.04]">
          {/* Slider Volume */}
          <div className="rounded-lg bg-[#111115] p-2 space-y-1.5 border border-white/[0.04]">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <span>🔊</span>
                <span>Volume</span>
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round(currentVolume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    suggested_volume: Math.max(
                      0,
                      Number((currentVolume - 0.01).toFixed(2))
                    ),
                  })
                }
                title="Diminuir volume em 1%"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                -
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={currentVolume}
                onChange={(e) =>
                  onUpdate({
                    suggested_volume: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#252530] rounded-lg"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    suggested_volume: Math.min(
                      1,
                      Number((currentVolume + 0.01).toFixed(2))
                    ),
                  })
                }
                title="Aumentar volume em 1%"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                +
              </button>
            </div>
          </div>

          {/* Slider Início */}
          <div className="rounded-lg bg-[#111115] p-2 space-y-1.5 border border-white/[0.04]">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <span>⏱️</span>
                <span>Início na Cena</span>
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {currentStartTime.toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    start_time_sec: Math.max(
                      0,
                      Number((currentStartTime - 0.5).toFixed(1))
                    ),
                  })
                }
                title="Antecipar início em 0.5s"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                -
              </button>
              <input
                type="range"
                min="0"
                max={Math.max(1, sceneDuration)}
                step="0.1"
                value={Math.min(currentStartTime, Math.max(1, sceneDuration))}
                onChange={(e) =>
                  onUpdate({
                    start_time_sec: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-[#252530] rounded-lg"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    start_time_sec: Math.min(
                      Math.max(1, sceneDuration),
                      Number((currentStartTime + 0.5).toFixed(1))
                    ),
                  })
                }
                title="Atrasar início em 0.5s"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                +
              </button>
            </div>
          </div>

          {/* Slider Duração com Traço Dourado e Badge de Loop */}
          {(() => {
            const minDur = 0.5;
            const maxDur = Math.max(10, Math.ceil(sceneDuration));
            const clampedOrig = originalAudioDuration
              ? Math.min(maxDur, Math.max(minDur, originalAudioDuration))
              : null;
            const origPercent =
              clampedOrig !== null
                ? ((clampedOrig - minDur) / (maxDur - minDur)) * 100
                : null;

            return (
              <div className="rounded-lg bg-[#111115] p-2 space-y-1.5 border border-white/[0.04]">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <span>⏳</span>
                    <span>Duração</span>
                    {isLooping && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        🔁 Loop
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {originalAudioDuration && (
                      <span
                        className="text-[9px] text-amber-400/90 font-mono font-medium"
                        title="Duração original do áudio"
                      >
                        (Original: {originalAudioDuration.toFixed(1)}s)
                      </span>
                    )}
                    <span className="font-mono text-purple-400 font-bold">
                      {currentDuration.toFixed(1)}s
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        duration_sec: Math.max(
                          0.5,
                          Number((currentDuration - 0.5).toFixed(1))
                        ),
                      })
                    }
                    title="Diminuir duração em 0.5s"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
                  >
                    -
                  </button>
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="range"
                      min={minDur}
                      max={maxDur}
                      step="0.1"
                      value={Math.min(currentDuration, maxDur)}
                      onChange={(e) =>
                        onUpdate({
                          duration_sec: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-purple-500 cursor-pointer h-1.5 bg-[#252530] rounded-lg"
                    />
                    {origPercent !== null && (
                      <div
                        style={{ left: `${origPercent}%` }}
                        className="absolute pointer-events-none -top-1 bottom-0 w-1 -ml-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] z-10 rounded-full"
                        title={`Duração original do som: ${originalAudioDuration?.toFixed(1)}s`}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        duration_sec: Math.min(
                          maxDur,
                          Number((currentDuration + 0.5).toFixed(1))
                        ),
                      })
                    }
                    title="Aumentar duração em 0.5s"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Slider Velocidade */}
          <div className="rounded-lg bg-[#111115] p-2 space-y-1.5 border border-white/[0.04]">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <span>⚡</span>
                <span>Velocidade</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {currentSpeed.toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    playback_rate: Math.max(
                      0.5,
                      Number((currentSpeed - 0.1).toFixed(1))
                    ),
                  })
                }
                title="Diminuir velocidade em 0.1x"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                -
              </button>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={currentSpeed}
                onChange={(e) =>
                  onUpdate({
                    playback_rate: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-[#252530] rounded-lg"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    playback_rate: Math.min(
                      2.0,
                      Number((currentSpeed + 0.1).toFixed(1))
                    ),
                  })
                }
                title="Aumentar velocidade em 0.1x"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#252530] text-[11px] font-bold text-slate-300 hover:bg-[#333342] hover:text-white transition active:scale-95 border border-white/[0.04]"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Acústico & Botão Gerar */}
      <div className="space-y-1 pt-1 border-t border-white/[0.04] min-w-0">
        <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
          <span className="text-teal-400">🎧</span>
          <span>Prompt Acústico (ElevenLabs):</span>
        </label>
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <input
            type="text"
            value={sfxItem?.sound_prompt || ''}
            onChange={(e) =>
              onUpdate({
                sound_prompt: e.target.value,
              })
            }
            placeholder={
              isAction
                ? 'Ex: Crisp upfront punchy stone rock cracking, instant attack...'
                : 'Ex: Seamless steady continuous cold arctic wind howling...'
            }
            className="flex-1 min-w-0 rounded-lg border border-[#2c2c32] bg-[#121216] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none transition italic"
          />
          <button
            type="button"
            disabled={isGenerating || !sfxItem?.sound_prompt?.trim()}
            onClick={() =>
              onGenerate(sfxItem?.sound_prompt || '', currentDuration)
            }
            title={`Gerar efeito de ${title} exclusivo com a ElevenLabs Sound Effects`}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-[11px] font-bold text-teal-300 transition hover:bg-teal-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <span className="h-2.5 w-2.5 animate-spin rounded-full border border-teal-300 border-t-transparent" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Gerar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
