"use client";

import { useState, useEffect, useCallback } from "react";
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

const PAGE_SIZE = 25;

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchJobs = useCallback(async (cursor?: string | null) => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/jobs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (cursor) {
        setJobs((prev) => [...prev, ...data.jobs]);
      } else {
        setJobs(data.jobs);
      }
      setNextCursor(data.nextCursor);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchJobs();
    }
  }, [open, fetchJobs]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchJobs(nextCursor);
    setLoadingMore(false);
  };

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
          "fixed inset-y-0 right-0 z-50 w-full max-w-md transform border-l border-border-subtle bg-bg transition-transform duration-300 sm:rounded-l-panel",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 md:px-5 md:py-4">
          <h3 className="font-display text-lg font-bold text-text-primary">
            Job History
          </h3>
          <button
            onClick={onClose}
            className="rounded-input p-2 text-text-secondary hover:text-text-primary"
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
        <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-4 py-3 md:px-5">
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
            <>
              {filtered.map((job) => (
                <div key={job.id} className="border-b border-border-subtle">
                  <button
                    onClick={() =>
                      setExpandedJob(expandedJob === job.id ? null : job.id)
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-surface md:px-5"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="h-10 w-14 shrink-0 rounded-input bg-bg-input" />

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
                    <div className="bg-bg-surface px-4 py-4 md:px-5">
                      {job.outputUrl && (
                        <div className="mb-3">
                          <video
                            src={job.outputUrl}
                            controls
                            className="w-full rounded-card"
                          />
                        </div>
                      )}
                      <pre className="overflow-auto rounded-input bg-bg-input p-3 font-mono text-[10px] text-text-muted">
                        {JSON.stringify(job.inputParams, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Load More button */}
              {nextCursor && (
                <div className="px-5 py-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full rounded-input border border-border-subtle px-3 py-2 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:opacity-50"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
