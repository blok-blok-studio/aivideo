import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/api-keys";
import { safeError } from "@/lib/api-helpers";

/** GET /api/v1/jobs — List jobs for API key user */
export async function GET(req: NextRequest) {
  try {
    const userId = await validateApiKey(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const cursor = searchParams.get("cursor");
    const status = searchParams.get("status");
    const section = searchParams.get("section");

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (section) where.section = section;

    const jobs = await prisma.job.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        section: true,
        modelId: true,
        modelName: true,
        status: true,
        outputUrl: true,
        durationSec: true,
        estimatedCost: true,
        errorMsg: true,
      },
    });

    const hasMore = jobs.length > limit;
    const data = hasMore ? jobs.slice(0, -1) : jobs;

    return NextResponse.json({
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
      hasMore,
    });
  } catch (err) {
    return safeError(err, "API v1 list jobs error");
  }
}
