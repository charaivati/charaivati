'use client';
import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  autoPlay?: boolean;
  onTime?: (t: number) => void;
  onEnded?: () => void;
  muted?: boolean;
  playKey?: string | number; // change to restart audio
};

export default function AudioPlayer({ src, autoPlay = false, onTime, onEnded, muted = false, playKey }: Props) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const timeHandler = () => onTime && onTime(a.currentTime);
    const endedHandler = () => onEnded && onEnded();
    a.addEventListener('timeupdate', timeHandler);
    a.addEventListener('ended', endedHandler);
    return () => {
      a.removeEventListener('timeupdate', timeHandler);
      a.removeEventListener('ended', endedHandler);
    };
  }, [onTime, onEnded]);

  // restart playback when playKey changes
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    if (autoPlay) {
      // try to play; user gesture required - ensure caller clicked earlier
      a.play().catch(()=>{ /* ignore autoplay errors; user must interact */ });
    }
  }, [playKey, autoPlay]);

  return (
    <audio
      ref={ref}
      src={src}
      autoPlay={autoPlay}
      preload="auto"
      playsInline
      controls={false}
      muted={muted}
    />
  );
}
