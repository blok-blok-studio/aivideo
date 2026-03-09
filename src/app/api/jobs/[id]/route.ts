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
        const statusStr = falStatus.status as string;

        if (statusStr === "COMPLETED") {
          const falResult = await getFalResult(job.modelId, job.falRequestId);
          const data = falResult.data as Record<string, unknown>;
          const video = data.video as { url: string } | undefined;
          const outputUrl = video?.url || (data.output as { url: string })?.url;

          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "complete",
              outputUrl,
            },
          });
          return NextResponse.json(updated);
        }

        if (statusStr === "FAILED") {
          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              status: "failed",
              errorMsg: "Generation failed on fal.ai",
            },
          });
          return NextResponse.json(updated);
        }
      } catch {
        // Status check failed, return current job state
      }
    }

    return NextResponse.json(job);
  } catch (err) {
    return safeError(err, "Get job error");
  }
}
