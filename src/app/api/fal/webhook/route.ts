import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * fal.ai webhook endpoint — receives job results directly from fal.ai.
 *
 * Webhook payload format (from fal.ai docs):
 * {
 *   "request_id": "abc123",
 *   "gateway_request_id": "abc123",
 *   "status": "OK" | "ERROR",
 *   "payload": { ... model output ... }
 * }
 *
 * For pixverse/swap, payload is: { video: { url: "..." } }
 *
 * This is critical for models like pixverse/swap where the standard
 * result-fetching endpoint (GET response_url) is broken due to nested
 * model path routing issues on fal.ai's platform.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = (body.request_id || body.gateway_request_id) as string | undefined;

    console.log(`[fal-webhook] Received webhook`);
    console.log(`[fal-webhook] request_id=${requestId || "MISSING"}`);
    console.log(`[fal-webhook] status=${body.status || "N/A"}`);
    console.log(`[fal-webhook] body keys=${Object.keys(body).join(", ")}`);

    if (!requestId) {
      console.error("[fal-webhook] No request_id in webhook payload");
      // Return 200 anyway to prevent fal.ai from retrying
      return NextResponse.json({ error: "Missing request_id" }, { status: 200 });
    }

    // Find the job by fal request ID
    const job = await prisma.job.findFirst({
      where: { falRequestId: requestId },
    });

    if (!job) {
      // Also try gateway_request_id if request_id didn't match
      const altId = body.gateway_request_id || body.request_id;
      const altJob = altId && altId !== requestId
        ? await prisma.job.findFirst({ where: { falRequestId: altId } })
        : null;

      if (!altJob) {
        console.warn(`[fal-webhook] No job found for request_id=${requestId}`);
        return NextResponse.json({ ok: true }); // 200 to stop retries
      }
    }

    const matchedJob = job || (await prisma.job.findFirst({ where: { falRequestId: body.gateway_request_id } }));
    if (!matchedJob) {
      console.warn(`[fal-webhook] No job found for any ID`);
      return NextResponse.json({ ok: true });
    }

    console.log(`[fal-webhook] Found job ${matchedJob.id} (current status=${matchedJob.status})`);

    // Check for errors — fal.ai uses status: "ERROR" for failures
    if (body.status === "ERROR" || body.status === "FAILED") {
      const errorDetail =
        body.payload?.detail?.[0]?.msg ||
        body.payload?.error ||
        body.error ||
        "Generation failed on fal.ai";

      console.error(`[fal-webhook] Job ${matchedJob.id} FAILED: ${errorDetail}`);
      await prisma.job.update({
        where: { id: matchedJob.id },
        data: {
          status: "failed",
          errorMsg: typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail).slice(0, 500),
        },
      });
      return NextResponse.json({ ok: true });
    }

    // Extract video URL from payload
    // Webhook format: { status: "OK", payload: { video: { url: "..." } } }
    const payload = body.payload || {};

    console.log(`[fal-webhook] payload keys=${Object.keys(payload).join(", ")}`);
    console.log(`[fal-webhook] payload preview=${JSON.stringify(payload).slice(0, 300)}`);

    const video = payload.video as { url?: string } | undefined;
    const outputUrl =
      video?.url ||
      (payload.output as { url?: string })?.url ||
      // Sometimes the payload IS the direct output
      (body.video as { url?: string })?.url;

    if (outputUrl) {
      console.log(`[fal-webhook] Job ${matchedJob.id} COMPLETE: ${outputUrl.slice(0, 120)}`);
      await prisma.job.update({
        where: { id: matchedJob.id },
        data: {
          status: "complete",
          outputUrl,
        },
      });
    } else {
      // Log full payload for debugging — could be a different output format
      console.error(`[fal-webhook] No output URL found. Full body: ${JSON.stringify(body).slice(0, 1000)}`);
      await prisma.job.update({
        where: { id: matchedJob.id },
        data: {
          status: "failed",
          errorMsg: `Webhook received but no output URL. Keys: ${Object.keys(payload).join(", ")}`,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[fal-webhook] Error:", err);
    // Return 200 to prevent fal.ai from retrying on our errors
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 200 });
  }
}
