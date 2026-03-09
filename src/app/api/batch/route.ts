import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError, validateBody } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";
import { z } from "zod";

const createBatchSchema = z.object({
  name: z.string().max(100).optional(),
  section: z.enum(["motion-design", "motion-tracking"]),
  projectId: z.string().optional(),
  items: z
    .array(
      z.object({
        inputParams: z.record(z.unknown()),
      })
    )
    .min(1, "At least one item is required")
    .max(50, "Maximum 50 items per batch"),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const batches = await prisma.batchJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({ batches });
  } catch (err) {
    return safeError(err, "List batches error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createBatchSchema, body);
    if (!result.success) return result.response;

    const { name, section, projectId, items } = result.data;

    const batch = await prisma.batchJob.create({
      data: {
        name,
        section,
        userId,
        projectId,
        totalCount: items.length,
        items: {
          create: items.map((item, idx) => ({
            inputParams: item.inputParams,
            sortOrder: idx,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    return safeError(err, "Create batch error");
  }
}
