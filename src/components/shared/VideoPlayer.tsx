"use client";

import { memo, useRef, useState, useEffect } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  loop?: boolean;
}

export default memo(function VideoPlayer({ src, poster, loop = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Preload the video when src changes
  useEffect(() => {
    setLoading(true);
    setPlaying(false);
    setProgress(0);
    setBuffered(0);
  }, [src]);

  const togglePlay = () => {
    if (!videoRef.current || loading) return;
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
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleProgress = () => {
    if (!videoRef.current || !videoRef.current.buffered.length) return;
    const end = videoRef.current.buffered.end(
      videoRef.current.buffered.length - 1
    );
    setBuffered((end / videoRef.current.duration) * 100);
  };

  const handleCanPlay = () => {
    setLoading(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoRef.current.duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="group relative overflow-hidden rounded-card bg-bg-surface">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full"
        preload="auto"
        loop={loop}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onCanPlayThrough={handleCanPlay}
        onLoadedMetadata={handleCanPlay}
        onEnded={() => { if (!loop) setPlaying(false); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="text-xs text-white/70">Loading video…</span>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Progress bar with buffer indicator */}
        <div
          className="mb-2 h-1.5 cursor-pointer rounded-full bg-white/20"
          onClick={handleSeek}
        >
          {/* Buffered */}
          <div
            className="absolute h-1.5 rounded-full bg-white/15"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div
            className="relative h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent opacity-0 shadow-sm group-hover:opacity-100" />
          </div>
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

          {/* Time display */}
          {duration > 0 && (
            <span className="font-mono text-[10px] text-white/60">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Play button overlay when not playing and not loading */}
      {!playing && !loading && (
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
});
