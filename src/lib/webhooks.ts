import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/** Generate a webhook signing secret */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** Create HMAC-SHA256 signature for webhook payload */
export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Deliver webhook events to all matching endpoints for a user.
 * Fire-and-forget — never throws.
 */
export async function deliverWebhook(
  userId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { has: event },
      },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookEvent = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);

    const deliveries = webhooks.map(async (webhook) => {
      try {
        const signature = signPayload(body, webhook.secret);
        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        console.error(
          `[webhook] Failed to deliver ${event} to ${webhook.url}:`,
          err
        );
      }
    });

    await Promise.allSettled(deliveries);
  } catch (err) {
    console.error("[webhook] Delivery error:", err);
  }
}
