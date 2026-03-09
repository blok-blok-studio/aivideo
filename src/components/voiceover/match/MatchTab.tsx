"use client";

import { useState } from "react";
import FileUploadZone from "@/components/shared/FileUploadZone";
import GenerateButton from "@/components/shared/GenerateButton";
import { Voice } from "@/lib/types";
import { clsx } from "clsx";

interface MatchResult {
  voice: Voice;
  score: number;
  overlapTags: string[];
}

export default function MatchTab() {
  const [reference, setReference] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    gender: string;
    accent: string;
    confidence: number;
    tone: string[];
    pace: number;
    energy: string;
  } | null>(null);
  const [matchedVoices, setMatchedVoices] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Voice | null>(null);
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setReference(file);
    setReferencePreview(URL.createObjectURL(file));
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/voiceover/match", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysis(data.analysis);
      setMatchedVoices(data.matches);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedMatch || !script) return;
    setLoading(true);
    setAudioUrl(null);

    try {
      const res = await fetch("/api/voiceover/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voice_id: selectedMatch.id,
          stability: 0.5,
          similarity_boost: 0.75,
          pace: "Normal",
          emotion: "Neutral",
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
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
      {/* Reference Upload */}
      <FileUploadZone
        label="UPLOAD REFERENCE"
        accept=".mp4,.mov,.mp3,.wav,.m4a"
        maxSizeMB={50}
        helperText="Upload the video or audio you want to match. Could be a competitor ad, a reference clip, or your completed video output."
        preview={referencePreview}
        previewType={reference?.type.startsWith("video") ? "video" : "image"}
        onFile={handleUpload}
        onClear={() => {
          setReference(null);
          setReferencePreview(null);
          setAnalysis(null);
          setMatchedVoices([]);
        }}
      />

      {/* Analyzing state */}
      {analyzing && (
        <div className="flex items-center gap-3 rounded-card border border-border-subtle bg-bg-surface p-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Analyzing voice profile...</span>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4 rounded-card border border-border-subtle bg-bg-surface p-4">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            EXTRACTED PROFILE
          </h3>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-sm bg-bg-input px-2 py-1 font-mono text-[10px] text-text-primary">
              {analysis.gender}
            </span>
            <span className="rounded-sm bg-bg-input px-2 py-1 font-mono text-[10px] text-text-primary">
              {analysis.accent} ({analysis.confidence}%)
            </span>
            {analysis.tone.map((t) => (
              <span
                key={t}
                className="rounded-sm bg-bg-input px-2 py-1 font-mono text-[10px] text-text-secondary"
              >
                {t}
              </span>
            ))}
            <span className="rounded-sm bg-bg-input px-2 py-1 font-mono text-[10px] text-text-secondary">
              {analysis.pace} WPM
            </span>
            <span className="rounded-sm bg-bg-input px-2 py-1 font-mono text-[10px] text-text-secondary">
              Energy: {analysis.energy}
            </span>
          </div>
        </div>
      )}

      {/* Matched Voices */}
      {matchedVoices.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            TOP MATCHING VOICES
          </h3>
          <div className="space-y-2">
            {matchedVoices.map((match, i) => (
              <button
                key={match.voice.id}
                onClick={() => setSelectedMatch(match.voice)}
                className={clsx(
                  "flex w-full items-center gap-4 rounded-card border p-3 text-left transition-all",
                  selectedMatch?.id === match.voice.id
                    ? "border-accent bg-accent/5"
                    : "border-border-subtle bg-bg-surface hover:border-border-hover"
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-input font-mono text-xs text-text-muted">
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {match.voice.name}
                    </span>
                    <span className="font-mono text-[10px] text-accent">
                      {match.score}% match
                    </span>
                  </div>
                  <div className="mt-0.5 flex gap-1">
                    {match.overlapTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-sm bg-bg-input px-1.5 py-0.5 font-mono text-[9px] text-text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Script + Generate */}
      {selectedMatch && (
        <>
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              YOUR SCRIPT
            </label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value.slice(0, 5000))}
              placeholder="Write your voiceover copy here..."
              rows={4}
              className="w-full rounded-input border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>

          <GenerateButton
            label="GENERATE VOICEOVER"
            loading={loading}
            disabled={!script}
            onClick={handleGenerate}
          />
        </>
      )}

      {audioUrl && (
        <div className="rounded-card border border-border-subtle bg-bg-surface p-4">
          <audio src={audioUrl} controls className="w-full" />
          <a
            href={audioUrl}
            download
            className="mt-2 inline-block rounded-input border border-border-subtle px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}
