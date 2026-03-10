import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitFalJob } from "@/lib/fal";
import { getNextCronRun } from "@/lib/cron";
import { logUsage } from "@/lib/usage";
import { safeError } from "@/lib/api-helpers";

/**
 * POST /api/cron/process-schedules
 * Called by Vercel Cron or external scheduler every 5 minutes.
 * Finds due schedules and creates jobs from their templates.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = req.headers.get("x-cron-secret");
    if (
      process.env.CRON_SECRET &&
      cronSecret !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find all due schedules
    const dueSchedules = await prisma.schedule.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
      },
      include: {
        template: true,
      },
      take: 20, // Process max 20 per run
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const results = [];

    for (const schedule of dueSchedules) {
      try {
        const settings = schedule.template.settings as Record<string, unknown>;
        const modelId = (settings.modelId as string) || "";
        const prompt = (settings.prompt as string) || "";

        // Submit job based on template settings
        const { request_id } = await submitFalJob(modelId, {
          prompt,
          ...settings,
        });

        // Create job record
        const job = await prisma.job.create({
          data: {
            section: schedule.template.section,
            modelId,
            modelName: modelId.split("/").pop() || modelId,
            status: "queued",
            falRequestId: request_id,
            inputParams: settings as Record<string, string | number | boolean | null>,
            userId: schedule.userId,
          },
        });

        // Update schedule
        const nextRunAt = getNextCronRun(schedule.cron, now);
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            lastJobId: job.id,
            nextRunAt,
          },
        });

        logUsage({
          userId: schedule.userId,
          action: "generation",
          section: schedule.template.section as "motion-tracking" | "motion-design" | "voiceover",
          modelId,
          modelName: modelId,
          status: "success",
          metadata: { scheduledBy: schedule.id },
        });

        results.push({ scheduleId: schedule.id, jobId: job.id, status: "ok" });
      } catch (err) {
        console.error(
          `[cron] Failed to process schedule ${schedule.id}:`,
          err
        );
        results.push({
          scheduleId: schedule.id,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (err) {
    return safeError(err, "Cron process error");
  }
}
