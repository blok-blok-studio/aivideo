import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError, validateBody } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";
import { z } from "zod";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color")
    .optional(),
});

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

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { jobs: true, voiceJobs: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    return safeError(err, "Get project error");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const result = validateBody(updateProjectSchema, body);
    if (!result.success) return result.response;

    const project = await prisma.project.updateMany({
      where: { id, userId },
      data: result.data,
    });

    if (project.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.project.findUnique({ where: { id } });
    return NextResponse.json({ project: updated });
  } catch (err) {
    return safeError(err, "Update project error");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deleted = await prisma.project.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Delete project error");
  }
}
