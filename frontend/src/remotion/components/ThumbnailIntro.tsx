import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import {
  AVAILABLE_THUMBNAIL_FONTS,
  resolveAssetSrc,
  ThumbnailTextConfig,
} from '../types';

export interface ThumbnailIntroProps {
  imageSrc: string;
  textConfig?: ThumbnailTextConfig;
}

/**
 * Cena #0: Capa / Thumbnail do Vídeo
 * Exibida nos primeiros 0.5 segundos (15 frames a 30 FPS).
 * Renderiza a imagem selecionada da thumbnail e, caso haja texto customizado,
 * estampa a tipografia com posicionamento, escala 3x (para canvas nativo 1080x1920),
 * stroke e sombras configurados na Cena #0.
 */
export const ThumbnailIntro: React.FC<ThumbnailIntroProps> = ({
  imageSrc,
  textConfig,
}) => {
  const resolvedSrc = resolveAssetSrc(imageSrc);

  const overlayText = textConfig?.text?.trim() || '';

  const effectiveXPercent = textConfig?.xPercent ?? 50;
  const effectiveYPercent =
    textConfig?.yPercent ??
    (textConfig?.position === 'top'
      ? 22
      : textConfig?.position === 'bottom'
        ? 75
        : 50);

  // Escala para resolução nativa 1080x1920 (base de preview era 360px -> 1080 / 360 = 3)
  const scaleFactor = 1080 / 360;
  const fontSizePx = Math.round((textConfig?.fontSize || 64) * scaleFactor);
  const strokeWidthPx = Math.round((textConfig?.strokeWidth ?? 12) * scaleFactor);

  const activeFont = AVAILABLE_THUMBNAIL_FONTS.find(
    (f) => f.id === textConfig?.fontFamily
  );
  const fontFamily =
    activeFont?.family ||
    `"${textConfig?.fontFamily || 'Komika Axis'}", Impact, sans-serif`;

  const lines = overlayText ? overlayText.split('\n').map((l) => l.trim()) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', zIndex: 10 }}>
      {/* Imagem de Fundo da Thumbnail */}
      <Img
        src={resolvedSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Texto de Impacto Sobreposto (Hook) */}
      {lines.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${effectiveXPercent}%`,
            top: `${effectiveYPercent}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            width: 'max-content',
            maxWidth: '92%',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <p
            style={{
              fontFamily,
              fontSize: `${fontSizePx}px`,
              color: textConfig?.textColor || '#EF4444',
              WebkitTextStroke: `${strokeWidthPx}px ${
                textConfig?.strokeColor || '#000000'
              }`,
              paintOrder: 'stroke fill',
              textShadow: '0 12px 42px rgba(0, 0, 0, 0.95)',
              lineHeight: 1.18,
              fontWeight: 900,
              textTransform: 'uppercase',
              textAlign: 'center',
              margin: 0,
              padding: 0,
            }}
          >
            {lines.map((line, idx) => (
              <span
                key={idx}
                style={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                }}
              >
                {line}
              </span>
            ))}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
