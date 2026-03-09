"use client";

import { Section } from "@/lib/types";
import { clsx } from "clsx";

const TABS: { key: Section; label: string }[] = [
  { key: "motion-tracking", label: "Motion Tracking" },
  { key: "motion-design", label: "Motion Design & Ads" },
  { key: "voiceover", label: "Voiceover" },
];

interface TabNavProps {
  active: Section;
  onChange: (section: Section) => void;
}

export default function TabNav({ active, onChange }: TabNavProps) {
  return (
    <div className="flex items-center gap-1 rounded-card bg-bg-surface p-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            "rounded-input px-4 py-2 text-sm font-medium transition-all",
            active === tab.key
              ? "bg-bg-input text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
