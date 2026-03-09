import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteVoice } from "@/lib/elevenlabs";
import { validateBody, safeError } from "@/lib/api-helpers";
import { idParamSchema } from "@/lib/validation";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    const result = validateBody(idParamSchema, { id });
    if (!result.success) return result.response;

    const voice = await prisma.customVoice.findUnique({
      where: { id },
    });

    if (!voice) {
      return NextResponse.json({ error: "Voice not found" }, { status: 404 });
    }

    // Delete from ElevenLabs
    try {
      await deleteVoice(voice.elevenlabsId);
    } catch {
      // ElevenLabs delete may fail if already removed
    }

    // Delete from database
    await prisma.customVoice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Delete voice error");
  }
}
