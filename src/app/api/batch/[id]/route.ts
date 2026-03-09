import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";
import { submitFalJob } from "@/lib/fal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const batch = await prisma.batchJob.findFirst({
      where: { id, userId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { job: { select: { id: true, status: true, outputUrl: true, errorMsg: true } } },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (err) {
    return safeError(err, "Get batch error");
  }
}

/**
 * POST /api/batch/[id] — Start processing the batch.
 * Creates individual Job records and submits to fal.ai queue.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const batch = await prisma.batchJob.findFirst({
      where: { id, userId, status: "pending" },
      include: { items: { where: { status: "pending" }, orderBy: { sortOrder: "asc" } } },
    });

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found or already started" },
        { status: 404 }
      );
    }

    // Mark batch as running
    await prisma.batchJob.update({
      where: { id },
      data: { status: "running" },
    });

    // Process items sequentially with spacing
    let completed = 0;
    let failed = 0;

    for (const item of batch.items) {
      try {
        const input = item.inputParams as Record<string, unknown>;
        const modelId = input.model_id as string;

        // Create a regular Job record
        const job = await prisma.job.create({
          data: {
            section: batch.section,
            modelId,
            modelName: (input.model_name as string) || modelId,
            status: "queued",
            inputParams: input,
            estimatedCost: (input.estimated_cost as number) || null,
            userId,
            projectId: batch.projectId,
          },
        });

        // Submit to fal.ai
        const { request_id, response_url } = await submitFalJob(modelId, input);

        // Update job with fal request ID
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "processing", falRequestId: request_id, falResponseUrl: response_url },
        });

        // Link batch item to job
        await prisma.batchItem.update({
          where: { id: item.id },
          data: { jobId: job.id, status: "processing" },
        });

        completed++;

        // Space out submissions (500ms) to avoid rate limits
        if (completed < batch.items.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Batch item ${item.id} failed:`, err);
        await prisma.batchItem.update({
          where: { id: item.id },
          data: { status: "failed" },
        });
        failed++;
      }
    }

    // Update batch counts
    const finalStatus = failed === batch.items.length ? "failed" : failed > 0 ? "partial" : "running";
    await prisma.batchJob.update({
      where: { id },
      data: {
        status: finalStatus,
        completedCount: completed,
        failedCount: failed,
      },
    });

    return NextResponse.json({
      status: finalStatus,
      submitted: completed,
      failed,
    });
  } catch (err) {
    return safeError(err, "Start batch error");
  }
}
