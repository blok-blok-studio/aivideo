import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// ── Job status cache ──

export async function setJobStatus(jobId: string, status: string) {
  await redis.set(`job:${jobId}:status`, status, { ex: 86400 });
}

export async function getJobStatus(jobId: string): Promise<string | null> {
  return redis.get(`job:${jobId}:status`);
}

// ── Generic cache helpers ──

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache failure is non-critical
  }
}
