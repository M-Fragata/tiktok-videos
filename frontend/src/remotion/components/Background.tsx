import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { resolveAssetSrc } from '../types';

export interface BackgroundProps {
  src?: string;
  theme?: string;
}

export const Background: React.FC<BackgroundProps> = ({
  src = 'background.jpg',
  theme,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Efeito Ken Burns subtil (zoom lento de 1.0 até 1.12 ao longo dos 15 segundos)
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    extrapolateRight: 'clamp',
  });

  const resolvedSrc = resolveAssetSrc(src);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#090d16' }}>
      <Img
        src={resolvedSrc}
        alt={theme ?? 'Cenário Histórico'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />

      {/* Vinheta escura para garantir contraste das legendas e do avatar */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.20) 35%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.88) 100%)',
        }}
      />

      {/* Badge superior do tema da Máquina do Tempo */}
      {theme && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 48px',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '2px solid rgba(245, 158, 11, 0.6)',
              borderRadius: 9999,
              padding: '14px 32px',
              color: '#fbbf24',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
            }}
          >
            ⏳ {theme}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

