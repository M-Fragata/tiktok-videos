import React from 'react';
import { Audio } from 'remotion';
import { resolveAssetSrc } from '../types';

export interface AudioTrackProps {
  src?: string;
  volume?: number;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src = 'audio.mp3',
  volume = 0.8,
}) => {
  if (!src) {
    return null;
  }

  const resolvedAudioSrc = resolveAssetSrc(src);

  return <Audio src={resolvedAudioSrc} volume={volume} />;
};

