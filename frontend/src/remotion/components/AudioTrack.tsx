import React from 'react';
import { Audio, Loop, Sequence, useVideoConfig } from 'remotion';
import {
  BackgroundSegment,
  BgmVibe,
  BGM_VIBE_OPTIONS,
  StoryboardScene,
  getSceneSfxList,
  resolveAssetSrc,
  resolveSfxAudioUrl,
} from '../types';

export interface AudioTrackProps {
  src?: string;
  volume?: number;
  bgmVibe?: BgmVibe;
  bgmVolume?: number;
  sfxEnabled?: boolean;
  globalSfxMultiplier?: number;
  autoDucking?: boolean;
  backgroundTimeline?: BackgroundSegment[];
  scenes?: StoryboardScene[];
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src = 'audio.mp3',
  volume = 0.9,
  bgmVibe = 'epic',
  bgmVolume = 0.1,
  sfxEnabled = true,
  globalSfxMultiplier = 1.0,
  autoDucking: _autoDucking = true,
  backgroundTimeline = [],
  scenes = [],
}) => {
  const { fps } = useVideoConfig();

  const selectedBgmOption = BGM_VIBE_OPTIONS.find(
    (opt) => opt.value === bgmVibe
  );
  const bgmFilePath = selectedBgmOption?.file || null;

  return (
    <>
      {/* 1. Faixa Principal de Narração Multi-Voz (ElevenLabs) */}
      {src && <Audio src={resolveAssetSrc(src)} volume={volume} />}

      {/* 2. Música de Fundo (BGM) em Loop Contínuo */}
      {bgmFilePath && bgmVibe !== 'none' && (
        <Audio
          src={resolveAssetSrc(bgmFilePath)}
          loop
          volume={bgmVolume}
        />
      )}

      {/* 3. Efeitos Sonoros Dinâmicos por Cena (sfx_list com timing relativo, duração e volume) */}
      {sfxEnabled &&
        backgroundTimeline.map((seg, idx) => {
          const scene = scenes[idx];
          const sfxList = getSceneSfxList(scene);

          if (!sfxList || sfxList.length === 0) return null;

          return sfxList.map((sfx, sfxIdx) => {
            const resolvedAudioUrl = resolveSfxAudioUrl(sfx);
            if (!resolvedAudioUrl) return null;

            const startOffsetFrames = Math.max(
              0,
              Math.round(sfx.start_time_sec * fps)
            );
            const startFrame = seg.frameStart + startOffsetFrames;
            const durationFrames = Math.max(
              1,
              Math.round(sfx.duration_sec * fps)
            );
            const calculatedVolume = Math.min(
              1,
              Math.max(0, sfx.suggested_volume * globalSfxMultiplier)
            );
            const playbackRate = Math.min(
              2.0,
              Math.max(0.5, sfx.playback_rate ?? 1.0)
            );

            // Duração de uma repetição nativa considerando a velocidade configurada
            const originalDurationSec = sfx.original_duration_sec;
            const singleRepFrames = originalDurationSec
              ? Math.max(
                  1,
                  Math.round((originalDurationSec / playbackRate) * fps)
                )
              : durationFrames;
            const shouldLoop = durationFrames > singleRepFrames;

            return (
              <Sequence
                key={`sfx-${idx}-${sfxIdx}-${startFrame}`}
                from={startFrame}
                durationInFrames={durationFrames}
              >
                {shouldLoop ? (
                  <Loop durationInFrames={singleRepFrames}>
                    <Audio
                      src={resolvedAudioUrl}
                      volume={calculatedVolume}
                      playbackRate={playbackRate}
                    />
                  </Loop>
                ) : (
                  <Audio
                    src={resolvedAudioUrl}
                    volume={calculatedVolume}
                    playbackRate={playbackRate}
                  />
                )}
              </Sequence>
            );
          });
        })}
    </>
  );
};
