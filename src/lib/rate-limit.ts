import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Tier 1: Generation routes — cost real money (fal.ai, ElevenLabs)
export const generationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:gen",
  analytics: true,
});

// Tier 2: Compute routes (clone, merge, match, delete)
export const computeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:compute",
  analytics: true,
});

// Tier 3: Read routes (jobs, voices)
export const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:read",
  analytics: true,
});

// Tier 4: Sensitive data routes (balance)
export const sensitiveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:sensitive",
  analytics: true,
});

// Daily generation budget: max 100 generation jobs per day
export const dailyGenerationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 d"),
  prefix: "rl:daily-gen",
  analytics: true,
});
