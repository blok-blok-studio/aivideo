import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/api-keys";
import { submitFalJob } from "@/lib/fal";
import { safeError, validateBody } from "@/lib/api-helpers";
import { logUsage } from "@/lib/usage";
import { z } from "zod";

const generateSchema = z.object({
  model_id: z.string(),
  prompt: z.string().min(1).max(5000),
  image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  aspect_ratio: z.string().optional(),
  duration: z.string().optional(),
  resolution: z.string().optional(),
});

/** POST /api/v1/generate — Submit a generation job via public API */
export async function POST(req: NextRequest) {
  try {
    const userId = await validateApiKey(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = validateBody(generateSchema, body);
    if (!result.success) return result.response;

    const { model_id, prompt, image_url, video_url, aspect_ratio, duration, resolution } =
      result.data;

    // Submit to fal.ai
    const { request_id } = await submitFalJob(model_id, {
      prompt,
      image_url,
      video_url,
      aspect_ratio,
      duration,
      resolution,
    });

    // Create job record
    const job = await prisma.job.create({
      data: {
        section: "motion-design",
        modelId: model_id,
        modelName: model_id.split("/").pop() || model_id,
        status: "queued",
        falRequestId: request_id,
        inputParams: body,
        userId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    logUsage({
      userId,
      action: "generation",
      section: "motion-design",
      modelId: model_id,
      modelName: model_id,
      status: "success",
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
        message: "Job submitted. Poll GET /api/v1/jobs to check status.",
      },
      { status: 202 }
    );
  } catch (err) {
    return safeError(err, "API v1 generate error");
  }
}
