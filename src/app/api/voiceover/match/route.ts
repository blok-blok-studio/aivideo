import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_VOICES } from "@/lib/types";
import { safeError } from "@/lib/api-helpers";
import { submitFalJob, getFalResult } from "@/lib/fal";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("reference") as File | null;
    const referenceUrl = formData.get("reference_url") as string | null;

    let audioUrl = referenceUrl;

    // If a file was uploaded, upload it to fal.ai storage first
    if (file && !audioUrl) {
      const { falClient } = await import("@/lib/fal-client");
      audioUrl = await falClient.storage.upload(file);
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Reference audio or video is required" },
        { status: 400 }
      );
    }

    // Use Whisper to analyze the audio characteristics
    let analysis;
    try {
      const { request_id } = await submitFalJob("fal-ai/whisper", {
        audio_url: audioUrl,
        task: "transcribe",
        language: "en",
      });

      // Wait briefly for result (whisper is fast for short clips)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const { data } = await getFalResult("fal-ai/whisper", request_id);
      const whisperResult = data as Record<string, unknown>;

      // Estimate voice characteristics from transcription
      const text = (whisperResult.text as string) || "";
      const wordCount = text.split(/\s+/).length;
      const durationEstimate = (whisperResult.chunks as unknown[])?.length
        ? ((whisperResult.chunks as { timestamp: [number, number] }[]).at(-1)
            ?.timestamp[1] || 10)
        : 10;
      const pace = Math.round((wordCount / durationEstimate) * 60);

      analysis = {
        transcribedText: text.slice(0, 200),
        pace, // words per minute
        energy: pace > 160 ? "High" : pace > 120 ? "Medium" : "Low",
        estimatedDuration: Math.round(durationEstimate),
      };
    } catch {
      // If analysis fails, provide basic matching
      analysis = {
        transcribedText: "",
        pace: 140,
        energy: "Medium",
        estimatedDuration: 0,
      };
    }

    // Score default voices based on analysis
    const matches = DEFAULT_VOICES.map((voice) => {
      let score = 70; // base score

      // Boost based on energy match
      if (analysis.energy === "High" && voice.tone?.includes("Energetic")) score += 15;
      if (analysis.energy === "Medium" && voice.tone?.includes("Warm")) score += 10;
      if (analysis.energy === "Low" && voice.tone?.includes("Calm")) score += 15;

      // Add some variety
      score += Math.random() * 10;

      return {
        voice,
        score: Math.min(Math.round(score), 99),
        matchReasons: [
          analysis.energy === "High" ? "Energy match" : "Tone compatibility",
          `${analysis.pace} WPM detected`,
        ],
      };
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({ analysis, matches });
  } catch (err) {
    return safeError(err, "Voice match error");
  }
}
