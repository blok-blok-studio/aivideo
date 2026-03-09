"use client";

import { useState } from "react";
import { Section } from "@/lib/types";
import Header from "@/components/layout/Header";
import MotionTrackingSection from "@/components/motion-tracking/MotionTrackingSection";
import MotionDesignSection from "@/components/motion-design/MotionDesignSection";
import VoiceoverSection from "@/components/voiceover/VoiceoverSection";
import HistoryDrawer from "@/components/history/HistoryDrawer";
import { useBalance } from "@/hooks/useJobPolling";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("motion-tracking");
  const [historyOpen, setHistoryOpen] = useState(false);
  const balance = useBalance();

  return (
    <div className="min-h-screen">
      <Header
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onOpenHistory={() => setHistoryOpen(true)}
        balance={balance}
      />

      <main>
        {activeSection === "motion-tracking" && <MotionTrackingSection />}
        {activeSection === "motion-design" && <MotionDesignSection />}
        {activeSection === "voiceover" && <VoiceoverSection />}
      </main>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
