import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError, validateBody } from "@/lib/api-helpers";
import { submitFalJob } from "@/lib/fal";
import { z } from "zod";

const captionSchema = z.object({
  videoUrl: z.string().url(),
  language: z.string().max(10).default("en"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(captionSchema, body);
    if (!result.success) return result.response;

    const { videoUrl, language } = result.data;

    // Submit to fal.ai Whisper for transcription
    const { request_id } = await submitFalJob("fal-ai/whisper", {
      audio_url: videoUrl,
      task: "transcribe",
      language,
      chunk_level: "segment",
    });

    return NextResponse.json({
      requestId: request_id,
      status: "processing",
      message: "Caption generation started",
    });
  } catch (err) {
    return safeError(err, "Caption generation error");
  }
}
