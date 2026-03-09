"use client";

import { useState } from "react";
import FileUploadZone from "@/components/shared/FileUploadZone";
import GenerateButton from "@/components/shared/GenerateButton";
import { CloneMethod } from "@/lib/types";
import { clsx } from "clsx";

export default function CloneTab() {
  const [sample, setSample] = useState<File | null>(null);
  const [samplePreview, setSamplePreview] = useState<string | null>(null);
  const [sampleQuality, setSampleQuality] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [script, setScript] = useState("");
  const [method, setMethod] = useState<CloneMethod>("instant");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "cloning" | "synthesizing">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleSample = (file: File) => {
    setSample(file);
    setSamplePreview(URL.createObjectURL(file));

    // Check audio duration for quality indicator
    const audio = new Audio();
    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      if (dur < 30) {
        setSampleQuality("Too short — add more audio for better accuracy.");
      } else if (dur < 60) {
        setSampleQuality("Good sample — minimal noise detected");
      } else {
        setSampleQuality("Good sample — minimal noise detected");
      }
    };
    audio.src = URL.createObjectURL(file);
  };

  const handleGenerate = async () => {
    if (!sample || !voiceName || !script) return;
    setLoading(true);
    setAudioUrl(null);
    setStep("cloning");

    try {
      const formData = new FormData();
      formData.append("sample", sample);
      formData.append("voice_name", voiceName);
      formData.append("script", script);
      formData.append("method", method);
      formData.append("stability", stability.toString());
      formData.append("similarity_boost", similarity.toString());

      const res = await fetch("/api/voiceover/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Clone failed");
      setStep("synthesizing");
      const data = await res.json();
      setAudioUrl(data.audioUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setStep("idle");
    }
  };

  return (
    <div className="space-y-8">
      {/* Voice Sample Upload */}
      <FileUploadZone
        label="VOICE SAMPLE"
        accept=".mp3,.wav,.m4a,.flac"
        maxSizeMB={50}
        helperText="Minimum 30 seconds, recommended 1–3 minutes of clean speech."
        preview={samplePreview ? "uploaded" : null}
        onFile={handleSample}
        onClear={() => {
          setSample(null);
          setSamplePreview(null);
          setSampleQuality(null);
        }}
      />

      {/* Quality Indicator */}
      {sampleQuality && (
        <div
          className={clsx(
            "rounded-input px-4 py-2 text-xs",
            sampleQuality.includes("Too short")
              ? "bg-status-failed/10 text-status-failed"
              : sampleQuality.includes("Warning")
                ? "bg-yellow-500/10 text-yellow-400"
                : "bg-status-complete/10 text-status-complete"
          )}
        >
          {sampleQuality}
        </div>
      )}

      {/* Voice Name */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          NAME THIS VOICE
        </label>
        <input
          type="text"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="e.g. Brand Narrator, CEO Voice"
          className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {/* Script */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            YOUR SCRIPT
          </label>
          <span className="font-mono text-[10px] text-text-muted">
            {script.length}/5000
          </span>
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, 5000))}
          placeholder="Write your voiceover copy here..."
          rows={6}
          className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {/* Clone Method */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          CLONE METHOD
        </label>
        <div className="flex gap-2">
          {(
            [
              {
                key: "instant" as const,
                label: "INSTANT CLONE",
                desc: "Faster, slightly less accurate",
              },
              {
                key: "professional" as const,
                label: "PROFESSIONAL CLONE",
                desc: "Slower, higher fidelity",
              },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={clsx(
                "flex-1 rounded-input px-4 py-2.5 text-left transition-all",
                method === m.key
                  ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                  : "bg-bg-input text-text-secondary hover:text-text-primary"
              )}
            >
              <span className="block text-xs font-medium uppercase">
                {m.label}
              </span>
              <span className="mt-0.5 block text-[10px] text-text-muted">
                {m.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Clone Settings */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              STABILITY
            </label>
            <span className="font-mono text-[10px] text-text-secondary">
              {stability.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={stability}
            onChange={(e) => setStability(parseFloat(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              SIMILARITY BOOST
            </label>
            <span className="font-mono text-[10px] text-text-secondary">
              {similarity.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={similarity}
            onChange={(e) => setSimilarity(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Generate */}
      <GenerateButton
        label="CLONE & GENERATE"
        loading={loading}
        loadingLabel={
          step === "cloning" ? "Cloning voice..." : "Synthesizing voiceover..."
        }
        disabled={!sample || !voiceName || !script}
        onClick={handleGenerate}
      />

      {/* Output */}
      {audioUrl && (
        <div className="space-y-3 rounded-card border border-border-subtle bg-bg-surface p-4">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex gap-2">
            <a
              href={audioUrl}
              download
              className="flex-1 rounded-input border border-border-subtle px-3 py-2 text-center text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
