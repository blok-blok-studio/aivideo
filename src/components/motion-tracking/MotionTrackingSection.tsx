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
import { useJobPolling, useFileUpload } from "@/hooks/useJobPolling";

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
  const { job, elapsed } = useJobPolling(jobId);
  const { upload } = useFileUpload();

  const estimatedCost = useMemo(
    () => estimateMotionTrackingCost(videoDuration, selectedModel.costPer5s),
    [videoDuration, selectedModel]
  );

  const canGenerate = drivingVideo && characterImage && !loading;

  const handleDrivingVideo = useCallback((file: File) => {
    setDrivingVideo(file);
    const url = URL.createObjectURL(file);
    setDrivingPreview(url);

    // Get video duration
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

  const handleGenerate = async () => {
    if (!drivingVideo || !characterImage) return;
    setLoading(true);
    setJobId(null);

    try {
      const [imageUrl, videoUrl] = await Promise.all([
        upload(characterImage),
        upload(drivingVideo),
      ]);

      const res = await fetch("/api/generate/motion-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          video_url: videoUrl,
          model_id: selectedModel.modelId,
          character_orientation: orientation,
          prompt: prompt || undefined,
          keep_original_sound: keepAudio,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit job");
      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
                {videoDuration}s video × ${selectedModel.costPer5s.toFixed(2)}/5s
              </p>
            )}
          </div>

          <GenerateButton
            label="TRANSFER MOTION"
            loading={loading || (!!jobId && job?.status === "processing")}
            loadingLabel="Transferring..."
            disabled={!canGenerate}
            onClick={handleGenerate}
          />

          {/* Result */}
          {job && (
            <ResultDisplay
              status={job.status as JobStatus}
              outputUrl={job.outputUrl}
              errorMsg={job.errorMsg}
              onRetry={handleGenerate}
            />
          )}
        </div>
      </div>
    </section>
  );
}
