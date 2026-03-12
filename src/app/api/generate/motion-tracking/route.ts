import { NextRequest, NextResponse } from "next/server";
import { submitFalJob } from "@/lib/fal";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { motionTrackingSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(motionTrackingSchema, body);
    if (!result.success) return result.response;

    const { image_url, video_url, model_id, character_orientation, prompt, keep_original_sound } =
      result.data;

    // Create job record
    const job = await prisma.job.create({
      data: {
        section: "motion-tracking",
        modelId: model_id,
        modelName: model_id.split("/").pop() || model_id,
        status: "queued",
        inputParams: {
          image_url,
          video_url,
          character_orientation,
          prompt,
          keep_original_sound,
        },
      },
    });

    // Submit to fal.ai
    try {
      const { request_id, response_url, status_url } = await submitFalJob(model_id, {
        image_url,
        video_url,
        character_orientation,
        prompt,
        keep_original_sound,
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "processing",
          falRequestId: request_id,
          falResponseUrl: response_url || null,
          inputParams: {
            image_url,
            video_url,
            character_orientation,
            prompt,
            keep_original_sound,
            _statusUrl: status_url || undefined,
          },
        },
      });
    } catch (falErr) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: falErr instanceof Error ? falErr.message : "fal.ai submission failed",
        },
      });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return safeError(err, "Motion tracking error");
  }
}
