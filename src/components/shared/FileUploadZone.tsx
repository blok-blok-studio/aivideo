"use client";

import { useCallback, useRef, useState } from "react";
import { clsx } from "clsx";

interface FileUploadZoneProps {
  label: string;
  accept: string;
  maxSizeMB: number;
  helperText?: string;
  preview?: string | null;
  previewType?: "image" | "video";
  fileName?: string | null;
  onFile: (file: File) => void;
  onClear?: () => void;
}

export default function FileUploadZone({
  label,
  accept,
  maxSizeMB,
  helperText,
  preview,
  previewType = "image",
  fileName,
  onFile,
  onClear,
}: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File must be under ${maxSizeMB}MB`);
        return;
      }
      onFile(file);
    },
    [maxSizeMB, onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (preview) {
    return (
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          {label}
        </label>
        <div className="relative overflow-hidden rounded-card border border-border-subtle bg-bg-surface shadow-card">
          {previewType === "video" ? (
            <video
              src={preview}
              className="h-40 w-full object-cover sm:h-48"
              controls
              muted
            />
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="h-40 w-full object-cover sm:h-48"
            />
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="absolute right-2 top-2 rounded-full bg-bg/80 p-2 text-text-secondary hover:text-text-primary"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {/* Ready indicator */}
          <div className="flex items-center gap-2 border-t border-border-subtle bg-bg-surface px-4 py-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-xs font-medium text-green-500">
              {previewType === "video" ? "Video" : "Image"} ready
            </span>
            {fileName && (
              <span className="ml-auto truncate text-[10px] font-mono text-text-muted max-w-[200px]">
                {fileName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "upload-zone flex cursor-pointer flex-col items-center justify-center rounded-card bg-bg-surface px-4 py-8 text-center transition-all sm:px-6 sm:py-10",
          dragOver && "drag-over"
        )}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mb-3 text-text-muted"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-text-secondary">
          Drag & drop or{" "}
          <span className="text-accent">click to browse</span>
        </p>
        <p className="mt-1 font-mono text-[10px] text-text-muted">
          {accept.replace(/\./g, "").toUpperCase()} · Max {maxSizeMB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {helperText && (
        <p className="text-xs text-text-muted">{helperText}</p>
      )}
      {error && <p className="text-xs text-status-failed">{error}</p>}
    </div>
  );
}
