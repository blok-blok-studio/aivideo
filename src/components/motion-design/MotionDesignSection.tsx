"use client";

import { useState, useMemo } from "react";
import FileUploadZone from "@/components/shared/FileUploadZone";
import GenerateButton from "@/components/shared/GenerateButton";
import ResultDisplay from "@/components/shared/ResultDisplay";
import {
  MOTION_DESIGN_MODELS,
  MotionDesignModel,
  GenerationMode,
  estimateMotionDesignCost,
  JobStatus,
} from "@/lib/types";
import { clsx } from "clsx";
import { useJobPolling, useFileUpload } from "@/hooks/useJobPolling";

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "21:9"];
const DURATIONS = ["5s", "8s", "10s", "15s", "20s", "25s"];
const RESOLUTIONS = ["720p", "1080p", "2K", "4K"];

const ROTATING_PLACEHOLDERS = [
  "Product reveal. White iPhone floating in dark void. Cinematic macro lens. Slow 360 rotation. Studio lighting with soft rim. Apple aesthetic.",
  "Brand ad. Athletic shoes on concrete. Slow motion water splash. Golden hour. Tracking shot. Nike energy.",
  "Motion graphic. Minimal logo animation. Clean white background. Smooth easing. 3 second loop.",
];

export default function MotionDesignSection() {
  // Mode
  const [mode, setMode] = useState<GenerationMode>("t2v");

  // Inputs
  const [prompt, setPrompt] = useState("");
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [refVideoPreview, setRefVideoPreview] = useState<string | null>(null);

  // Settings
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("10s");
  const [resolution, setResolution] = useState("1080p");
  const [nativeAudio, setNativeAudio] = useState(true);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfgScale, setCfgScale] = useState(0.5);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");

  // Model
  const [selectedModel, setSelectedModel] = useState<MotionDesignModel>(
    MOTION_DESIGN_MODELS[0]
  );

  // Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { job } = useJobPolling(jobId);
  const { upload } = useFileUpload();

  const durationSec = parseInt(duration);
  const estimatedCost = useMemo(
    () => estimateMotionDesignCost(durationSec, selectedModel.costPerSec),
    [durationSec, selectedModel]
  );

  const [placeholderIdx] = useState(
    Math.floor(Math.random() * ROTATING_PLACEHOLDERS.length)
  );

  const canGenerate =
    prompt.length > 0 &&
    (mode === "t2v" || refImages.length > 0 || refVideo) &&
    !loading;

  const handleGenerate = async () => {
    setLoading(true);
    setJobId(null);
    try {
      const modelId =
        mode === "t2v"
          ? selectedModel.modelIds.t2v
          : mode === "i2v"
            ? selectedModel.modelIds.i2v
            : (selectedModel.modelIds.v2v || selectedModel.modelIds.i2v);

      let imageUrl: string | undefined;
      let videoUrl: string | undefined;

      if (mode === "i2v" && refImages[0]) {
        imageUrl = await upload(refImages[0].file);
      }
      if (mode === "v2v" && refVideo) {
        videoUrl = await upload(refVideo);
      }

      const res = await fetch("/api/generate/motion-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: modelId,
          mode,
          prompt,
          image_url: imageUrl,
          video_url: videoUrl,
          aspect_ratio: aspectRatio,
          duration,
          resolution,
          audio: nativeAudio,
          negative_prompt: negativePrompt || undefined,
          cfg_scale: cfgScale,
          seed: seed ? parseInt(seed) : undefined,
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
    <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 md:mb-8">
        <h2 className="font-display text-xl font-bold text-text-primary md:text-2xl">
          Motion Design & Ads
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Create brand videos, product renders, cinematic ads, and motion graphics.
        </p>
      </div>

      {/* Input Panel */}
      <div className="space-y-5 rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:space-y-6 md:p-6">
        {/* Mode Tabs */}
        <div className="flex gap-1 rounded-card bg-bg-input p-1">
          {(
            [
              { key: "t2v", label: "TEXT → VIDEO" },
              { key: "i2v", label: "IMAGE → VIDEO" },
              { key: "v2v", label: "VIDEO → VIDEO" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={clsx(
                "flex-1 rounded-input px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all",
                mode === m.key
                  ? "bg-bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              DESCRIBE YOUR VISION
            </label>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <span>AUTO-ENHANCE PROMPT</span>
              <button
                onClick={() => setAutoEnhance(!autoEnhance)}
                className={clsx(
                  "relative h-5 w-9 rounded-full transition-colors",
                  autoEnhance ? "bg-accent" : "bg-bg-input"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    autoEnhance ? "left-[18px]" : "left-0.5"
                  )}
                />
              </button>
            </label>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={ROTATING_PLACEHOLDERS[placeholderIdx]}
            rows={4}
            className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>

        {/* Reference uploads */}
        {(mode === "i2v" || mode === "v2v") && (
          <div className="grid gap-4 md:grid-cols-2">
            {mode === "i2v" && (
              <FileUploadZone
                label="REFERENCE IMAGE"
                accept=".jpg,.png,.webp"
                maxSizeMB={10}
                preview={refImages[0]?.preview}
                onFile={(file) => {
                  const preview = URL.createObjectURL(file);
                  setRefImages([{ file, preview }]);
                }}
                onClear={() => setRefImages([])}
              />
            )}
            {mode === "v2v" && (
              <FileUploadZone
                label="SOURCE VIDEO"
                accept=".mp4,.mov,.webm"
                maxSizeMB={100}
                preview={refVideoPreview}
                previewType="video"
                onFile={(file) => {
                  setRefVideo(file);
                  setRefVideoPreview(URL.createObjectURL(file));
                }}
                onClear={() => {
                  setRefVideo(null);
                  setRefVideoPreview(null);
                }}
              />
            )}
          </div>
        )}

        {/* Settings Row */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {/* Aspect Ratio */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              ASPECT RATIO
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              DURATION
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              RESOLUTION
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Native Audio */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              NATIVE AUDIO
            </label>
            <button
              onClick={() => setNativeAudio(!nativeAudio)}
              className={clsx(
                "block rounded-input px-3 py-2 text-xs font-medium transition-colors",
                nativeAudio
                  ? "bg-accent/10 text-accent"
                  : "bg-bg-input text-text-secondary"
              )}
            >
              {nativeAudio ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Advanced Settings */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={clsx(
                "transition-transform",
                showAdvanced && "rotate-90"
              )}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4 rounded-input bg-bg-input p-4">
              {/* CFG Scale */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                    CFG SCALE
                  </label>
                  <span className="font-mono text-[10px] text-text-secondary">
                    {cfgScale.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                />
              </div>

              {/* Negative Prompt */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                  NEGATIVE PROMPT
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Describe what you want to avoid..."
                  rows={2}
                  className="w-full rounded-input border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none"
                />
              </div>

              {/* Seed */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                  SEED (optional)
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Random"
                  className="w-full rounded-input border border-border-subtle bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Grid */}
      <div className="mt-6 md:mt-8">
        <div className="mb-4">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            SELECT GENERATION MODEL
          </label>
          <p className="mt-1 text-xs text-text-muted">
            Each model excels at something different. Pick based on your output goal.
          </p>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {MOTION_DESIGN_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model)}
              className={clsx(
                "rounded-card border p-3 md:p-4 text-left transition-all shadow-card hover:shadow-card-hover",
                selectedModel.id === model.id
                  ? "border-accent bg-accent/5 shadow-glow"
                  : "border-border-subtle bg-bg-surface hover:border-border-hover"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={clsx(
                    "rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                    selectedModel.id === model.id
                      ? "bg-accent/20 text-accent"
                      : "bg-bg-input text-text-secondary"
                  )}
                >
                  {model.badge}
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {model.name}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Best for: {model.bestFor}
              </p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-text-muted">
                <span>Audio: {model.audio ? "✓" : "✗"}</span>
                <span>
                  Max: {model.maxResolution} · {model.maxDuration}
                </span>
              </div>
              <div className="mt-1 text-right font-mono text-[11px] text-text-muted">
                {model.costPerSec > 0
                  ? `$${model.costPerSec.toFixed(2)}/s`
                  : "Infra cost only"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cost + Generate */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-card bg-bg-surface px-4 py-3">
          <span className="text-xs text-text-secondary">Estimated cost</span>
          <span className="font-mono text-sm font-medium text-text-primary">
            ~${estimatedCost.toFixed(2)}
          </span>
        </div>

        <GenerateButton
          label="GENERATE"
          loading={loading || (!!jobId && job?.status === "processing")}
          loadingLabel="Generating..."
          disabled={!canGenerate}
          onClick={handleGenerate}
          estimatedTime="~45–90 seconds"
        />

        {job && (
          <ResultDisplay
            status={job.status as JobStatus}
            outputUrl={job.outputUrl}
            errorMsg={job.errorMsg}
            onRetry={handleGenerate}
          />
        )}
      </div>
    </section>
  );
}
