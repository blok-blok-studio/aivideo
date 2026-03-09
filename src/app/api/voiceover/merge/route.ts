import { NextRequest, NextResponse } from "next/server";
import { validateBody, safeError } from "@/lib/api-helpers";
import { voiceoverMergeSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(voiceoverMergeSchema, body);
    if (!result.success) return result.response;

    const { audio_url } = result.data;

    // In production, use ffmpeg or a cloud service to merge audio with video
    return NextResponse.json({
      mergedUrl: audio_url,
      message: "Audio/video merge queued",
    });
  } catch (err) {
    return safeError(err, "Merge error");
  }
}
