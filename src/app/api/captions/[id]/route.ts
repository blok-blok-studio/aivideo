import { NextRequest, NextResponse } from "next/server";
import { safeError } from "@/lib/api-helpers";
import { getFalResult, getFalStatus } from "@/lib/fal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

    // Check status first
    const status = await getFalStatus("fal-ai/whisper", requestId);

    if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
      return NextResponse.json({
        status: "processing",
        requestId,
      });
    }

    if (status.status === "COMPLETED") {
      const { data } = await getFalResult("fal-ai/whisper", requestId);
      const result = data as Record<string, unknown>;

      // Extract segments for SRT generation
      const chunks = (result.chunks as { timestamp: [number, number]; text: string }[]) || [];

      const segments = chunks.map((chunk, idx) => ({
        index: idx + 1,
        start: chunk.timestamp[0],
        end: chunk.timestamp[1],
        text: chunk.text.trim(),
      }));

      // Generate SRT format
      const srt = segments
        .map((seg) => {
          const startTime = formatSrtTime(seg.start);
          const endTime = formatSrtTime(seg.end);
          return `${seg.index}\n${startTime} --> ${endTime}\n${seg.text}\n`;
        })
        .join("\n");

      // Generate VTT format
      const vtt =
        "WEBVTT\n\n" +
        segments
          .map((seg) => {
            const startTime = formatVttTime(seg.start);
            const endTime = formatVttTime(seg.end);
            return `${startTime} --> ${endTime}\n${seg.text}\n`;
          })
          .join("\n");

      return NextResponse.json({
        status: "complete",
        text: result.text || "",
        segments,
        srt,
        vtt,
      });
    }

    return NextResponse.json({
      status: "failed",
      error: "Transcription failed",
    });
  } catch (err) {
    return safeError(err, "Caption status error");
  }
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return n.toString().padStart(len, "0");
}
