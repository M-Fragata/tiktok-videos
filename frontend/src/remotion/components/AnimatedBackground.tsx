import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BackgroundSegment, resolveAssetSrc } from '../types';

export interface AnimatedBackgroundProps {
  src?: string;
  backgroundTimeline?: BackgroundSegment[];
  theme?: string;
}

/**
 * Fase 2: Movimento Matemático de Câmera (Ken Burns Avançado 4-Modos)
 * Aplica interpolação matemática diretamente na imagem B-Roll (que já contém
 * o personagem 2D integrado no cenário 3D), alternando entre Zoom In (1.0 -> 1.15),
 * Zoom Out (1.15 -> 1.0) e Pan direcional (Esquerda / Direita / Centro) via `sceneIndex % 4`.
 */
export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  src = 'background.jpg',
  backgroundTimeline,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Identifica o índice e o segmento ativo no frame atual
  const activeIndex =
    backgroundTimeline?.findIndex(
      (segment) => frame >= segment.frameStart && frame <= segment.frameEnd
    ) ?? -1;

  const hasTimeline = Boolean(
    backgroundTimeline && backgroundTimeline.length > 0
  );

  const resolvedIndex =
    activeIndex !== -1
      ? activeIndex
      : hasTimeline
        ? backgroundTimeline!.length - 1
        : 0;

  const currentSegment = hasTimeline
    ? backgroundTimeline![resolvedIndex]
    : undefined;

  const activeImageSrc = currentSegment ? currentSegment.imageSrc : src;
  const segmentStart = currentSegment ? currentSegment.frameStart : 0;
  const segmentEnd = currentSegment
    ? Math.max(segmentStart + 1, currentSegment.frameEnd)
    : Math.max(1, durationInFrames);

  // Progresso normalizado [0 -> 1] dentro da duração exata da cena atual
  const progress = interpolate(frame, [segmentStart, segmentEnd], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Alterna matematicamente o movimento de câmera a cada corte usando `index % 4`
  const cameraMode = resolvedIndex % 4;

  // Escala alternada: pares fazem Zoom In (1.0 -> 1.15), ímpares fazem Zoom Out (1.15 -> 1.0)
  // Nota: em Zoom Out ou Pan lateral garantimos escala mínima >= 1.04 quando há translação
  // para nunca revelar bordas pretas fora do frame 9:16.
  let scale: number;
  let translateXPercent: number;
  let translateYPercent: number;

  if (cameraMode === 0) {
    // Modo 0: Zoom In Clássico (1.0 -> 1.15) + Pan suave para a Direita
    scale = interpolate(progress, [0, 1], [1.0, 1.15]);
    translateXPercent = interpolate(progress, [0, 1], [0, -2.2]);
    translateYPercent = interpolate(progress, [0, 1], [0, -1.0]);
  } else if (cameraMode === 1) {
    // Modo 1: Zoom Out Cinematográfico (1.15 -> 1.03) + Pan da Esquerda para o Centro
    scale = interpolate(progress, [0, 1], [1.15, 1.03]);
    translateXPercent = interpolate(progress, [0, 1], [-2.5, 0.8]);
    translateYPercent = interpolate(progress, [0, 1], [-1.0, 0]);
  } else if (cameraMode === 2) {
    // Modo 2: Zoom In (1.0 -> 1.15) + Pan da Direita para a Esquerda
    scale = interpolate(progress, [0, 1], [1.02, 1.15]);
    translateXPercent = interpolate(progress, [0, 1], [1.5, -2.0]);
    translateYPercent = interpolate(progress, [0, 1], [1.0, -1.5]);
  } else {
    // Modo 3: Zoom Out (1.15 -> 1.0) Centralizado com leve Tilt ascendente
    scale = interpolate(progress, [0, 1], [1.15, 1.0]);
    translateXPercent = 0;
    translateYPercent = interpolate(progress, [0, 1], [1.5, 0]);
  }

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
          transform: `scale(${scale.toFixed(4)}) translate(${translateXPercent.toFixed(2)}%, ${translateYPercent.toFixed(2)}%)`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      />

      {/* Vinheta cinematográfica escura para garantir contraste das legendas */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.42) 70%, rgba(0,0,0,0.88) 100%)',
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
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            }}
          >
            ⏳ {theme}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

