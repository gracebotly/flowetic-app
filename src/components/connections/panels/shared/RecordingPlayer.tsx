'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface RecordingPlayerProps {
  url: string;
  stereoUrl?: string;
  assistantUrl?: string;
  customerUrl?: string;
}

type TrackKey = 'full' | 'agent' | 'customer';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingPlayer({ url, stereoUrl, assistantUrl, customerUrl }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTrack, setActiveTrack] = useState<TrackKey>('full');

  const src = useMemo(() => {
    if (activeTrack === 'agent' && assistantUrl) return assistantUrl;
    if (activeTrack === 'customer' && customerUrl) return customerUrl;
    return stereoUrl ?? url;
  }, [activeTrack, assistantUrl, customerUrl, stereoUrl, url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);


  const switchTrack = (track: TrackKey) => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveTrack(track);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    await audio.play();
    setIsPlaying(true);
  };

  return (
    <div className="space-y-2">
      {(stereoUrl || assistantUrl || customerUrl) ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchTrack('full')}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors duration-200 ${
              activeTrack === 'full'
                ? 'bg-gray-900 text-white'
                : 'cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Full Call
          </button>
          {assistantUrl ? (
            <button
              type="button"
              onClick={() => switchTrack('agent')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                activeTrack === 'agent'
                  ? 'bg-gray-900 text-white'
                  : 'cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Agent
            </button>
          ) : null}
          {customerUrl ? (
            <button
              type="button"
              onClick={() => switchTrack('customer')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors duration-200 ${
                activeTrack === 'customer'
                  ? 'bg-gray-900 text-white'
                  : 'cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Customer
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white transition-colors duration-200 hover:bg-gray-700"
          aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        <div className="text-xs font-mono text-gray-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <audio ref={audioRef} className="hidden" src={src} preload="metadata" />
      </div>
    </div>
  );
}
