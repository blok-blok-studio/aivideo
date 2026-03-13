import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * fal.ai webhook endpoint — receives job results directly from fal.ai.
 *
 * This is critical for models like pixverse/swap where the standard
 * result-fetching endpoint (GET response_url) is broken due to nested
 * model path routing issues on fal.ai's platform.
 *
 * fal.ai POSTs the result here when the job completes, bypassing the
 * broken result endpoint entirely.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = body.request_id as string | undefined;

    console.log(`[fal-webhook] Received webhook. request_id=${requestId || "MISSING"}`);
    console.log(`[fal-webhook] Body keys: ${Object.keys(body).join(", ")}`);
    console.log(`[fal-webhook] Status: ${body.status || "N/A"}`);

    if (!requestId) {
      console.error("[fal-webhook] No request_id in webhook payload");
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
    }

    // Find the job by fal request ID
    const job = await prisma.job.findFirst({
      where: { falRequestId: requestId },
    });

    if (!job) {
      console.warn(`[fal-webhook] No job found for request_id=${requestId}`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    console.log(`[fal-webhook] Found job ${job.id} (status=${job.status})`);

    // Check for errors in the payload
    const error = body.error as string | undefined;
    const payload = body.payload || body;

    if (error || body.status === "FAILED") {
      console.error(`[fal-webhook] Job ${job.id} failed:`, error || "Unknown error");
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: error || "Generation failed on fal.ai",
        },
      });
      return NextResponse.json({ ok: true });
    }

    // Extract video URL from result
    // Pixverse swap returns: { video: { url: "..." } }
    const video = (payload.video || body.video) as { url?: string } | undefined;
    const outputUrl =
      video?.url ||
      (payload.output as { url?: string })?.url ||
      (body.output as { url?: string })?.url;

    console.log(`[fal-webhook] Job ${job.id} output URL: ${outputUrl?.slice(0, 100) || "NOT FOUND"}`);
    console.log(`[fal-webhook] Payload keys: ${Object.keys(payload).join(", ")}`);

    if (outputUrl) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "complete",
          outputUrl,
        },
      });
      console.log(`[fal-webhook] Job ${job.id} marked complete with output`);
    } else {
      // Log full payload for debugging
      console.error(`[fal-webhook] No output URL found. Full payload: ${JSON.stringify(body).slice(0, 1000)}`);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: "Webhook received but no output URL in result",
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[fal-webhook] Error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
