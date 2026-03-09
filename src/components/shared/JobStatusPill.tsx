"use client";

import { memo } from "react";
import { clsx } from "clsx";
import { JobStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; className: string }
> = {
  queued: {
    label: "In queue...",
    className: "bg-status-queued/20 text-status-queued",
  },
  processing: {
    label: "Generating...",
    className: "bg-status-processing/20 text-status-processing animate-status-pulse",
  },
  complete: {
    label: "Done",
    className: "bg-status-complete/20 text-status-complete",
  },
  failed: {
    label: "Failed",
    className: "bg-status-failed/20 text-status-failed",
  },
};

interface JobStatusPillProps {
  status: JobStatus;
  estimatedTime?: string;
}

export default memo(function JobStatusPill({
  status,
  estimatedTime,
}: JobStatusPillProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase",
        config.className
      )}
    >
      {status === "processing" && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {config.label}
      {estimatedTime && status === "processing" && (
        <span className="font-normal normal-case text-text-muted">
          ({estimatedTime})
        </span>
      )}
    </span>
  );
});
