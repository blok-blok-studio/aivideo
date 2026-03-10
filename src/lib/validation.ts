import { z } from "zod";

// ── Model ID allowlist ──
// Only these fal.ai model IDs are permitted. Blocks attackers from
// submitting arbitrary (expensive) model IDs.
const ALLOWED_FAL_MODEL_IDS = [
  // Motion control (v2.6 only — v3 doesn't have motion-control)
  "fal-ai/kling-video/v2.6/pro/motion-control",
  "fal-ai/kling-video/v2.6/standard/motion-control",
  // Kling v3 (text/image to video)
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/pro/image-to-video",
  // Other models
  "fal-ai/veo3",
  "fal-ai/veo3-fast",
  "fal-ai/sora/v2/pro/text-to-video",
  "fal-ai/sora/v2/pro/image-to-video",
  "wan/v2.6/text-to-video",
  "wan/v2.6/image-to-video",
  "fal-ai/hunyuan-video",
  // Character swap
  "fal-ai/pixverse/swap",
] as const;

// ── Safe URL: HTTPS only (prevents SSRF via file://, http://) ──
const safeUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://") || url.startsWith("data:"), {
    message: "Only HTTPS URLs are allowed",
  });

// ── CUID format (Prisma default ID) ──
const cuid = z.string().min(20).max(30).regex(/^c[a-z0-9]+$/, "Invalid ID format");

// ── Motion Tracking ──
export const motionTrackingSchema = z.object({
  image_url: safeUrl,
  video_url: safeUrl,
  model_id: z.enum(ALLOWED_FAL_MODEL_IDS),
  character_orientation: z.enum(["image", "video"]).default("image"),
  prompt: z.string().max(2500).optional(),
  keep_original_sound: z.boolean().default(false),
});

// ── Motion Design ──
export const motionDesignSchema = z.object({
  model_id: z.enum(ALLOWED_FAL_MODEL_IDS),
  mode: z.enum(["t2v", "i2v", "v2v"]).default("t2v"),
  prompt: z.string().min(1, "Prompt is required").max(5000),
  image_url: safeUrl.optional(),
  video_url: safeUrl.optional(),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]).default("16:9"),
  duration: z.union([
    z.number().int().min(1).max(30),
    z.string().transform((v) => parseInt(v, 10)).refine((v) => v >= 1 && v <= 30, "Duration must be 1-30"),
  ]).optional(),
  resolution: z.enum(["720p", "1080p", "2K", "4K"]).default("1080p"),
  audio: z.boolean().default(true),
  negative_prompt: z.string().max(1000).optional(),
  cfg_scale: z.number().min(0).max(1).optional(),
  seed: z.number().int().min(0).optional(),
});

// ── Voiceover Generate ──
export const voiceoverGenerateSchema = z.object({
  script: z.string().min(1, "Script is required").max(5000),
  voice_id: z.string().min(1).max(100),
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
  pace: z.string().max(50).optional(),
  emotion: z.string().max(50).optional(),
  merge_with_job_id: cuid.optional(),
});

// ── Voiceover Merge ──
export const voiceoverMergeSchema = z.object({
  audio_url: safeUrl,
  video_job_id: cuid,
});

// ── Voiceover Clone (text fields only — file validated separately) ──
export const voiceoverCloneSchema = z.object({
  voice_name: z.string().min(1, "Voice name is required").max(100),
  script: z.string().min(1, "Script is required").max(5000),
  method: z.enum(["instant", "professional"]).default("instant"),
  stability: z.number().min(0).max(1).default(0.5),
  similarity_boost: z.number().min(0).max(1).default(0.75),
});

// ── Character Swap ──
export const characterSwapSchema = z.object({
  video_url: safeUrl,
  image_url: safeUrl,
  model_id: z.enum(ALLOWED_FAL_MODEL_IDS),
});

// ── ID params ──
export const idParamSchema = z.object({
  id: cuid,
});

// ── File upload limits ──
export const FILE_UPLOAD_LIMITS = {
  MAX_AUDIO_SIZE: 50 * 1024 * 1024, // 50 MB
  ALLOWED_AUDIO_TYPES: [
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/flac",
    "audio/webm",
  ],
  ALLOWED_AUDIO_EXTENSIONS: [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".webm"],
} as const;
