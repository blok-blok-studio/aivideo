"use client";

import { useState, useEffect } from "react";
import { Job, Section, JobStatus } from "@/lib/types";
import JobStatusPill from "@/components/shared/JobStatusPill";
import { clsx } from "clsx";

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

type FilterTab = "all" | Section | "failed";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "motion-tracking", label: "TRACKING" },
  { key: "motion-design", label: "DESIGN" },
  { key: "voiceover", label: "VOICE" },
  { key: "failed", label: "FAILED" },
];

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/jobs")
        .then((res) => (res.ok ? res.json() : []))
        .then(setJobs)
        .catch(() => {});
    }
  }, [open]);

  const filtered = jobs.filter((j) => {
    if (filter === "all") return true;
    if (filter === "failed") return j.status === "failed";
    return j.section === filter;
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={clsx(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-border-subtle bg-bg transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="font-display text-lg font-bold text-text-primary">
            Job History
          </h3>
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

        {/* Filters */}
        <div className="flex gap-1 border-b border-border-subtle px-5 py-3">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={clsx(
                "rounded-input px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition-colors",
                filter === tab.key
                  ? "bg-bg-input text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        <div className="overflow-y-auto" style={{ height: "calc(100vh - 120px)" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="mt-2 text-xs">No jobs found</p>
            </div>
          ) : (
            filtered.map((job) => (
              <div key={job.id} className="border-b border-border-subtle">
                <button
                  onClick={() =>
                    setExpandedJob(expandedJob === job.id ? null : job.id)
                  }
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-bg-surface"
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-10 w-14 shrink-0 rounded-sm bg-bg-input" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-text-primary">
                        {job.modelName}
                      </span>
                      <JobStatusPill status={job.status as JobStatus} />
                    </div>
                    <div className="mt-0.5 flex gap-2 font-mono text-[9px] text-text-muted">
                      <span>{job.section}</span>
                      <span>
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                      {job.estimatedCost && (
                        <span>${job.estimatedCost.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={clsx(
                      "shrink-0 text-text-muted transition-transform",
                      expandedJob === job.id && "rotate-180"
                    )}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded details */}
                {expandedJob === job.id && (
                  <div className="bg-bg-surface px-5 py-4">
                    {job.outputUrl && (
                      <div className="mb-3">
                        <video
                          src={job.outputUrl}
                          controls
                          className="w-full rounded-input"
                        />
                      </div>
                    )}
                    <pre className="overflow-auto rounded-input bg-bg-input p-3 font-mono text-[10px] text-text-muted">
                      {JSON.stringify(job.inputParams, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
