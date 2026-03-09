import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError, validateBody } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional(),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { jobs: true, voiceJobs: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (err) {
    return safeError(err, "List projects error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createProjectSchema, body);
    if (!result.success) return result.response;

    const project = await prisma.project.create({
      data: { ...result.data, userId },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return safeError(err, "Create project error");
  }
}
