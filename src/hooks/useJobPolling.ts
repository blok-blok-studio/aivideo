"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Job, JobStatus, VoiceJobType } from "@/lib/types";

const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10000;
const POLL_BACKOFF_FACTOR = 1.3;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const POLL_MAX_ERRORS = 20;

function getNextInterval(pollCount: number): number {
  const base = Math.min(
    POLL_INITIAL_MS * Math.pow(POLL_BACKOFF_FACTOR, pollCount),
    POLL_MAX_MS
  );
  // Add jitter (0-1s) to prevent thundering herd
  return base + Math.random() * 1000;
}

export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<(Job & { falStatus?: string; falStatusError?: string }) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollCountRef = useRef(0);
  const pollErrorCount = useRef(0);
  const startTimeRef = useRef<number>(0);

  const clearPollTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!jobId) return;

    // Check max duration
    if (Date.now() - startTimeRef.current > POLL_MAX_DURATION_MS) {
      clearPollTimeout();
      setJob((prev) =>
        prev
          ? { ...prev, status: "failed" as JobStatus, errorMsg: "Polling timed out after 10 minutes" }
          : null
      );
      return;
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
        pollErrorCount.current = 0;
        if (data.status === "complete" || data.status === "failed") {
          clearPollTimeout();
          return;
        }
      } else {
        pollErrorCount.current++;
        console.error(`Poll error ${pollErrorCount.current}: HTTP ${res.status}`);
        if (pollErrorCount.current >= POLL_MAX_ERRORS) {
          clearPollTimeout();
          setJob((prev) =>
            prev
              ? { ...prev, status: "failed" as JobStatus, errorMsg: `Polling failed after ${pollErrorCount.current} attempts (HTTP ${res.status})` }
              : null
          );
          return;
        }
      }
    } catch (err) {
      pollErrorCount.current++;
      console.error(`Poll network error ${pollErrorCount.current}:`, err);
      if (pollErrorCount.current >= POLL_MAX_ERRORS) {
        clearPollTimeout();
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed" as JobStatus, errorMsg: "Network error during polling" }
            : null
        );
        return;
      }
    }

    // Schedule next poll with backoff
    pollCountRef.current++;
    const nextInterval = getNextInterval(pollCountRef.current);
    setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    timeoutRef.current = setTimeout(poll, nextInterval);
  }, [jobId, clearPollTimeout]);

  useEffect(() => {
    if (!jobId) return;
    setElapsed(0);
    pollCountRef.current = 0;
    pollErrorCount.current = 0;
    startTimeRef.current = Date.now();
    poll();
    return clearPollTimeout;
  }, [jobId, poll, clearPollTimeout]);

  return { job, elapsed };
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      // Import the client-side fal instance (uses proxy for auth,
      // but uploads directly to fal.ai CDN via presigned URL —
      // bypasses Vercel's 4.5MB body size limit)
      const { falClient } = await import("@/lib/fal-client");
      const url = await falClient.storage.upload(file);
      return url;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}

export function useBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/balance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.balance !== undefined) setBalance(data.balance);
      })
      .catch(() => {});
  }, []);

  return balance;
}
