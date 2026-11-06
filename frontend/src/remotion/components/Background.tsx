import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BackgroundSegment, resolveAssetSrc } from '../types';

export interface BackgroundProps {
  src?: string;
  backgroundTimeline?: BackgroundSegment[];
  theme?: string;
}

export const Background: React.FC<BackgroundProps> = ({
  src = 'background.jpg',
  backgroundTimeline,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Seleciona o cenário ativo da cena atual (Hard Cut sincronizado com o início da frase)
  const activeSegment = backgroundTimeline?.find(
    (segment) => frame >= segment.frameStart && frame <= segment.frameEnd
  );

  // Fallback para o último segmento se o frame estiver no buffer final (+0.5s)
  const fallbackSegment =
    !activeSegment && backgroundTimeline && backgroundTimeline.length > 0
      ? backgroundTimeline[backgroundTimeline.length - 1]
      : undefined;

  const currentSegment = activeSegment ?? fallbackSegment;
  const activeImageSrc = currentSegment ? currentSegment.imageSrc : src;
  const segmentStart = currentSegment ? currentSegment.frameStart : 0;
  const segmentEnd = currentSegment
    ? currentSegment.frameEnd
    : durationInFrames;

  // Efeito Ken Burns subtil reiniciado a cada corte seco de cena
  const scale = interpolate(
    frame,
    [segmentStart, Math.max(segmentStart + 1, segmentEnd)],
    [1, 1.1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const resolvedSrc = resolveAssetSrc(activeImageSrc);

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
