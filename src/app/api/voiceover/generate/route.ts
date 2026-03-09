import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/elevenlabs";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { voiceoverGenerateSchema } from "@/lib/validation";
import { uploadToR2, isR2Configured } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(voiceoverGenerateSchema, body);
    if (!result.success) return result.response;

    const { script, voice_id, stability, similarity_boost } = result.data;

    const voiceJob = await prisma.voiceJob.create({
      data: {
        type: "generate",
        script,
        voiceId: voice_id,
        status: "processing",
      },
    });

    try {
      const audioBuffer = await generateSpeech({
        voiceId: voice_id,
        text: script,
        stability,
        similarityBoost: similarity_boost,
      });

      // Store in R2 if configured, otherwise fall back to base64
      let audioUrl: string;
      if (isR2Configured()) {
        audioUrl = await uploadToR2(
          audioBuffer,
          `voiceover-${voiceJob.id}.mp3`,
          "audio/mpeg"
        );
      } else {
        const base64 = Buffer.from(audioBuffer).toString("base64");
        audioUrl = `data:audio/mpeg;base64,${base64}`;
      }

      await prisma.voiceJob.update({
        where: { id: voiceJob.id },
        data: { status: "complete", outputAudioUrl: audioUrl },
      });

      return NextResponse.json({ audioUrl, jobId: voiceJob.id });
    } catch (err) {
      await prisma.voiceJob.update({
        where: { id: voiceJob.id },
        data: {
          status: "failed",
          errorMsg: err instanceof Error ? err.message : "TTS failed",
        },
      });
      return NextResponse.json(
        { error: "Speech generation failed. Please try again." },
        { status: 500 }
      );
    }
  } catch (err) {
    return safeError(err, "Voiceover generate error");
  }
}
