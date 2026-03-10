import { prisma } from "@/lib/db";

interface LogUsageParams {
  userId?: string | null;
  action: "generation" | "voiceover" | "clone" | "match" | "caption" | "script";
  section: "motion-tracking" | "motion-design" | "voiceover";
  modelId?: string;
  modelName?: string;
  cost?: number;
  status: "success" | "failed";
  metadata?: Record<string, unknown>;
}

/**
 * Log a usage event for analytics. Fire-and-forget — never throws.
 */
export function logUsage(params: LogUsageParams): void {
  prisma.usageLog
    .create({
      data: {
        userId: params.userId || undefined,
        action: params.action,
        section: params.section,
        modelId: params.modelId,
        modelName: params.modelName,
        cost: params.cost || 0,
        status: params.status,
        metadata: (params.metadata as Record<string, string | number | boolean | null>) || undefined,
      },
    })
    .catch((err) => {
      console.error("[usage-log] Failed to log usage:", err);
    });
}
