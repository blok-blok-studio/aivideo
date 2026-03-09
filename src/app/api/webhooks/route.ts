import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateWebhookSecret } from "@/lib/webhooks";
import { safeError, validateBody } from "@/lib/api-helpers";
import { z } from "zod";

const VALID_EVENTS = [
  "job.complete",
  "job.failed",
  "batch.complete",
  "voiceover.complete",
];

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1),
});

/** List user's webhooks */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ webhooks });
  } catch (err) {
    return safeError(err, "List webhooks error");
  }
}

/** Create a new webhook */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = validateBody(createWebhookSchema, body);
    if (!result.success) return result.response;

    const { url, events } = result.data;
    const secret = generateWebhookSecret();

    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret,
      },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
    });

    // Return secret only once
    return NextResponse.json(
      { ...webhook, secret },
      { status: 201 }
    );
  } catch (err) {
    return safeError(err, "Create webhook error");
  }
}

/** Delete a webhook */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("id");
    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    const result = await prisma.webhook.deleteMany({
      where: { id: webhookId, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err, "Delete webhook error");
  }
}
