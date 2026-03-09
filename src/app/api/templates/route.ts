import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError, validateBody } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  section: z.enum(["motion-tracking", "motion-design", "voiceover"]),
  settings: z.record(z.unknown()),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");

    const where: Record<string, unknown> = {};

    if (section) {
      where.section = section;
    }

    // Show user's templates + global templates
    if (userId) {
      where.OR = [{ userId }, { isGlobal: true }];
    } else {
      where.isGlobal = true;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        section: true,
        settings: true,
        isGlobal: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (err) {
    return safeError(err, "List templates error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createTemplateSchema, body);
    if (!result.success) return result.response;

    const template = await prisma.template.create({
      data: { ...result.data, userId },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    return safeError(err, "Create template error");
  }
}
