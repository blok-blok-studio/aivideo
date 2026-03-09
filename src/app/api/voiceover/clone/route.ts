import { NextRequest, NextResponse } from "next/server";
import { instantClone, generateSpeech } from "@/lib/elevenlabs";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { voiceoverCloneSchema } from "@/lib/validation";
import { validateAudioUpload } from "@/lib/file-validation";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sample = formData.get("sample") as File;

    if (!sample) {
      return NextResponse.json(
        { error: "Audio sample file is required" },
        { status: 400 }
      );
    }

    // Validate audio file (size, MIME, extension, magic bytes)
    const fileResult = await validateAudioUpload(sample);
    if (!fileResult.valid) {
      return NextResponse.json(
        { error: fileResult.error },
        { status: 400 }
      );
    }

    // Validate text fields
    const textFields = {
      voice_name: formData.get("voice_name") as string,
      script: formData.get("script") as string,
      method: (formData.get("method") as string) || "instant",
      stability: parseFloat(formData.get("stability") as string) || 0.5,
      similarity_boost: parseFloat(formData.get("similarity_boost") as string) || 0.75,
    };

    const result = validateBody(voiceoverCloneSchema, textFields);
    if (!result.success) return result.response;

    const { voice_name, script, method, stability, similarity_boost } = result.data;

    const voiceJob = await prisma.voiceJob.create({
      data: {
        type: "clone",
        script,
        voiceName: voice_name,
        status: "processing",
      },
    });

    try {
      // Clone the voice
      const clonedVoiceId = await instantClone({
        name: voice_name,
        audioBlob: sample,
      });

      // Save custom voice
      await prisma.customVoice.create({
        data: {
          name: voice_name,
          elevenlabsId: clonedVoiceId,
          sourceAudioUrl: "",
          method,
        },
      });

      // Generate with cloned voice
      const audioBuffer = await generateSpeech({
        voiceId: clonedVoiceId,
        text: script,
        stability,
        similarityBoost: similarity_boost,
      });

      const base64 = Buffer.from(audioBuffer).toString("base64");
      const audioUrl = `data:audio/mpeg;base64,${base64}`;

      await prisma.voiceJob.update({
        where: { id: voiceJob.id },
        data: {
          status: "complete",
          voiceId: clonedVoiceId,
          outputAudioUrl: audioUrl,
        },
      });

      return NextResponse.json({ audioUrl, voiceId: clonedVoiceId, jobId: voiceJob.id });
    } catch (err) {
      await prisma.voiceJob.update({
        where: { id: voiceJob.id },
        data: {
          status: "failed",
          errorMsg: err instanceof Error ? err.message : "Clone failed",
        },
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Clone failed" },
        { status: 500 }
      );
    }
  } catch (err) {
    return safeError(err, "Voice clone error");
  }
}
