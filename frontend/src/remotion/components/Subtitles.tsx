import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { DEFAULT_SUBTITLES, SubtitleItem } from '../types';

export interface SubtitlesProps {
  subtitles?: SubtitleItem[];
}

export const Subtitles: React.FC<SubtitlesProps> = ({
  subtitles = DEFAULT_SUBTITLES,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentSubtitle = subtitles.find(
    (item) => frame >= item.frameStart && frame <= item.frameEnd
  );

  if (!currentSubtitle) {
    return null;
  }

  const relativeFrame = Math.max(0, frame - currentSubtitle.frameStart);

  // Animação estilo pop do TikTok na entrada de cada bloco de legenda
  const popProgress = spring({
    frame: relativeFrame,
    fps,
    config: {
      damping: 11,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const scale = interpolate(popProgress, [0, 1], [0.82, 1]);
  const opacity = interpolate(relativeFrame, [0, 5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 64,
        paddingRight: 64,
        paddingBottom: 220, // Levemente acima do centro para não colidir com o Avatar inferior
        pointerEvents: 'none',
      }}
    >
      <div
        className="tiktok-subtitle-stroke text-center font-black uppercase tracking-wide"
        style={{
          transform: `scale(${scale})`,
          opacity,
          fontFamily: "'Montserrat', 'Inter', 'Arial Black', system-ui, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1.18,
          color: '#FFFFFF',
          textAlign: 'center',
          textTransform: 'uppercase',
          WebkitTextStroke: '10px #000000',
          paintOrder: 'stroke fill',
          textShadow:
            '0px 8px 20px rgba(0, 0, 0, 0.95), 0px 4px 6px rgba(0, 0, 0, 1)',
          maxWidth: 940,
          wordWrap: 'break-word',
        }}
      >
        {currentSubtitle.text}
      </div>
    </AbsoluteFill>
  );
};

