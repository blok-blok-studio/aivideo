import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { voiceoverMergeSchema } from "@/lib/validation";
import { submitFalJob } from "@/lib/fal";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(voiceoverMergeSchema, body);
    if (!result.success) return result.response;

    const { audio_url, video_job_id } = result.data;

    // Fetch the video job to get the output URL
    const videoJob = await prisma.job.findUnique({
      where: { id: video_job_id },
      select: { outputUrl: true, status: true },
    });

    if (!videoJob || videoJob.status !== "complete" || !videoJob.outputUrl) {
      return NextResponse.json(
        { error: "Video job not found or not complete" },
        { status: 400 }
      );
    }

    // Use fal.ai's video-retalking or audio overlay model
    // This submits to a video+audio merge pipeline
    try {
      const { request_id } = await submitFalJob("fal-ai/video-retalking", {
        video_url: videoJob.outputUrl,
        audio_url: audio_url,
      });

      return NextResponse.json({
        requestId: request_id,
        status: "processing",
        message: "Audio/video merge started. Poll the request for results.",
      });
    } catch {
      // If fal.ai merge model is unavailable, return instructions
      return NextResponse.json({
        videoUrl: videoJob.outputUrl,
        audioUrl: audio_url,
        status: "manual",
        message:
          "Automated merge unavailable. Download both files and merge using your preferred video editor.",
      });
    }
  } catch (err) {
    return safeError(err, "Merge error");
  }
}
