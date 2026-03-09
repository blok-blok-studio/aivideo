"use client";

import { clsx } from "clsx";

interface GenerateButtonProps {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  onClick: () => void;
  estimatedTime?: string;
}

export default function GenerateButton({
  label,
  loading = false,
  loadingLabel = "Generating...",
  disabled = false,
  onClick,
  estimatedTime,
}: GenerateButtonProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={clsx(
          "w-full rounded-card px-6 py-3 font-display text-sm font-semibold uppercase tracking-wider transition-all",
          disabled || loading
            ? "cursor-not-allowed bg-bg-input text-text-muted"
            : "bg-accent text-white hover:bg-accent-hover active:scale-[0.99]"
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
            <span className="ml-2">{loadingLabel}</span>
          </span>
        ) : (
          <>
            {label} <span className="ml-1">&rarr;</span>
          </>
        )}
      </button>
      {estimatedTime && (
        <p className="text-center font-mono text-[10px] text-text-muted">
          {estimatedTime}
        </p>
      )}
    </div>
  );
}
