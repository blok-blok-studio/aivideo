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
        section: "character-swap",
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
    // Use a webhook so fal.ai POSTs the result directly to our server.
    // The standard result-fetching endpoint is broken for pixverse/swap
    // (nested model path causes the GET to re-run validation instead of
    // returning stored results).
    // Use the stable production URL (not deployment-specific URL which changes per deploy)
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${host}/api/fal/webhook`;

    console.log(`[character-swap] STEP 1: Submitting job ${job.id} to fal.ai model=${model_id}`);
    console.log(`[character-swap] STEP 1: video_url=${video_url.slice(0, 80)} image_url=${image_url.slice(0, 80)}`);
    console.log(`[character-swap] STEP 1: webhookUrl=${webhookUrl}`);
    try {
      const { request_id, response_url, status_url } = await submitFalJob(
        model_id,
        { video_url, image_url },
        { webhookUrl }
      );

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
            _statusUrl: status_url || null,
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
