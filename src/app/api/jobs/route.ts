import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const saved = searchParams.get("saved");

    // Validate query param — only "true" is accepted
    const filter = saved === "true" ? { saved: true } : undefined;

    const jobs = await prisma.job.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(jobs);
  } catch (err) {
    return safeError(err, "List jobs error");
  }
}
