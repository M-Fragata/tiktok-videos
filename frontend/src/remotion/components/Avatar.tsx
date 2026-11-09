import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  AvatarSegment,
  DEFAULT_AVATAR_TIMELINE,
  resolveAssetSrc,
} from '../types';

export interface AvatarProps {
  timeline?: AvatarSegment[];
}

export const Avatar: React.FC<AvatarProps> = ({
  timeline = DEFAULT_AVATAR_TIMELINE,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentSecond = frame / fps;

  // Determina a imagem do avatar com base no tempo atual (0-5s, 5-10s, 10-15s)
  const getAvatarImageForTime = (seconds: number): string => {
    const matchedSegment = timeline.find(
      (segment) => seconds >= segment.startSecond && seconds < segment.endSecond
    );

    if (matchedSegment) {
      return matchedSegment.image;
    }

    // Fallback lógico padrão por intervalos de 5 segundos (30 fps):
    // 0 a 5s: avatars/avatar_greeting.png
    // 5 a 10s: avatars/avatar_neutral.png
    // 10 a 15s: avatars/avatar_shocked.png
    if (seconds < 5) {
      return 'avatars/avatar_greeting.png';
    }
    if (seconds < 10) {
      return 'avatars/avatar_neutral.png';
    }
    return 'avatars/avatar_shocked.png';
  };

  // Identifica o início do segmento atual para animar a troca de expressão
  const activeSegment = timeline.find(
    (segment) =>
      currentSecond >= segment.startSecond && currentSecond < segment.endSecond
  );
  const segmentStartFrame = activeSegment
    ? Math.round(activeSegment.startSecond * fps)
    : frame < 150
      ? 0
      : frame < 300
        ? 150
        : 300;

  const popScale = spring({
    frame: Math.max(0, frame - segmentStartFrame),
    fps,
    config: {
      damping: 12,
      stiffness: 160,
      mass: 0.6,
    },
  });

  // Movimento subtil de respiração/flutuação contínua
  const floatOffsetY = interpolate(
    Math.sin(frame / 10),
    [-1, 1],
    [-8, 8]
  );

  const selectedSprite = getAvatarImageForTime(currentSecond);
  const resolvedAvatarSrc = resolveAssetSrc(selectedSprite);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        className="flex flex-col items-center justify-end"
        style={{
          marginBottom: 70,
          transform: `translateY(${floatOffsetY}px) scale(${interpolate(
            popScale,
            [0, 1],
            [0.88, 1]
          )})`,
          filter: 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.75))',
        }}
      >
        <Img
          src={resolvedAvatarSrc}
          alt="Avatar Fragata Shorts"
          style={{
            width: 560,
            height: 560,
            objectFit: 'contain',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

