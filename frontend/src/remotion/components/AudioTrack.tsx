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

      {/* 3. Efeitos Sonoros por Cena (sfx_suggestion) ou Whoosh nos cortes */}
      {sfxEnabled &&
        backgroundTimeline.map((seg, idx) => {
          const scene = scenes[idx];
          const sfxKey = scene?.sfx_suggestion?.trim();

          // Cena 0 (abertura): toca SFX de gancho apenas se explicitamente definido e não for "none"
          if (idx === 0) {
            if (!sfxKey || sfxKey === 'none' || sfxKey === 'whoosh') return null;
            const file = sfxMap.get(sfxKey);
            if (!file) return null;
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
          // Se for "none", não toca nada
          if (sfxKey === 'none') return null;

          // Se tiver um SFX específico da biblioteca, toca-o; senão usa whoosh padrão
          const sfxFile =
            (sfxKey && sfxMap.get(sfxKey)) || 'bgm/effects/whoosh.mp3';

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
