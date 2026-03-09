import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
});

/** List project members */
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

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { members: { some: { userId } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      members,
      owner: { id: project.userId },
    });
  } catch (err) {
    return safeError(err, "List members error");
  }
}

/** Add a member to a project */
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

    // Verify user is project owner or admin
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { members: { some: { userId, role: "admin" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Not found or insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = validateBody(addMemberSchema, body);
    if (!result.success) return result.response;

    const { email, role } = result.data;

    // Find the user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!invitedUser) {
      return NextResponse.json(
        { error: "User not found. They must register first." },
        { status: 404 }
      );
    }

    if (invitedUser.id === project.userId) {
      return NextResponse.json(
        { error: "Cannot add the project owner as a member" },
        { status: 400 }
      );
    }

    // Create or update membership
    const member = await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: id,
          userId: invitedUser.id,
        },
      },
      update: { role },
      create: {
        projectId: id,
        userId: invitedUser.id,
        role,
        invitedBy: userId,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    return safeError(err, "Add member error");
  }
}

/** Remove a member from a project */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("userId");

    if (!memberId) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    // Verify user is project owner or admin
    const project = await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { members: { some: { userId, role: "admin" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Not found or insufficient permissions" },
        { status: 403 }
      );
    }

    const result = await prisma.projectMember.deleteMany({
      where: { projectId: id, userId: memberId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Remove member error");
  }
}
