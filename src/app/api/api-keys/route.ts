import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/** List user's API keys (hashed, prefix only) */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsed: true,
        expiresAt: true,
        revoked: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (err) {
    return safeError(err, "List API keys error");
  }
}

/** Create a new API key */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createKeySchema, body);
    if (!result.success) return result.response;

    const { name, expiresInDays } = result.data;
    const { key, prefix, hash } = generateApiKey();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        name,
        prefix,
        keyHash: hash,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return full key only once
    return NextResponse.json(
      { ...apiKey, key },
      { status: 201 }
    );
  } catch (err) {
    return safeError(err, "Create API key error");
  }
}

/** Revoke an API key */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) {
      return NextResponse.json({ error: "Key ID required" }, { status: 400 });
    }

    const result = await prisma.apiKey.updateMany({
      where: { id: keyId, userId },
      data: { revoked: true },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Revoke API key error");
  }
}
