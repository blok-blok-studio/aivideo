"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Job, JobStatus, VoiceJobType } from "@/lib/types";

export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<(Job & { falStatus?: string; falStatusError?: string }) | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollErrorCount = useRef(0);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
        pollErrorCount.current = 0;
        if (data.status === "complete" || data.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } else {
        pollErrorCount.current++;
        console.error(`Poll error ${pollErrorCount.current}: HTTP ${res.status}`);
        // After 20 consecutive poll failures (60s), stop polling
        if (pollErrorCount.current >= 20 && intervalRef.current) {
          clearInterval(intervalRef.current);
          setJob((prev) =>
            prev
              ? { ...prev, status: "failed" as JobStatus, errorMsg: `Polling failed after ${pollErrorCount.current} attempts (HTTP ${res.status})` }
              : null
          );
        }
      }
    } catch (err) {
      pollErrorCount.current++;
      console.error(`Poll network error ${pollErrorCount.current}:`, err);
      if (pollErrorCount.current >= 20 && intervalRef.current) {
        clearInterval(intervalRef.current);
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed" as JobStatus, errorMsg: "Network error during polling" }
            : null
        );
      }
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setElapsed(0);
    pollErrorCount.current = 0;
    poll();
    intervalRef.current = setInterval(() => {
      poll();
      setElapsed((prev) => prev + 3);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, poll]);

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
