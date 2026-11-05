import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background } from './components/Background';
import { AudioTrack } from './components/AudioTrack';
import { Avatar } from './components/Avatar';
import { Subtitles } from './components/Subtitles';
import {
  DEFAULT_AVATAR_TIMELINE,
  DEFAULT_SUBTITLES,
  TimeMachineVideoProps,
} from './types';

export const TimeMachineVideo: React.FC<TimeMachineVideoProps> = ({
  theme = 'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  backgroundSrc = 'background.jpg',
  audioSrc = 'audio.mp3',
  subtitles = DEFAULT_SUBTITLES,
  avatarTimeline = DEFAULT_AVATAR_TIMELINE,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Camada 1: Imagem de Cenário ocupando o ecrã inteiro (1080x1920) */}
      <Background src={backgroundSrc} theme={theme} />

      {/* Camada 2: Ficheiro de Áudio de Fundo */}
      <AudioTrack src={audioSrc} />

      {/* Camada 3: Personagem Principal na parte inferior central (0-5s, 5-10s, 10-15s) */}
      <Avatar timeline={avatarTimeline} />

      {/* Camada 4: Legendas dinâmicas estilo TikTok no centro do ecrã */}
      <Subtitles subtitles={subtitles} />
    </AbsoluteFill>
  );
};

