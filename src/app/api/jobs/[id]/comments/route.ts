import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const createCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

/** List comments on a job */
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

    const comments = await prisma.comment.findMany({
      where: { jobId: id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (err) {
    return safeError(err, "List comments error");
  }
}

/** Add a comment to a job */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = await req.json();
    const result = validateBody(createCommentSchema, body);
    if (!result.success) return result.response;

    const comment = await prisma.comment.create({
      data: {
        jobId: id,
        userId,
        text: result.data.text,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return safeError(err, "Create comment error");
  }
}

/** Delete a comment */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId parameter required" },
        { status: 400 }
      );
    }

    const result = await prisma.comment.deleteMany({
      where: { id: commentId, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Delete comment error");
  }
}
