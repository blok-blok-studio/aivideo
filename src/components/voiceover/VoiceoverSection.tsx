"use client";

import { useState } from "react";
import { VoiceoverTab } from "@/lib/types";
import { clsx } from "clsx";
import GenerateTab from "./generate/GenerateTab";
import MatchTab from "./match/MatchTab";
import CloneTab from "./clone/CloneTab";

const TABS: { key: VoiceoverTab; label: string }[] = [
  { key: "generate", label: "GENERATE VOICEOVER" },
  { key: "match", label: "MATCH A VOICE" },
  { key: "clone", label: "CLONE A VOICE" },
];

export default function VoiceoverSection() {
  const [activeTab, setActiveTab] = useState<VoiceoverTab>("generate");

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Voiceover & Voice Matching
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Generate voiceovers, match voice profiles, or clone any voice with AI.
        </p>
      </div>

      {/* Sub-Tabs */}
      <div className="mb-8 flex gap-1 rounded-card bg-bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "flex-1 rounded-input px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all",
              activeTab === tab.key
                ? "bg-bg-input text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "generate" && <GenerateTab />}
      {activeTab === "match" && <MatchTab />}
      {activeTab === "clone" && <CloneTab />}
    </section>
  );
}
