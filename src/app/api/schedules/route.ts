import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { getNextCronRun } from "@/lib/cron";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  templateId: z.string(),
  cron: z
    .string()
    .regex(
      /^(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)$/,
      "Invalid cron expression"
    ),
});

/** List user's schedules */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedules = await prisma.schedule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { name: true, section: true } },
      },
    });

    return NextResponse.json({ schedules });
  } catch (err) {
    return safeError(err, "List schedules error");
  }
}

/** Create a new schedule */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createScheduleSchema, body);
    if (!result.success) return result.response;

    const { name, templateId, cron } = result.data;

    // Verify template exists and belongs to user
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        OR: [{ userId }, { isGlobal: true }],
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const nextRunAt = getNextCronRun(cron);

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        templateId,
        name,
        cron,
        nextRunAt,
      },
      include: {
        template: { select: { name: true, section: true } },
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    return safeError(err, "Create schedule error");
  }
}
