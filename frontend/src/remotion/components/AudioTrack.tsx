import React from 'react';
import { Audio, Sequence } from 'remotion';
import {
  BackgroundSegment,
  BgmVibe,
  BGM_VIBE_OPTIONS,
  SFX_OPTIONS,
  StoryboardScene,
  resolveAssetSrc,
} from '../types';

export interface AudioTrackProps {
  src?: string;
  volume?: number;
  bgmVibe?: BgmVibe;
  bgmVolume?: number;
  sfxEnabled?: boolean;
  backgroundTimeline?: BackgroundSegment[];
  scenes?: StoryboardScene[];
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src = 'audio.mp3',
  volume = 0.9,
  bgmVibe = 'epic',
  bgmVolume = 0.1,
  sfxEnabled = true,
  backgroundTimeline = [],
  scenes = [],
}) => {
  const selectedBgmOption = BGM_VIBE_OPTIONS.find(
    (opt) => opt.value === bgmVibe
  );
  const bgmFilePath = selectedBgmOption?.file || null;

  // Mapa de ficheiros de efeitos sonoros
  const sfxMap = new Map<string, string | null>(
    SFX_OPTIONS.map((opt) => [opt.value, opt.file])
  );

  return (
    <>
      {/* 1. Faixa Principal de Narração Multi-Voz (ElevenLabs) */}
      {src && <Audio src={resolveAssetSrc(src)} volume={volume} />}

      {/* 2. Música de Fundo (BGM) em Loop Contínuo a 10% de Volume */}
      {bgmFilePath && bgmVibe !== 'none' && (
        <Audio
          src={resolveAssetSrc(bgmFilePath)}
          loop
          volume={bgmVolume}
        />
      )}

      {/* 3. Efeitos Sonoros por Cena (custom_sfx_url gerado por IA, sfx_suggestion ou Whoosh) */}
      {sfxEnabled &&
        backgroundTimeline.map((seg, idx) => {
          const scene = scenes[idx];
          const sfxKey = scene?.sfx_suggestion?.trim();

          // Cena 0 (abertura): toca SFX se gerado por IA ou se explicitamente configurado na biblioteca
          if (idx === 0) {
            if (scene?.custom_sfx_url) {
              return (
                <Sequence key={`custom_sfx_0`} from={0} durationInFrames={45}>
                  <Audio
                    src={resolveAssetSrc(scene.custom_sfx_url)}
                    volume={0.4}
                  />
                </Sequence>
              );
            }
            if (!sfxKey || sfxKey === 'none' || sfxKey === 'whoosh') return null;
            const file = sfxMap.get(sfxKey) || `bgm/effects/${sfxKey}.mp3`;
            return (
              <Sequence
                key={`sfx_intro_0`}
                from={0}
                durationInFrames={35}
              >
                <Audio src={resolveAssetSrc(file)} volume={0.35} />
              </Sequence>
            );
          }

          // Cenas subsequentes (cortes de cena):
          // 1. Áudio customizado gerado por IA (ElevenLabs) tem prioridade máxima
          if (scene?.custom_sfx_url) {
            return (
              <Sequence
                key={`custom_sfx_${idx}_${seg.frameStart}`}
                from={Math.max(0, seg.frameStart - 2)}
                durationInFrames={45}
              >
                <Audio
                  src={resolveAssetSrc(scene.custom_sfx_url)}
                  volume={0.4}
                />
              </Sequence>
            );
          }

          // 2. Se for "none", não toca nada
          if (sfxKey === 'none') return null;

          // 3. Efeito da biblioteca (padrão ou CustomSfx promovido, com fallback para whoosh)
          const sfxFile =
            (sfxKey && (sfxMap.get(sfxKey) || `bgm/effects/${sfxKey}.mp3`)) ||
            'bgm/effects/whoosh.mp3';

          return (
            <Sequence
              key={`scene_sfx_${idx}_${seg.frameStart}`}
              from={Math.max(0, seg.frameStart - 2)}
              durationInFrames={30}
            >
              <Audio src={resolveAssetSrc(sfxFile)} volume={0.35} />
            </Sequence>
          );
        })}
    </>
  );
};
