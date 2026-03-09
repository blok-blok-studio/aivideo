"use client";

import Image from "next/image";
import { Section } from "@/lib/types";
import TabNav from "./TabNav";

interface HeaderProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onOpenHistory: () => void;
  balance?: number | null;
}

export default function Header({
  activeSection,
  onSectionChange,
  onOpenHistory,
  balance,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg/80 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/logo-hero.png"
            alt="Blok Blok Studio"
            width={200}
            height={30}
            className="h-6 w-auto md:h-7"
          />
        </div>

        {/* Tab Nav — hidden on mobile */}
        <div className="hidden lg:block">
          <TabNav active={activeSection} onChange={onSectionChange} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 md:gap-4">
          {balance !== null && balance !== undefined && (
            <span className="hidden font-mono text-xs text-text-secondary sm:inline">
              ${balance.toFixed(2)}
            </span>
          )}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-input border border-border-subtle px-3 py-2 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="hidden sm:inline">History</span>
          </button>
        </div>

        {/* Mobile/Tablet select */}
        <div className="lg:hidden">
          <select
            value={activeSection}
            onChange={(e) => onSectionChange(e.target.value as Section)}
            className="rounded-input border border-border-subtle bg-bg-input px-3 py-2 text-sm text-text-primary"
          >
            <option value="motion-tracking">Motion Tracking</option>
            <option value="motion-design">Motion Design & Ads</option>
            <option value="voiceover">Voiceover</option>
          </select>
        </div>
      </div>
    </header>
  );
}
