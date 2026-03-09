import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export async function setJobStatus(jobId: string, status: string) {
  await redis.set(`job:${jobId}:status`, status, { ex: 86400 });
}

export async function getJobStatus(jobId: string): Promise<string | null> {
  return redis.get(`job:${jobId}:status`);
}
