import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const saved = searchParams.get("saved");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "25", 10) || 25, 1),
      100
    );

    const filter = saved === "true" ? { saved: true } : undefined;

    const jobs = await prisma.job.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        section: true,
        modelId: true,
        modelName: true,
        status: true,
        outputUrl: true,
        thumbnailUrl: true,
        durationSec: true,
        estimatedCost: true,
        saved: true,
        errorMsg: true,
        inputParams: true,
      },
    });

    const hasMore = jobs.length > limit;
    const results = hasMore ? jobs.slice(0, -1) : jobs;

    return NextResponse.json({
      jobs: results,
      nextCursor: hasMore ? results[results.length - 1].id : null,
    });
  } catch (err) {
    return safeError(err, "List jobs error");
  }
}
