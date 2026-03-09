"use client";

import { useRef, useState } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

export default function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const pct =
      (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(pct);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoRef.current.duration;
  };

  return (
    <div className="group relative overflow-hidden rounded-card bg-bg-surface">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
        playsInline
      />

      {/* Controls overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Progress bar */}
        <div
          className="mb-2 h-1 cursor-pointer rounded-full bg-white/20"
          onClick={handleSeek}
        >
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="text-white transition-colors hover:text-accent"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Play button overlay when not playing */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
        >
          <div className="rounded-full bg-white/10 p-4 backdrop-blur-sm">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="white"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
