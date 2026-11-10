import React from 'react';
import { Audio, Sequence } from 'remotion';
import {
  BackgroundSegment,
  BgmVibe,
  BGM_VIBE_OPTIONS,
  resolveAssetSrc,
} from '../types';

export interface AudioTrackProps {
  src?: string;
  volume?: number;
  bgmVibe?: BgmVibe;
  bgmVolume?: number;
  sfxEnabled?: boolean;
  backgroundTimeline?: BackgroundSegment[];
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src = 'audio.mp3',
  volume = 0.9,
  bgmVibe = 'epic',
  bgmVolume = 0.1,
  sfxEnabled = true,
  backgroundTimeline = [],
}) => {
  const selectedBgmOption = BGM_VIBE_OPTIONS.find(
    (opt) => opt.value === bgmVibe
  );
  const bgmFilePath = selectedBgmOption?.file || null;

  // Identifica os frames exatos onde começa cada nova cena (índice > 0)
  const transitionFrames = backgroundTimeline
    .filter((seg, idx) => idx > 0 && seg.frameStart > 0)
    .map((seg) => seg.frameStart);

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

      {/* 3. Efeitos Sonoros de Transição (Whoosh.mp3) sincronizados a cada corte de cena */}
      {sfxEnabled &&
        transitionFrames.map((cutFrame, idx) => (
          <Sequence
            key={`whoosh_sfx_${idx}_${cutFrame}`}
            from={Math.max(0, cutFrame - 2)}
            durationInFrames={15}
          >
            <Audio src={resolveAssetSrc('sfx/whoosh.mp3')} volume={0.32} />
          </Sequence>
        ))}
    </>
  );
};
