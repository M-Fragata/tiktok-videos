import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background } from './components/Background';
import { AudioTrack } from './components/AudioTrack';
import { Avatar } from './components/Avatar';
import { Subtitles } from './components/Subtitles';
import {
  DEFAULT_AVATAR_TIMELINE,
  DEFAULT_BACKGROUND_TIMELINE,
  DEFAULT_SUBTITLES,
  DEFAULT_SUBTITLE_STYLE,
  TimeMachineVideoProps,
} from './types';

export const TimeMachineVideo: React.FC<TimeMachineVideoProps> = ({
  theme = 'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  backgroundSrc = 'background.jpg',
  backgroundTimeline = DEFAULT_BACKGROUND_TIMELINE,
  audioSrc = 'audio.mp3',
  subtitles = DEFAULT_SUBTITLES,
  subtitleStyle = DEFAULT_SUBTITLE_STYLE,
  avatarTimeline = DEFAULT_AVATAR_TIMELINE,
  showAvatarOverlay = false,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Camada 1: Cenários dinâmicos (Hard Cut por cena) ocupando o ecrã inteiro (1080x1920) */}
      <Background
        src={backgroundSrc}
        backgroundTimeline={backgroundTimeline}
        theme={theme}
      />

      {/* Camada 2: Ficheiro de Áudio de Narração / Fundo */}
      <AudioTrack src={audioSrc} />

      {/* Camada 3: Overlay opcional do Avatar 2D (desativado por padrão pois o personagem já está integrado na cena Mixed Media) */}
      {showAvatarOverlay && <Avatar timeline={avatarTimeline} />}

      {/* Camada 4: Legendas dinâmicas customizáveis (Karaokê, Pop TikTok ou Hormozi) */}
      <Subtitles subtitles={subtitles} subtitleStyle={subtitleStyle} />
    </AbsoluteFill>
  );
};
