import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ScriptRequest {
  type: "video-prompt" | "voiceover-script" | "social-caption";
  context: {
    product?: string;
    brand?: string;
    tone?: string;
    platform?: string;
    duration?: number;
    additionalContext?: string;
  };
}

export interface ScriptResponse {
  variants: {
    script: string;
    videoPrompt?: string;
    tone: string;
  }[];
}

export async function generateScript(
  request: ScriptRequest
): Promise<ScriptResponse> {
  const anthropic = getClient();
  const { type, context } = request;

  const systemPrompt = `You are an expert agency copywriter specializing in video ad scripts.
You create compelling, concise scripts optimized for social media and video advertising.
Always return exactly 3 variants with different approaches.
Return ONLY valid JSON in the exact format specified.`;

  const userPrompt = buildPrompt(type, context);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse script response");
  }

  return JSON.parse(jsonMatch[0]) as ScriptResponse;
}

function buildPrompt(
  type: ScriptRequest["type"],
  context: ScriptRequest["context"]
): string {
  const parts = [];

  parts.push(`Generate 3 ${type} variants.`);

  if (context.product) parts.push(`Product/Service: ${context.product}`);
  if (context.brand) parts.push(`Brand: ${context.brand}`);
  if (context.tone) parts.push(`Tone: ${context.tone}`);
  if (context.platform) parts.push(`Platform: ${context.platform}`);
  if (context.duration) parts.push(`Target duration: ${context.duration}s`);
  if (context.additionalContext)
    parts.push(`Additional context: ${context.additionalContext}`);

  parts.push(`
Return JSON in this exact format:
{
  "variants": [
    {
      "script": "The voiceover/caption text",
      "videoPrompt": "A detailed video generation prompt for AI",
      "tone": "Brief tone description (e.g. 'Bold & Energetic')"
    }
  ]
}`);

  return parts.join("\n");
}
