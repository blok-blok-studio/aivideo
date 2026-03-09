import { z } from "zod";

/**
 * Environment variable validation.
 * Import this module early to fail fast on missing/invalid configuration.
 */
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FAL_API_KEY: z.string().min(1, "FAL_API_KEY is required"),
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),

  // Required in production
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SERVER_API_KEY: z.string().optional(),

  // Optional — Cloudflare R2
  CLOUDFLARE_R2_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_R2_ENDPOINT: z.string().optional(),
  CLOUDFLARE_R2_PUBLIC_URL: z.string().optional(),

  // Optional — CORS
  ALLOWED_ORIGINS: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\nEnvironment validation failed:\n${formatted}\n`);
    throw new Error("Missing required environment variables");
  }

  const env = result.data;

  // Warn about security in production
  if (env.NODE_ENV === "production") {
    if (!env.SERVER_API_KEY) {
      console.warn(
        "WARNING: SERVER_API_KEY is not set — API routes are unprotected in production!"
      );
    }
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn(
        "WARNING: Upstash Redis not configured — rate limiting is disabled in production!"
      );
    }
  }

  return env;
}

export const env = validateEnv();
