import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AnimatedBackground } from './components/AnimatedBackground';
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
  bgmVibe = 'epic',
  bgmVolume = 0.1,
  sfxEnabled = true,
  subtitles = DEFAULT_SUBTITLES,
  subtitleStyle = DEFAULT_SUBTITLE_STYLE,
  avatarTimeline = DEFAULT_AVATAR_TIMELINE,
  showAvatarOverlay = false,
  storyboard,
}) => {
  const effectiveBgmVibe = bgmVibe || storyboard?.bgmVibe || 'epic';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Camada 1: Cenários dinâmicos com Movimento Matemático Ken Burns (index % 4) */}
      <AnimatedBackground
        src={backgroundSrc}
        backgroundTimeline={backgroundTimeline}
        theme={theme}
      />

      {/* Camada 2: Design de Som (Narração + Música de Fundo em Loop 10% + SFX por cena) */}
      <AudioTrack
        src={audioSrc}
        bgmVibe={effectiveBgmVibe}
        bgmVolume={bgmVolume}
        sfxEnabled={sfxEnabled}
        backgroundTimeline={backgroundTimeline}
        scenes={storyboard?.scenes}
      />

      {/* Camada 3: Overlay opcional do Avatar 2D (desativado por padrão pois o personagem já está integrado na cena Mixed Media) */}
      {showAvatarOverlay && <Avatar timeline={avatarTimeline} />}

      {/* Camada 4: Legendas dinâmicas customizáveis (Karaokê, Pop TikTok ou Hormozi) */}
      <Subtitles subtitles={subtitles} subtitleStyle={subtitleStyle} />
    </AbsoluteFill>
  );
};
