"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Job, JobStatus, VoiceJobType } from "@/lib/types";

export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
        if (data.status === "complete" || data.status === "failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    } catch {
      // ignore polling errors
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setElapsed(0);
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
      // For now, create a local object URL — in production, upload to R2
      const url = URL.createObjectURL(file);
      // TODO: Replace with actual R2 upload
      // const formData = new FormData();
      // formData.append("file", file);
      // const res = await fetch("/api/upload", { method: "POST", body: formData });
      // const { url } = await res.json();
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
