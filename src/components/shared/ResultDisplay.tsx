"use client";

import { memo } from "react";
import VideoPlayer from "./VideoPlayer";
import JobStatusPill from "./JobStatusPill";
import { JobStatus } from "@/lib/types";

interface ResultDisplayProps {
  status: JobStatus;
  outputUrl?: string | null;
  outputType?: "video" | "audio";
  errorMsg?: string | null;
  onRetry?: () => void;
  onSave?: () => void;
}

export default memo(function ResultDisplay({
  status,
  outputUrl,
  outputType = "video",
  errorMsg,
  onRetry,
  onSave,
}: ResultDisplayProps) {
  if (status === "queued" || status === "processing") {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-bg-surface p-8">
        <JobStatusPill status={status} />
        {status === "processing" && (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-bg-input">
            <div className="h-full animate-pulse rounded-full bg-accent/50" style={{ width: "60%" }} />
          </div>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="mt-4 rounded-card border border-status-failed/20 bg-status-failed/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <JobStatusPill status="failed" />
            <span className="text-xs text-text-secondary">
              {errorMsg || "Generation failed"}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-input border border-border-subtle px-3 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "complete" && outputUrl) {
    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <JobStatusPill status="complete" />
        </div>

        {outputType === "video" ? (
          <VideoPlayer src={outputUrl} />
        ) : (
          <div className="rounded-card border border-border-subtle bg-bg-surface p-4">
            <audio src={outputUrl} controls className="w-full" />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={outputUrl}
            download
            className="flex-1 rounded-input border border-border-subtle px-3 py-2.5 text-center text-xs text-text-secondary hover:border-border-hover hover:text-text-primary"
          >
            Download
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(outputUrl)}
            className="flex-1 rounded-input border border-border-subtle px-3 py-2.5 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary"
          >
            Copy URL
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="flex-1 rounded-input bg-accent/10 px-3 py-2.5 text-xs text-accent hover:bg-accent/20"
            >
              Save to Gallery
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
});
