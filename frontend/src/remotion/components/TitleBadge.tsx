import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface TitleBadgeProps {
  theme?: string;
  durationInFrames?: number;
}

/**
 * Badge animado do tema/título viral do vídeo.
 * - Entrada (frames 0-18): Pop Elástico com física de mola (spring)
 * - Exibição estável (frames 18-105): Leitura nítida e confortável
 * - Saída (frames 105-120): Zoom Out Fade suave
 * - Após frame 120: Removido completamente da tela (desimpedindo cenas e legendas)
 */
export const TitleBadge: React.FC<TitleBadgeProps> = ({
  theme,
  durationInFrames = 120, // 4 segundos padrão a 30 FPS
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!theme || frame >= durationInFrames) {
    return null;
  }

  // 1. Animação de Entrada: Pop Elástico com física de mola Remotion
  const enterSpring = spring({
    frame,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 180,
    },
  });

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 2. Animação de Saída: Zoom Out Fade nos últimos 15 frames
  const exitStartFrame = Math.max(15, durationInFrames - 15);
  const exitProgress = interpolate(
    frame,
    [exitStartFrame, durationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const exitScaleMultiplier = 1 - exitProgress * 0.15; // encolhe de 1.0 para 0.85
  const exitOpacityMultiplier = 1 - exitProgress; // fade de 1.0 para 0.0

  const scale = enterSpring * exitScaleMultiplier;
  const opacity = Math.min(enterOpacity, exitOpacityMultiplier);

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 48px',
        pointerEvents: 'none',
        zIndex: 20,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          border: '2px solid rgba(245, 158, 11, 0.75)',
          borderRadius: 9999,
          padding: '14px 34px',
          color: '#fbbf24',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textAlign: 'center',
          boxShadow:
            '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(245,158,11,0.25)',
          backdropFilter: 'blur(8px)',
          maxWidth: '85%',
          wordBreak: 'break-word',
        }}
      >
        {theme}
      </div>
    </div>
  );
};

