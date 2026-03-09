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

    // If processing, check fal.ai status
    if (job.status === "processing" && job.falRequestId) {
      try {
        const falStatus = await getFalStatus(job.modelId, job.falRequestId);
        const statusStr = String(falStatus.status || "").toUpperCase();

        // Extract response_url from status response (available when COMPLETED)
        const statusResponseUrl = (falStatus as unknown as Record<string, unknown>)
          .response_url as string | undefined;

        console.log(
          `[Job ${id}] fal.ai status: ${statusStr}`,
          `response_url: ${statusResponseUrl?.slice(0, 100) || "none"}`,
          JSON.stringify(falStatus).slice(0, 500)
        );

        if (statusStr === "COMPLETED") {
          // Use response_url from status response, fall back to DB, then let getFalResult try SDK
          const responseUrl = statusResponseUrl || job.falResponseUrl;

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
              `[Job ${id}] Result data keys:`,
              Object.keys(data),
              "outputUrl:",
              outputUrl?.slice(0, 80)
            );

            const updated = await prisma.job.update({
              where: { id: job.id },
              data: {
                status: "complete",
                outputUrl: outputUrl || null,
              },
            });
            return NextResponse.json(updated);
          } catch (resultErr) {
            console.error(`[Job ${id}] Failed to fetch result:`, resultErr);
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

        if (statusStr === "FAILED") {
          const logs = (falStatus as unknown as Record<string, unknown>).logs;
          const errorDetail =
            typeof logs === "string"
              ? logs.slice(0, 500)
              : "Generation failed on fal.ai";

          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "failed",
              errorMsg: errorDetail,
            },
          });
          return NextResponse.json(updated);
        }

        // IN_QUEUE or IN_PROGRESS — still working, include fal status in response
        return NextResponse.json({
          ...job,
          falStatus: statusStr,
        });
      } catch (statusErr) {
        // Log the error instead of silently swallowing it
        console.error(
          `[Job ${id}] fal.ai status check error:`,
          statusErr instanceof Error ? statusErr.message : statusErr
        );

        // Return the job with the error info so the frontend knows what happened
        return NextResponse.json({
          ...job,
          falStatusError:
            statusErr instanceof Error
              ? statusErr.message
              : "Status check failed",
        });
      }
    }

    return NextResponse.json(job);
  } catch (err) {
    return safeError(err, "Get job error");
  }
}
