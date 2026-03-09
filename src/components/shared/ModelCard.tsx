"use client";

import { clsx } from "clsx";

interface ModelCardProps {
  name: string;
  badge: string;
  description: string;
  cost: string;
  selected: boolean;
  onClick: () => void;
  extra?: React.ReactNode;
}

export default function ModelCard({
  name,
  badge,
  description,
  cost,
  selected,
  onClick,
  extra,
}: ModelCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full rounded-card border p-4 text-left transition-all",
        selected
          ? "border-accent bg-accent/5"
          : "border-border-subtle bg-bg-surface hover:border-border-hover"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                selected
                  ? "bg-accent/20 text-accent"
                  : "bg-bg-input text-text-secondary"
              )}
            >
              {badge}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {name}
            </span>
          </div>
          <p className="text-xs text-text-secondary">{description}</p>
          {extra}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-text-muted">
          {cost}
        </span>
      </div>
    </button>
  );
}
