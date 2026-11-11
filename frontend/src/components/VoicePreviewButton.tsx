import React, { useEffect, useRef, useState } from 'react';

interface VoicePreviewButtonProps {
  previewUrl?: string;
  voiceName?: string;
  className?: string;
}

export const VoicePreviewButton: React.FC<VoicePreviewButtonProps> = ({
  previewUrl,
  voiceName,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [previewUrl]);

  if (!previewUrl) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }

    audioRef.current.currentTime = 0;
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.warn('[VoicePreview] Erro ao reproduzir amostra:', err);
        setIsPlaying(false);
      });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        isPlaying
          ? `Pausar amostra de ${voiceName || 'voz'}`
          : `Ouvir amostra de ${voiceName || 'voz'}`
      }
      className={`inline-flex items-center justify-center rounded p-1 transition ${
        isPlaying
          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500'
          : 'bg-[#272730] text-slate-300 hover:bg-[#343440] hover:text-white'
      } ${className}`}
    >
      {isPlaying ? (
        <span className="flex items-center gap-1 text-[10px] font-bold">
          <svg
            className="w-3.5 h-3.5 animate-pulse text-amber-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </span>
      ) : (
        <svg
          className="w-3.5 h-3.5 text-slate-300"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
};

