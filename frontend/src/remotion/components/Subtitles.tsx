import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  DEFAULT_SUBTITLES,
  DEFAULT_SUBTITLE_STYLE,
  ensureSubtitleWordTimings,
  SubtitleFontFamily,
  SubtitleItem,
  SubtitleStyleConfig,
} from '../types';

export interface SubtitlesProps {
  subtitles?: SubtitleItem[];
  subtitleStyle?: SubtitleStyleConfig;
}

const FONT_FAMILY_MAP: Record<SubtitleFontFamily, string> = {
  impact: "'Impact', 'Anton', 'Arial Black', system-ui, sans-serif",
  grotesque: "'Inter', 'Helvetica Neue', 'Arial', system-ui, sans-serif",
  script: "'Georgia', 'Playfair Display', 'Times New Roman', cursive, serif",
  montserrat: "'Montserrat', 'Arial Black', 'Inter', system-ui, sans-serif",
};

export const Subtitles: React.FC<SubtitlesProps> = ({
  subtitles = DEFAULT_SUBTITLES,
  subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const styleConfig: SubtitleStyleConfig = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...subtitleStyle,
  };

  const currentSubtitle = subtitles.find(
    (item) => frame >= item.frameStart && frame <= item.frameEnd
  );

  if (!currentSubtitle) {
    return null;
  }

  const wordTimings = ensureSubtitleWordTimings(currentSubtitle);

  // Determina qual palavra está ativa no frame atual (baseado nos timestamps da ElevenLabs ou divisão proporcional no preview)
  let activeWordIndex = wordTimings.findIndex(
    (w) => frame >= w.frameStart && frame <= w.frameEnd
  );
  if (activeWordIndex === -1 && wordTimings.length > 0) {
    if (frame < wordTimings[0].frameStart) {
      activeWordIndex = 0;
    } else {
      for (let i = wordTimings.length - 1; i >= 0; i--) {
        if (frame >= wordTimings[i].frameStart) {
          activeWordIndex = i;
          break;
        }
      }
      if (activeWordIndex === -1) {
        activeWordIndex = wordTimings.length - 1;
      }
    }
  }

  const activeWordObj =
    activeWordIndex >= 0 ? wordTimings[activeWordIndex] : null;

  const blockRelativeFrame = Math.max(0, frame - currentSubtitle.frameStart);
  const wordRelativeFrame = activeWordObj
    ? Math.max(0, frame - activeWordObj.frameStart)
    : blockRelativeFrame;

  // Animação do bloco (Pop TikTok / Karaokê)
  const blockPopProgress = spring({
    frame: blockRelativeFrame,
    fps,
    config: {
      damping: 11,
      stiffness: 200,
      mass: 0.5,
    },
  });

  // Animação rápida por palavra (Hormozi / Realce Karaokê)
  const wordPopProgress = spring({
    frame: wordRelativeFrame,
    fps,
    config: {
      damping: 10,
      stiffness: 260,
      mass: 0.4,
    },
  });

  const blockScale =
    styleConfig.animationType === 'hormozi'
      ? interpolate(wordPopProgress, [0, 1], [0.76, 1.05])
      : interpolate(blockPopProgress, [0, 1], [0.82, 1]);

  const opacity = interpolate(blockRelativeFrame, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const strokeWidthPx = styleConfig.hasStroke
    ? Math.max(4, Math.round(styleConfig.fontSize * 0.15))
    : 0;

  const textShadowValue = styleConfig.hasShadow
    ? '0px 8px 20px rgba(0, 0, 0, 0.95), 0px 4px 6px rgba(0, 0, 0, 1)'
    : 'none';

  const resolvedFontFamily =
    FONT_FAMILY_MAP[styleConfig.fontFamily] || FONT_FAMILY_MAP.impact;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${styleConfig.positionX}%`,
          top: `${styleConfig.positionY}%`,
          transform: `translate(-50%, -50%) scale(${blockScale})`,
          opacity,
          width: '88%',
          maxWidth: 960,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          className="tiktok-subtitle-stroke text-center font-black uppercase tracking-wide"
          style={{
            fontFamily: resolvedFontFamily,
            fontSize: styleConfig.fontSize,
            fontWeight: 900,
            lineHeight: 1.18,
            color: styleConfig.primaryColor,
            textAlign: 'center',
            textTransform: styleConfig.fontFamily === 'script' ? 'none' : 'uppercase',
            WebkitTextStroke:
              strokeWidthPx > 0
                ? `${strokeWidthPx}px #000000`
                : '0px transparent',
            paintOrder: 'stroke fill',
            textShadow: textShadowValue,
            backgroundColor: styleConfig.hasBackground
              ? 'rgba(0, 0, 0, 0.72)'
              : 'transparent',
            padding: styleConfig.hasBackground ? '14px 28px' : '0px',
            borderRadius: styleConfig.hasBackground ? '22px' : '0px',
            wordWrap: 'break-word',
          }}
        >
          {styleConfig.animationType === 'hormozi' && activeWordObj ? (
            <span
              style={{
                display: 'inline-block',
                color:
                  activeWordIndex % 2 === 1
                    ? styleConfig.highlightColor
                    : styleConfig.primaryColor,
              }}
            >
              {activeWordObj.word}
            </span>
          ) : styleConfig.animationType === 'karaoke' &&
            wordTimings.length > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                columnGap: '0.26em',
                rowGap: '0.08em',
              }}
            >
              {wordTimings.map((w, idx) => {
                const isActive = idx === activeWordIndex;
                const activeWordScale = isActive
                  ? interpolate(wordPopProgress, [0, 1], [0.95, 1.08])
                  : 1;
                return (
                  <span
                    key={`${idx}-${w.word}`}
                    style={{
                      display: 'inline-block',
                      color: isActive
                        ? styleConfig.highlightColor
                        : styleConfig.primaryColor,
                      transform: `scale(${activeWordScale})`,
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </span>
          ) : (
            <span>{currentSubtitle.text}</span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

