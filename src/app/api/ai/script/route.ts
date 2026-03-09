import { NextRequest, NextResponse } from "next/server";
import { generateScript, ScriptRequest } from "@/lib/llm";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const scriptSchema = z.object({
  type: z.enum(["video-prompt", "voiceover-script", "social-caption"]),
  context: z.object({
    product: z.string().max(200).optional(),
    brand: z.string().max(100).optional(),
    tone: z.string().max(100).optional(),
    platform: z.string().max(50).optional(),
    duration: z.number().int().min(1).max(120).optional(),
    additionalContext: z.string().max(1000).optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI script generation is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const result = validateBody(scriptSchema, body);
    if (!result.success) return result.response;

    const scripts = await generateScript(result.data as ScriptRequest);

    return NextResponse.json(scripts);
  } catch (err) {
    return safeError(err, "Script generation error");
  }
}
