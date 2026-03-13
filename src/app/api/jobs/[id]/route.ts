import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFalResult, getFalStatus } from "@/lib/fal";
import { validateBody, safeError } from "@/lib/api-helpers";
import { idParamSchema } from "@/lib/validation";

// Models whose result-fetching endpoint is broken on fal.ai
// (nested model paths cause the GET to re-run validation instead
// of returning stored results). These models use webhooks instead.
const WEBHOOK_MODELS = new Set([
  "fal-ai/pixverse/swap",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    const result = validateBody(idParamSchema, { id });
    if (!result.success) return result.response;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const usesWebhook = WEBHOOK_MODELS.has(job.modelId);

    // ── Job is "ready" = status COMPLETED on fal.ai, now fetch the result ──
    // For webhook models, skip direct result fetching — the webhook will
    // update the job to "complete" with the output URL.
    if (job.status === "ready" && job.falRequestId) {
      if (usesWebhook) {
        // Webhook hasn't delivered yet. Tell frontend to keep polling.
        console.log(`[Job ${id}] READY (webhook model) — waiting for webhook delivery`);
        return NextResponse.json({
          ...job,
          status: "processing",
          falStatus: "COMPLETED — waiting for result delivery…",
        });
      }

      // Non-webhook models: fetch result directly
      const responseUrl = job.falResponseUrl || null;
      try {
        const falResult = await getFalResult(
          job.modelId,
          job.falRequestId,
          responseUrl
        );
        const data = falResult.data as Record<string, unknown>;
        const video = data.video as { url: string } | undefined;
        const outputUrl =
          video?.url || (data.output as { url: string })?.url;

        console.log(
          `[Job ${id}] Result keys:`,
          Object.keys(data),
          "outputUrl:",
          outputUrl?.slice(0, 80)
        );

        if (!outputUrl) {
          console.error(
            `[Job ${id}] No output URL found in result. Keys: ${Object.keys(data).join(", ")}. Full data: ${JSON.stringify(data).slice(0, 500)}`
          );
        }

        const updated = await prisma.job.update({
          where: { id: job.id },
          data: {
            status: outputUrl ? "complete" : "failed",
            outputUrl: outputUrl || null,
            errorMsg: outputUrl ? null : "Completed but no output URL in result",
          },
        });
        return NextResponse.json(updated);
      } catch (resultErr) {
        console.error(`[Job ${id}] Result fetch failed:`, resultErr);
        const updated = await prisma.job.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMsg: `Failed to fetch result: ${resultErr instanceof Error ? resultErr.message : String(resultErr)}`,
          },
        });
        return NextResponse.json(updated);
      }
    }

    // ── Job is "processing" = check fal.ai status ──
    if (job.status === "processing" && job.falRequestId) {
      const inputParams = job.inputParams as Record<string, unknown> | null;
      const statusUrl = inputParams?._statusUrl as string | undefined;

      console.log(`[Job ${id}] POLL: status=${job.status} modelId=${job.modelId} falRequestId=${job.falRequestId}`);
      console.log(`[Job ${id}] POLL: _statusUrl=${statusUrl || "NOT SET"} webhook=${usesWebhook ? "YES" : "NO"}`);

      try {
        const falStatus = await getFalStatus(job.modelId, job.falRequestId, statusUrl);
        const statusStr = String(falStatus.status || "").toUpperCase();

        const statusResponseUrl = falStatus.response_url as string | undefined;

        console.log(
          `[Job ${id}] POLL RESULT: fal.ai status=${statusStr}`,
          statusResponseUrl ? `response_url=${statusResponseUrl.slice(0, 80)}` : "no response_url"
        );

        if (statusStr === "COMPLETED") {
          if (usesWebhook) {
            // For webhook models, mark as "ready" and wait for webhook.
            // The webhook POST to /api/fal/webhook will update the job
            // to "complete" with the output URL.
            await prisma.job.update({
              where: { id: job.id },
              data: {
                status: "ready",
                falResponseUrl: statusResponseUrl || job.falResponseUrl || null,
              },
            });
            console.log(`[Job ${id}] COMPLETED (webhook model) — marked ready, waiting for webhook`);
            return NextResponse.json({
              ...job,
              status: "processing",
              falStatus: "COMPLETED — waiting for result delivery…",
            });
          }

          // Non-webhook: mark as "ready" so the NEXT poll fetches the result
          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "ready",
              falResponseUrl: statusResponseUrl || job.falResponseUrl || null,
            },
          });
          return NextResponse.json({
            ...updated,
            status: "processing",
            falStatus: "COMPLETED — fetching result…",
          });
        }

        if (statusStr === "FAILED") {
          const errorDetail =
            (typeof falStatus.error === "string" && falStatus.error) ||
            (typeof falStatus.logs === "string" && falStatus.logs.slice(0, 500)) ||
            "Generation failed on fal.ai";

          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "failed",
              errorMsg: errorDetail,
            },
          });
          return NextResponse.json(updated);
        }

        // IN_QUEUE or IN_PROGRESS — still working
        return NextResponse.json({
          ...job,
          falStatus: statusStr,
        });
      } catch (statusErr) {
        console.error(
          `[Job ${id}] Status check error:`,
          statusErr instanceof Error ? statusErr.message : statusErr
        );

        return NextResponse.json(
          {
            ...job,
            falStatusError:
              statusErr instanceof Error
                ? statusErr.message
                : "Status check failed",
          },
          { status: 502 }
        );
      }
    }

    // Job is in "queued" state without a falRequestId — submission likely failed
    if (job.status === "queued" && !job.falRequestId) {
      const updated = await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: job.errorMsg || "Job submission did not complete",
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(job);
  } catch (err) {
    return safeError(err, "Get job error");
  }
}
