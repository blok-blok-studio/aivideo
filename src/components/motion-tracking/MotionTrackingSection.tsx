"use client";

import { useState, useMemo, useCallback } from "react";
import FileUploadZone from "@/components/shared/FileUploadZone";
import ModelCard from "@/components/shared/ModelCard";
import GenerateButton from "@/components/shared/GenerateButton";
import ResultDisplay from "@/components/shared/ResultDisplay";
import {
  MOTION_TRACKING_MODELS,
  MotionTrackingModel,
  CharacterOrientation,
  estimateMotionTrackingCost,
  JobStatus,
} from "@/lib/types";
import { clsx } from "clsx";
import { useJobPolling } from "@/hooks/useJobPolling";

type ProgressStep =
  | "idle"
  | "loading-sdk"
  | "uploading-image"
  | "uploading-video"
  | "submitting"
  | "processing"
  | "complete"
  | "error";

interface StepLog {
  step: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
  time?: number;
}

export default function MotionTrackingSection() {
  // Inputs
  const [drivingVideo, setDrivingVideo] = useState<File | null>(null);
  const [drivingPreview, setDrivingPreview] = useState<string | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [characterPreview, setCharacterPreview] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<CharacterOrientation>("image");
  const [prompt, setPrompt] = useState("");
  const [keepAudio, setKeepAudio] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MotionTrackingModel>(
    MOTION_TRACKING_MODELS[0]
  );
  const [videoDuration, setVideoDuration] = useState<number>(5);

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const { job, elapsed } = useJobPolling(jobId);

  const estimatedCost = useMemo(
    () => estimateMotionTrackingCost(videoDuration, selectedModel.costPer5s),
    [videoDuration, selectedModel]
  );

  const canGenerate = drivingVideo && characterImage && !loading;

  // Update progress based on job polling
  const currentStep =
    job?.status === "complete"
      ? "complete"
      : job?.status === "failed"
      ? "error"
      : job?.status === "processing"
      ? "processing"
      : progressStep;

  const handleDrivingVideo = useCallback((file: File) => {
    setDrivingVideo(file);
    const url = URL.createObjectURL(file);
    setDrivingPreview(url);

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoDuration(Math.round(video.duration));
      URL.revokeObjectURL(video.src);
    };
    video.src = url;
  }, []);

  const handleCharacterImage = useCallback((file: File) => {
    setCharacterImage(file);
    setCharacterPreview(URL.createObjectURL(file));
  }, []);

  // Helper to update a specific step log
  const updateLog = (
    logs: StepLog[],
    step: string,
    update: Partial<StepLog>
  ): StepLog[] => logs.map((l) => (l.step === step ? { ...l, ...update } : l));

  const handleGenerate = async () => {
    if (!drivingVideo || !characterImage) return;
    setLoading(true);
    setJobId(null);
    setErrorMessage(null);

    const initialLogs: StepLog[] = [
      { step: "load-sdk", status: "pending", detail: "Load fal.ai SDK" },
      {
        step: "upload-image",
        status: "pending",
        detail: `Upload image (${(characterImage.size / 1024 / 1024).toFixed(1)}MB)`,
      },
      {
        step: "upload-video",
        status: "pending",
        detail: `Upload video (${(drivingVideo.size / 1024 / 1024).toFixed(1)}MB)`,
      },
      { step: "submit-job", status: "pending", detail: "Submit to AI model" },
      { step: "process", status: "pending", detail: "Generate video" },
    ];
    setStepLogs(initialLogs);
    let logs = initialLogs;

    try {
      // ─── Step 1: Load the fal.ai client SDK ───
      setProgressStep("loading-sdk");
      logs = updateLog(logs, "load-sdk", { status: "running" });
      setStepLogs([...logs]);
      const startSdk = Date.now();

      let falClient: Awaited<
        typeof import("@/lib/fal-client")
      >["falClient"];
      try {
        const mod = await import("@/lib/fal-client");
        falClient = mod.falClient;
      } catch (sdkErr) {
        throw new Error(
          `SDK load failed: ${sdkErr instanceof Error ? sdkErr.message : String(sdkErr)}`
        );
      }

      logs = updateLog(logs, "load-sdk", {
        status: "done",
        time: Date.now() - startSdk,
        detail: "fal.ai SDK loaded",
      });
      setStepLogs([...logs]);

      // ─── Step 2: Upload character image ───
      setProgressStep("uploading-image");
      logs = updateLog(logs, "upload-image", { status: "running" });
      setStepLogs([...logs]);
      const startImg = Date.now();

      let imageUrl: string;
      try {
        imageUrl = await falClient.storage.upload(characterImage);
      } catch (imgErr) {
        throw new Error(
          `Image upload failed: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`
        );
      }

      logs = updateLog(logs, "upload-image", {
        status: "done",
        time: Date.now() - startImg,
        detail: `Image uploaded → ${imageUrl.slice(0, 60)}…`,
      });
      setStepLogs([...logs]);

      // ─── Step 3: Upload driving video ───
      setProgressStep("uploading-video");
      logs = updateLog(logs, "upload-video", { status: "running" });
      setStepLogs([...logs]);
      const startVid = Date.now();

      let videoUrl: string;
      try {
        videoUrl = await falClient.storage.upload(drivingVideo);
      } catch (vidErr) {
        throw new Error(
          `Video upload failed: ${vidErr instanceof Error ? vidErr.message : String(vidErr)}`
        );
      }

      logs = updateLog(logs, "upload-video", {
        status: "done",
        time: Date.now() - startVid,
        detail: `Video uploaded → ${videoUrl.slice(0, 60)}…`,
      });
      setStepLogs([...logs]);

      // ─── Step 4: Submit generation job to API ───
      setProgressStep("submitting");
      logs = updateLog(logs, "submit-job", { status: "running" });
      setStepLogs([...logs]);
      const startSubmit = Date.now();

      const payload = {
        image_url: imageUrl,
        video_url: videoUrl,
        model_id: selectedModel.modelId,
        character_orientation: orientation,
        prompt: prompt || undefined,
        keep_original_sound: keepAudio,
      };

      logs = updateLog(logs, "submit-job", {
        status: "running",
        detail: `POST /api/generate/motion-tracking — model: ${selectedModel.modelId}`,
      });
      setStepLogs([...logs]);

      let res: Response;
      try {
        res = await fetch("/api/generate/motion-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        throw new Error(
          `API request failed (network): ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
        );
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail =
          errData.error ||
          errData.details?.[0]?.message ||
          `HTTP ${res.status}`;
        throw new Error(`API error (${res.status}): ${detail}`);
      }

      const data = await res.json();

      if (!data.jobId) {
        throw new Error(
          `API returned no jobId. Response: ${JSON.stringify(data).slice(0, 200)}`
        );
      }

      logs = updateLog(logs, "submit-job", {
        status: "done",
        time: Date.now() - startSubmit,
        detail: `Job submitted → ${data.jobId}`,
      });
      setStepLogs([...logs]);

      // ─── Step 5: Start polling ───
      setJobId(data.jobId);
      setProgressStep("processing");
      logs = updateLog(logs, "process", {
        status: "running",
        detail: `Polling job ${data.jobId}…`,
      });
      setStepLogs([...logs]);
    } catch (err) {
      console.error("Generation error:", err);
      setProgressStep("error");

      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setErrorMessage(message);

      // Mark the currently running step as failed
      logs = logs.map((l) =>
        l.status === "running" ? { ...l, status: "failed" as const, detail: message } : l
      );
      setStepLogs([...logs]);
    } finally {
      setLoading(false);
    }
  };

  // When job completes or fails from polling, update the process step log
  const jobWithStatus = job as (typeof job) & { falStatus?: string; falStatusError?: string } | null;
  const displayLogs = stepLogs.map((l) => {
    if (l.step === "process" && jobWithStatus?.status === "complete") {
      return { ...l, status: "done" as const, detail: "Video generated successfully" };
    }
    if (l.step === "process" && jobWithStatus?.status === "failed") {
      return {
        ...l,
        status: "failed" as const,
        detail: jobWithStatus.errorMsg || "Generation failed on fal.ai side",
      };
    }
    if (l.step === "process" && jobWithStatus?.falStatus) {
      return {
        ...l,
        detail: `fal.ai status: ${jobWithStatus.falStatus}${jobWithStatus.falStatusError ? ` (error: ${jobWithStatus.falStatusError})` : ""}`,
      };
    }
    if (l.step === "process" && jobWithStatus?.falStatusError) {
      return {
        ...l,
        detail: `Polling error: ${jobWithStatus.falStatusError}`,
      };
    }
    return l;
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Motion Tracking
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Transfer your movements onto any character with AI motion capture.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column — Inputs */}
        <div className="space-y-6">
          <FileUploadZone
            label="YOUR MOVEMENT"
            accept=".mp4,.mov,.webm"
            maxSizeMB={100}
            helperText="Upload the video containing the movements you want to transfer. Clear lighting, full-body framing works best."
            preview={drivingPreview}
            previewType="video"
            fileName={drivingVideo?.name}
            onFile={handleDrivingVideo}
            onClear={() => {
              setDrivingVideo(null);
              setDrivingPreview(null);
            }}
          />

          <FileUploadZone
            label="TARGET CHARACTER"
            accept=".jpg,.png,.webp"
            maxSizeMB={10}
            helperText="Upload the person or character you want to perform your movements. Full-body image recommended."
            preview={characterPreview}
            previewType="image"
            fileName={characterImage?.name}
            onFile={handleCharacterImage}
            onClear={() => {
              setCharacterImage(null);
              setCharacterPreview(null);
            }}
          />

          {/* Orientation Toggle */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              ORIENTATION MODE
            </label>
            <div className="flex gap-2">
              {(["image", "video"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setOrientation(mode)}
                  className={clsx(
                    "flex-1 rounded-input px-4 py-2 text-xs font-medium uppercase transition-all",
                    orientation === mode
                      ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                      : "bg-bg-input text-text-secondary hover:text-text-primary"
                  )}
                >
                  MATCH {mode === "image" ? "IMAGE" : "VIDEO"}
                  <span className="mt-0.5 block font-mono text-[9px] font-normal normal-case text-text-muted">
                    {mode === "image"
                      ? "Preserves original pose, up to 10s"
                      : "Follows driving video, up to 30s"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                SCENE CONTEXT (optional)
              </label>
              <span className="font-mono text-[10px] text-text-muted">
                {prompt.length}/2500
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 2500))}
              placeholder="Describe background, environment, lighting, or style. The model handles motion automatically — use this for context only."
              rows={3}
              className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {/* Keep Audio */}
          <div className="flex items-center justify-between rounded-input bg-bg-surface px-4 py-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                KEEP ORIGINAL AUDIO
              </span>
              <p className="text-xs text-text-muted">
                Preserve the audio from your driving video in the output
              </p>
            </div>
            <button
              onClick={() => setKeepAudio(!keepAudio)}
              className={clsx(
                "relative h-6 w-11 rounded-full transition-colors",
                keepAudio ? "bg-accent" : "bg-bg-input"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  keepAudio ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {/* Right column — Model Selector + Settings */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              SELECT MODEL
            </label>
            <div className="space-y-3">
              {MOTION_TRACKING_MODELS.map((model) => (
                <ModelCard
                  key={model.id}
                  name={model.name}
                  badge={model.badge}
                  description={model.description}
                  cost={`$${model.costPer5s.toFixed(2)} / 5s`}
                  selected={selectedModel.id === model.id}
                  onClick={() => setSelectedModel(model)}
                />
              ))}
            </div>
          </div>

          {/* Cost Estimator */}
          <div className="rounded-input bg-bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Estimated cost
              </span>
              <span className="font-mono text-sm font-medium text-text-primary">
                ~${estimatedCost.toFixed(2)}
              </span>
            </div>
            {videoDuration > 0 && (
              <p className="mt-1 font-mono text-[10px] text-text-muted">
                {videoDuration}s video × ${selectedModel.costPer5s.toFixed(2)}
                /5s
              </p>
            )}
          </div>

          <GenerateButton
            label="TRANSFER MOTION"
            loading={loading || currentStep === "processing"}
            loadingLabel={
              currentStep === "loading-sdk"
                ? "Loading SDK..."
                : currentStep === "uploading-image"
                ? "Uploading image..."
                : currentStep === "uploading-video"
                ? "Uploading video..."
                : currentStep === "submitting"
                ? "Submitting job..."
                : "Generating..."
            }
            disabled={!canGenerate}
            onClick={handleGenerate}
          />

          {/* ── Detailed Step Log ── */}
          {displayLogs.length > 0 && currentStep !== "idle" && (
            <div className="rounded-card border border-border-subtle bg-bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  PIPELINE STATUS
                </span>
                {currentStep === "processing" && elapsed > 0 && (
                  <span className="font-mono text-[10px] text-text-muted">
                    {Math.floor(elapsed / 60)}:
                    {(elapsed % 60).toString().padStart(2, "0")} elapsed
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {displayLogs.map((log, idx) => (
                  <div key={log.step}>
                    {/* Step header */}
                    <div className="flex items-center gap-2">
                      {/* Status icon */}
                      <div
                        className={clsx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          log.status === "done"
                            ? "bg-green-500/20 text-green-500"
                            : log.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : log.status === "running"
                            ? "bg-accent/20 text-accent"
                            : "bg-bg-input text-text-muted"
                        )}
                      >
                        {log.status === "done" ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : log.status === "failed" ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>

                      {/* Step name */}
                      <span
                        className={clsx(
                          "text-xs font-medium",
                          log.status === "done"
                            ? "text-green-500"
                            : log.status === "failed"
                            ? "text-red-400"
                            : log.status === "running"
                            ? "text-text-primary"
                            : "text-text-muted"
                        )}
                      >
                        {log.detail || log.step}
                        {log.status === "running" && (
                          <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        )}
                      </span>

                      {/* Timing */}
                      {log.time !== undefined && (
                        <span className="ml-auto font-mono text-[10px] text-text-muted">
                          {log.time < 1000
                            ? `${log.time}ms`
                            : `${(log.time / 1000).toFixed(1)}s`}
                        </span>
                      )}
                    </div>

                    {/* Error detail for failed steps */}
                    {log.status === "failed" && (
                      <div className="ml-7 mt-1 rounded bg-red-500/5 px-3 py-2 font-mono text-[11px] text-red-400/80 break-all">
                        {log.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress bar for processing */}
              {currentStep === "processing" && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-bg-input">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(95, (elapsed / 120) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error summary with retry */}
          {currentStep === "error" && errorMessage && (
            <div className="rounded-card border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  className="mt-0.5 shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-400">
                    Generation failed
                  </p>
                  <p className="mt-1 text-xs text-red-400/70 break-all">
                    {errorMessage}
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="mt-3 rounded-input bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {job && job.status === "complete" && (
            <ResultDisplay
              status={job.status as JobStatus}
              outputUrl={job.outputUrl}
              errorMsg={job.errorMsg}
              onRetry={handleGenerate}
            />
          )}

          {/* Job failed from server side */}
          {job && job.status === "failed" && !errorMessage && (
            <div className="rounded-card border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  className="mt-0.5 shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Generation failed
                  </p>
                  <p className="mt-1 text-xs text-red-400/70">
                    {job.errorMsg ||
                      "The AI model encountered an error processing your request."}
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="mt-3 rounded-input bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
