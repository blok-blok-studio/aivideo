import { NextRequest, NextResponse } from "next/server";
import { submitFalJob } from "@/lib/fal";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { characterSwapSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(characterSwapSchema, body);
    if (!result.success) return result.response;

    const { video_url, image_url, model_id } = result.data;

    // Create job record
    const job = await prisma.job.create({
      data: {
        section: "motion-tracking",
        modelId: model_id,
        modelName: "Pixverse Swap",
        status: "queued",
        inputParams: {
          video_url,
          image_url,
        },
      },
    });

    // Submit to fal.ai — Pixverse Swap expects video + swap image
    console.log(`[character-swap] STEP 1: Submitting job ${job.id} to fal.ai model=${model_id}`);
    console.log(`[character-swap] STEP 1: video_url=${video_url.slice(0, 80)} image_url=${image_url.slice(0, 80)}`);
    try {
      const { request_id, response_url, status_url } = await submitFalJob(model_id, {
        video_url,
        image_url,
      });

      console.log(`[character-swap] STEP 2: Submission succeeded. request_id=${request_id}`);
      console.log(`[character-swap] STEP 2: response_url=${response_url?.slice(0, 120)}`);
      console.log(`[character-swap] STEP 2: status_url=${status_url?.slice(0, 120)}`);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "processing",
          falRequestId: request_id,
          falResponseUrl: response_url || null,
          // Store status_url in inputParams since there's no dedicated column
          inputParams: {
            video_url,
            image_url,
            _statusUrl: status_url || undefined,
          },
        },
      });

      console.log(`[character-swap] STEP 3: DB updated. job=${job.id} status=processing _statusUrl=${status_url ? "SET" : "MISSING"}`);
    } catch (falErr) {
      const errMsg = falErr instanceof Error ? falErr.message : "fal.ai submission failed";
      console.error(`[character-swap] Submission failed for job ${job.id}:`, errMsg);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: errMsg,
        },
      });
      // Return error so frontend doesn't start polling a failed job
      return NextResponse.json(
        { error: `Submission failed: ${errMsg}`, jobId: job.id },
        { status: 502 }
      );
    }

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return safeError(err, "Character swap error");
  }
}
