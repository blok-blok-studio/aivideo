import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFalResult, getFalStatus } from "@/lib/fal";
import { validateBody, safeError } from "@/lib/api-helpers";
import { idParamSchema } from "@/lib/validation";

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

    // ── Job is "ready" = status COMPLETED on fal.ai, now fetch the result ──
    // This is a separate state so we don't try status+result in one request
    // (which can exceed Vercel's 10s function timeout).
    if (job.status === "ready" && job.falRequestId) {
      const responseUrl =
        job.falResponseUrl ||
        (job.inputParams as Record<string, unknown>)?._statusResponseUrl as string | undefined;

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
      const statusUrl =
        (job.inputParams as Record<string, unknown>)?._statusUrl as string | undefined;
      try {
        const falStatus = await getFalStatus(job.modelId, job.falRequestId, statusUrl);
        const statusStr = String(falStatus.status || "").toUpperCase();

        const statusResponseUrl = falStatus.response_url as string | undefined;

        console.log(
          `[Job ${id}] fal.ai: ${statusStr}`,
          statusResponseUrl ? `url=${statusResponseUrl.slice(0, 80)}` : ""
        );

        if (statusStr === "COMPLETED") {
          // Mark as "ready" so the NEXT poll fetches the result.
          // This prevents status+result from running in one 10s window.
          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "ready",
              falResponseUrl: statusResponseUrl || job.falResponseUrl || null,
            },
          });
          // Return as still processing so frontend keeps polling
          return NextResponse.json({
            ...updated,
            status: "processing",
            falStatus: "COMPLETED — fetching result…",
          });
        }

        if (statusStr === "FAILED") {
          // fal.ai returns errors in "error" field, with optional "logs" for details
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

        // Return 502 so the frontend's error counter increments and polling
        // eventually stops instead of silently retrying for 10 minutes.
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
    // but DB update in catch block also failed. Mark it as failed to stop polling.
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
