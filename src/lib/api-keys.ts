import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Generate a new API key with bb_live_ prefix.
 * Returns the full key (only shown once) and the hashed version for storage.
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `bb_live_${raw}`;
  const prefix = key.slice(0, 16);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/** SHA-256 hash for storing/looking up API keys */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate a Bearer token API key.
 * Returns the userId if valid, null otherwise.
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer bb_live_")) return null;

  const key = authHeader.replace("Bearer ", "");
  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { userId: true, revoked: true, expiresAt: true, id: true },
  });

  if (!apiKey || apiKey.revoked) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used (fire-and-forget)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } })
    .catch(() => {});

  return apiKey.userId;
}
