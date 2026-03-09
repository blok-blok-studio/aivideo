import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth";

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

    const deleted = await prisma.template.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Delete template error");
  }
}
