"use client";

import { useState, useEffect } from "react";
import { Job } from "@/lib/types";
import { clsx } from "clsx";

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GalleryModal({ open, onClose }: GalleryModalProps) {
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/jobs?saved=true")
        .then((res) => (res.ok ? res.json() : []))
        .then(setSavedJobs)
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4 md:p-6">
      <div className="relative max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-t-panel border border-border-subtle bg-bg sm:max-h-[90vh] sm:rounded-panel">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-bg/90 px-4 py-3 backdrop-blur-sm md:px-6 md:py-4">
          <h3 className="font-display text-lg font-bold text-text-primary">
            Output Gallery
          </h3>
          <div className="flex items-center gap-3">
            <button className="rounded-input border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary">
              Download All
            </button>
            <button
              onClick={onClose}
              className="rounded-input p-1 text-text-secondary transition-colors hover:text-text-primary"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 md:p-6">
          {savedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="mt-3 text-sm">No saved outputs yet</p>
              <p className="text-xs text-text-muted">
                Save completed jobs to see them here
              </p>
            </div>
          ) : (
            <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
              {savedJobs.map((job) => (
                <div
                  key={job.id}
                  className="mb-4 break-inside-avoid"
                  onMouseEnter={() => setHoveredId(job.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="group relative overflow-hidden rounded-card border border-border-subtle bg-bg-surface">
                    {job.outputUrl && (
                      <video
                        src={job.outputUrl}
                        className="w-full"
                        muted
                        loop
                        playsInline
                        autoPlay={hoveredId === job.id}
                        onMouseEnter={(e) =>
                          (e.target as HTMLVideoElement).play()
                        }
                        onMouseLeave={(e) => {
                          const vid = e.target as HTMLVideoElement;
                          vid.pause();
                          vid.currentTime = 0;
                        }}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-sm bg-bg/60 px-1.5 py-0.5 font-mono text-[9px] text-text-primary backdrop-blur-sm">
                        {job.modelName}
                      </span>
                      <p className="mt-1 font-mono text-[9px] text-text-muted">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
