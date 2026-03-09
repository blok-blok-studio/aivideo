"use client";

import { useState } from "react";
import { DEFAULT_VOICES, Voice } from "@/lib/types";
import GenerateButton from "@/components/shared/GenerateButton";
import { clsx } from "clsx";

export default function GenerateTab() {
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [pace, setPace] = useState("Normal");
  const [emotion, setEmotion] = useState("Neutral");
  const [outputMode, setOutputMode] = useState<"audio" | "merge">("audio");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Filters
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [accentFilter, setAccentFilter] = useState<string>("all");

  const filteredVoices = DEFAULT_VOICES.filter((v) => {
    if (genderFilter !== "all" && v.gender !== genderFilter) return false;
    if (accentFilter !== "all" && v.accent !== accentFilter) return false;
    return true;
  });

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const estReadTime = Math.round((wordCount / 150) * 60); // ~150 WPM

  const handleGenerate = async () => {
    if (!script || !selectedVoice) return;
    setLoading(true);
    setAudioUrl(null);

    try {
      const res = await fetch("/api/voiceover/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voice_id: selectedVoice.id,
          stability,
          similarity_boost: similarity,
          pace,
          emotion,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate voiceover");
      const data = await res.json();
      setAudioUrl(data.audioUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Script Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            YOUR SCRIPT
          </label>
          <div className="flex gap-3 font-mono text-[10px] text-text-muted">
            <span>{script.length}/5000</span>
            <span>{wordCount} words</span>
            <span>~{estReadTime}s at medium pace</span>
          </div>
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, 5000))}
          placeholder="Write your voiceover copy here. Punctuation affects pacing — use commas for brief pauses, ellipses for longer ones."
          rows={6}
          className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </div>

      {/* Voice Browser */}
      <div className="space-y-3">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          SELECT VOICE
        </label>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="rounded-input border border-border-subtle bg-bg-input px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            <option value="all">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Neutral">Neutral</option>
          </select>
          <select
            value={accentFilter}
            onChange={(e) => setAccentFilter(e.target.value)}
            className="rounded-input border border-border-subtle bg-bg-input px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            <option value="all">All Accents</option>
            <option value="American">American</option>
            <option value="British">British</option>
          </select>
        </div>

        {/* Voice Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVoices.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice)}
              className={clsx(
                "rounded-card border p-3 text-left transition-all",
                selectedVoice?.id === voice.id
                  ? "border-accent bg-accent/5"
                  : "border-border-subtle bg-bg-surface hover:border-border-hover"
              )}
            >
              <div className="text-sm font-medium text-text-primary">
                {voice.name}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded-sm bg-bg-input px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                  {voice.gender}
                </span>
                <span className="rounded-sm bg-bg-input px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                  {voice.accent}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-text-secondary">
                {voice.tone}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Settings */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
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

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              SPEAKING PACE
            </label>
            <select
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              className="w-full rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {["Slow", "Normal", "Fast"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
              EMOTION
            </label>
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              className="w-full rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-xs text-text-primary focus:outline-none"
            >
              {["Neutral", "Excited", "Serious", "Warm", "Dramatic"].map(
                (e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Output Format */}
      <div className="space-y-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          OUTPUT FORMAT
        </label>
        <div className="flex gap-2">
          {(["audio", "merge"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setOutputMode(mode)}
              className={clsx(
                "rounded-input px-4 py-2 text-xs font-medium uppercase transition-all",
                outputMode === mode
                  ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                  : "bg-bg-input text-text-secondary hover:text-text-primary"
              )}
            >
              {mode === "audio" ? "AUDIO ONLY" : "MERGE WITH VIDEO"}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <GenerateButton
        label="GENERATE VOICEOVER"
        loading={loading}
        loadingLabel="Generating..."
        disabled={!script || !selectedVoice}
        onClick={handleGenerate}
      />

      {/* Audio Output */}
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
