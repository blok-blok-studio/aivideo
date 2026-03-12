"use client";

import { useState, useMemo, useCallback } from "react";
import FileUploadZone from "@/components/shared/FileUploadZone";
import ModelCard from "@/components/shared/ModelCard";
import { compressImage } from "@/lib/compress";
import { compressVideo, CompressProgress } from "@/lib/compress-video";
import GenerateButton from "@/components/shared/GenerateButton";
import ResultDisplay from "@/components/shared/ResultDisplay";
import {
  MOTION_TRACKING_MODELS,
  MotionTrackingModel,
  CHARACTER_SWAP_MODELS,
  CharacterSwapModel,
  CharacterOrientation,
  estimateMotionTrackingCost,
  estimateCharacterSwapCost,
  JobStatus,
} from "@/lib/types";
import { clsx } from "clsx";
import { useJobPolling } from "@/hooks/useJobPolling";

type TrackingMode = "motion-transfer" | "character-swap";

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
  // Mode toggle
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("motion-transfer");
  const isSwapMode = trackingMode === "character-swap";

  // Reset shared job/pipeline state when switching modes so uploads and
  // progress from one mode don't bleed into the other.
  const handleModeSwitch = useCallback((mode: TrackingMode) => {
    if (mode === trackingMode) return;
    setTrackingMode(mode);
    setJobId(null);
    setLoading(false);
    setProgressStep("idle");
    setErrorMessage(null);
    setStepLogs([]);
  }, [trackingMode]);

  // Per-mode inputs — each mode has its own uploads so switching doesn't bleed state
  const [mtVideo, setMtVideo] = useState<File | null>(null);
  const [mtVideoPreview, setMtVideoPreview] = useState<string | null>(null);
  const [mtImage, setMtImage] = useState<File | null>(null);
  const [mtImagePreview, setMtImagePreview] = useState<string | null>(null);
  const [mtDuration, setMtDuration] = useState<number>(5);

  const [csVideo, setCsVideo] = useState<File | null>(null);
  const [csVideoPreview, setCsVideoPreview] = useState<string | null>(null);
  const [csImage, setCsImage] = useState<File | null>(null);
  const [csImagePreview, setCsImagePreview] = useState<string | null>(null);
  const [csDuration, setCsDuration] = useState<number>(5);

  // Active inputs based on current mode
  const drivingVideo = isSwapMode ? csVideo : mtVideo;
  const drivingPreview = isSwapMode ? csVideoPreview : mtVideoPreview;
  const characterImage = isSwapMode ? csImage : mtImage;
  const characterPreview = isSwapMode ? csImagePreview : mtImagePreview;
  const videoDuration = isSwapMode ? csDuration : mtDuration;

  const setDrivingVideo = isSwapMode ? setCsVideo : setMtVideo;
  const setDrivingPreview = isSwapMode ? setCsVideoPreview : setMtVideoPreview;
  const setCharacterImage = isSwapMode ? setCsImage : setMtImage;
  const setCharacterPreview = isSwapMode ? setCsImagePreview : setMtImagePreview;
  const setVideoDuration = isSwapMode ? setCsDuration : setMtDuration;

  const [orientation, setOrientation] = useState<CharacterOrientation>("image");
  const [prompt, setPrompt] = useState("");
  const [keepAudio, setKeepAudio] = useState(false);
  const [selectedModel, setSelectedModel] = useState<MotionTrackingModel>(
    MOTION_TRACKING_MODELS[0]
  );
  const [selectedSwapModel, setSelectedSwapModel] = useState<CharacterSwapModel>(
    CHARACTER_SWAP_MODELS[0]
  );

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const { job, elapsed } = useJobPolling(jobId);

  const estimatedCost = useMemo(
    () =>
      isSwapMode
        ? estimateCharacterSwapCost(videoDuration, selectedSwapModel.costPer5s)
        : estimateMotionTrackingCost(videoDuration, selectedModel.costPer5s),
    [videoDuration, selectedModel, selectedSwapModel, isSwapMode]
  );

  const activeModelCostPer5s = isSwapMode
    ? selectedSwapModel.costPer5s
    : selectedModel.costPer5s;

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
  }, [setDrivingVideo, setDrivingPreview, setVideoDuration]);

  const handleCharacterImage = useCallback((file: File) => {
    setCharacterImage(file);
    setCharacterPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, [setCharacterImage, setCharacterPreview]);

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

    const videoSizeMB = drivingVideo.size / 1024 / 1024;
    const videoName = drivingVideo.name.toLowerCase();
    const isNonMp4 = !videoName.endsWith(".mp4") && !videoName.endsWith(".webm");
    const needsVideoCompress = videoSizeMB > 45 || isNonMp4; // Compress large files OR convert MOV/AVI/etc.

    const initialLogs: StepLog[] = [
      { step: "load-sdk", status: "pending", detail: "Load fal.ai SDK" },
      {
        step: "upload-image",
        status: "pending",
        detail: `Upload image (${(characterImage.size / 1024 / 1024).toFixed(1)}MB)`,
      },
      ...(needsVideoCompress
        ? [
            {
              step: "compress-video",
              status: "pending" as const,
              detail: isNonMp4
                ? `Convert ${videoName.split(".").pop()?.toUpperCase() || "video"} → web format (${videoSizeMB.toFixed(1)}MB)`
                : `Compress video (${videoSizeMB.toFixed(1)}MB → under 45MB)`,
            },
          ]
        : []),
      {
        step: "upload-video",
        status: "pending",
        detail: `Upload video (${videoSizeMB.toFixed(1)}MB)`,
      },
      { step: "submit-job", status: "pending", detail: "Submit to AI model" },
      { step: "process", status: "pending", detail: isSwapMode ? "Swap character" : "Generate video" },
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

      // ─── Step 2: Compress & upload character image ───
      setProgressStep("uploading-image");
      logs = updateLog(logs, "upload-image", { status: "running", detail: "Compressing image…" });
      setStepLogs([...logs]);
      const startImg = Date.now();

      let imageUrl: string;
      try {
        const compressed = await compressImage(characterImage, {
          maxDimension: 2048,
          quality: 0.88,
        });
        const saved = characterImage.size - compressed.size;
        if (saved > 0) {
          logs = updateLog(logs, "upload-image", {
            status: "running",
            detail: `Compressed ${(characterImage.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB, uploading…`,
          });
          setStepLogs([...logs]);
        }
        imageUrl = await falClient.storage.upload(compressed);
      } catch (imgErr: unknown) {
        // Extract the best available message from fal ApiError or plain Error
        let detail = "";
        if (imgErr && typeof imgErr === "object") {
          const e = imgErr as Record<string, unknown>;
          detail =
            (e.message as string) ||
            (e.detail as string) ||
            (e.statusText as string) ||
            (e.status ? `HTTP ${e.status}` : "") ||
            String(imgErr);
        } else {
          detail = String(imgErr);
        }
        throw new Error(`Image upload failed: ${detail}`);
      }

      logs = updateLog(logs, "upload-image", {
        status: "done",
        time: Date.now() - startImg,
        detail: `Image uploaded → ${imageUrl.slice(0, 60)}…`,
      });
      setStepLogs([...logs]);

      // ─── Step 3a: Compress video if needed ───
      let videoToUpload = drivingVideo;
      if (needsVideoCompress) {
        logs = updateLog(logs, "compress-video", { status: "running", detail: "Analyzing video…" });
        setStepLogs([...logs]);
        const startCompress = Date.now();

        try {
          videoToUpload = await compressVideo(drivingVideo, {
            maxSizeBytes: 45 * 1024 * 1024,
            maxHeight: 720,
            forceConvert: isNonMp4,
            onProgress: (progress: CompressProgress) => {
              const phaseLabel =
                progress.phase === "analyzing"
                  ? "Analyzing video…"
                  : progress.phase === "compressing"
                  ? `Compressing… ${progress.percent}%`
                  : "Finalizing…";
              logs = updateLog(logs, "compress-video", {
                status: "running",
                detail: phaseLabel,
              });
              setStepLogs([...logs]);
            },
          });

          const savedMB = (drivingVideo.size - videoToUpload.size) / 1024 / 1024;
          const newSizeMB = videoToUpload.size / 1024 / 1024;
          const wasCompressed = videoToUpload !== drivingVideo;

          logs = updateLog(logs, "compress-video", {
            status: "done",
            time: Date.now() - startCompress,
            detail: wasCompressed
              ? `${videoSizeMB.toFixed(1)}MB → ${newSizeMB.toFixed(1)}MB (saved ${savedMB.toFixed(1)}MB)`
              : `Already under limit (${videoSizeMB.toFixed(1)}MB)`,
          });
          setStepLogs([...logs]);

          // Update the upload step to reflect new size
          logs = updateLog(logs, "upload-video", {
            detail: `Upload video (${newSizeMB.toFixed(1)}MB)`,
          });
          setStepLogs([...logs]);
        } catch (compressErr) {
          console.warn("[compress] Video compression failed, using original:", compressErr);
          // Continue with original file — don't block the pipeline
          logs = updateLog(logs, "compress-video", {
            status: "done",
            time: Date.now() - startCompress,
            detail: `Compression unavailable — uploading original (${videoSizeMB.toFixed(1)}MB)`,
          });
          setStepLogs([...logs]);
          videoToUpload = drivingVideo;
        }
      }

      // ─── Step 3b: Upload driving video ───
      setProgressStep("uploading-video");
      logs = updateLog(logs, "upload-video", { status: "running" });
      setStepLogs([...logs]);
      const startVid = Date.now();

      let videoUrl: string;
      try {
        videoUrl = await falClient.storage.upload(videoToUpload);
      } catch (vidErr: unknown) {
        let detail = "";
        if (vidErr && typeof vidErr === "object") {
          const e = vidErr as Record<string, unknown>;
          detail =
            (e.message as string) ||
            (e.detail as string) ||
            (e.statusText as string) ||
            (e.status ? `HTTP ${e.status}` : "") ||
            String(vidErr);
        } else {
          detail = String(vidErr);
        }
        throw new Error(`Video upload failed: ${detail}`);
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

      const apiEndpoint = isSwapMode
        ? "/api/generate/character-swap"
        : "/api/generate/motion-tracking";

      const payload = isSwapMode
        ? {
            image_url: imageUrl,
            video_url: videoUrl,
            model_id: selectedSwapModel.modelId,
          }
        : {
            image_url: imageUrl,
            video_url: videoUrl,
            model_id: selectedModel.modelId,
            character_orientation: orientation,
            prompt: prompt || undefined,
            keep_original_sound: keepAudio,
          };

      const activeModelId = isSwapMode ? selectedSwapModel.modelId : selectedModel.modelId;

      logs = updateLog(logs, "submit-job", {
        status: "running",
        detail: `POST ${apiEndpoint} — model: ${activeModelId}`,
      });
      setStepLogs([...logs]);

      let res: Response;
      try {
        res = await fetch(apiEndpoint, {
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
      return { ...l, status: "done" as const, detail: isSwapMode ? "Character swapped successfully" : "Video generated successfully" };
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
    <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 md:mb-8">
        <h2 className="font-display text-xl font-bold text-text-primary md:text-2xl">
          Motion Tracking
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Transfer your movements onto any character with AI motion capture.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6 flex gap-1 rounded-card bg-bg-surface p-1 md:mb-8">
        {(
          [
            { key: "motion-transfer", label: "MOTION TRANSFER", desc: "Apply your movements to a character" },
            { key: "character-swap", label: "CHARACTER SWAP", desc: "Replace yourself with a character" },
          ] as const
        ).map((mode) => (
          <button
            key={mode.key}
            onClick={() => handleModeSwitch(mode.key)}
            className={clsx(
              "flex-1 rounded-input px-2 py-2.5 text-center transition-all sm:px-4",
              trackingMode === mode.key
                ? "bg-bg-input text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <span className="block text-[10px] font-medium uppercase tracking-wider sm:text-xs">
              {mode.label}
            </span>
            <span className="mt-0.5 block text-[9px] font-normal normal-case text-text-muted">
              {mode.desc}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
        {/* Left column — Inputs */}
        <div className="space-y-6">
          <FileUploadZone
            label={isSwapMode ? "YOUR VIDEO" : "YOUR MOVEMENT"}
            accept=".mp4,.mov,.webm"
            maxSizeMB={100}
            helperText={
              isSwapMode
                ? "Upload the video you want the character placed into. Your background and scene are preserved."
                : "Upload the video containing the movements you want to transfer. Clear lighting, full-body framing works best."
            }
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
            helperText={
              isSwapMode
                ? "Upload the person who will replace you in the video. Full-body image recommended."
                : "Upload the person or character you want to perform your movements. Full-body image recommended."
            }
            preview={characterPreview}
            previewType="image"
            fileName={characterImage?.name}
            onFile={handleCharacterImage}
            onClear={() => {
              setCharacterImage(null);
              setCharacterPreview(null);
            }}
          />

          {/* Orientation Toggle — Motion Transfer only */}
          {!isSwapMode && (
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
          )}

          {/* Prompt — Motion Transfer only */}
          {!isSwapMode && (
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
          )}

          {/* Character Swap info callout */}
          {isSwapMode && (
            <div className="rounded-card border border-accent/20 bg-accent/5 px-4 py-3">
              <p className="text-xs text-text-secondary">
                <span className="font-semibold text-accent">How it works:</span>{" "}
                Your original video&apos;s background, lighting, and camera work are preserved.
                The target character replaces you with full-body swap — not just face.
              </p>
            </div>
          )}

          {/* Keep Audio */}
          <div className="flex items-center justify-between rounded-input bg-bg-surface px-4 py-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                KEEP ORIGINAL AUDIO
              </span>
              <p className="text-xs text-text-muted">
                Preserve the audio from your {isSwapMode ? "source" : "driving"} video in the output
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
              {isSwapMode
                ? CHARACTER_SWAP_MODELS.map((model) => (
                    <ModelCard
                      key={model.id}
                      name={model.name}
                      badge={model.badge}
                      description={model.description}
                      cost={`$${model.costPer5s.toFixed(2)} / 5s`}
                      selected={selectedSwapModel.id === model.id}
                      onClick={() => setSelectedSwapModel(model)}
                    />
                  ))
                : MOTION_TRACKING_MODELS.map((model) => (
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
                {videoDuration}s video × ${activeModelCostPer5s.toFixed(2)}
                /5s
              </p>
            )}
          </div>

          <GenerateButton
            label={isSwapMode ? "SWAP CHARACTER" : "TRANSFER MOTION"}
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
                : stepLogs.find((l) => l.step === "compress-video" && l.status === "running")
                ? "Converting video..."
                : isSwapMode
                ? "Swapping..."
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
                    {isSwapMode ? "Character swap failed" : "Generation failed"}
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
                    {isSwapMode ? "Character swap failed" : "Generation failed"}
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
