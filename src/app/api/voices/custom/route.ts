import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const voices = await prisma.customVoice.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ voices });
  } catch (err) {
    console.error("List custom voices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
