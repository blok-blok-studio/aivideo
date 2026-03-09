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
          "w-full rounded-card px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-wider transition-all",
          disabled || loading
            ? "cursor-not-allowed bg-bg-input text-text-muted"
            : "bg-accent text-white shadow-glow hover:bg-accent-hover hover:shadow-[0_0_30px_rgba(255,107,53,0.25)] active:scale-[0.98]"
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
