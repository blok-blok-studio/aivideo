import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Run all queries in parallel
    const [
      dailySpend,
      byAction,
      byModel,
      successRate,
      totalStats,
      recentLogs,
    ] = await Promise.all([
      // Daily spend over period
      prisma.$queryRawUnsafe<{ date: string; total: number; count: number }[]>(
        `SELECT DATE("createdAt") as date, SUM(cost) as total, COUNT(*) as count
         FROM "UsageLog"
         WHERE "createdAt" >= $1
         GROUP BY DATE("createdAt")
         ORDER BY date ASC`,
        since
      ),

      // Breakdown by action type
      prisma.usageLog.groupBy({
        by: ["action"],
        where: { createdAt: { gte: since } },
        _sum: { cost: true },
        _count: true,
      }),

      // Breakdown by model
      prisma.usageLog.groupBy({
        by: ["modelName"],
        where: { createdAt: { gte: since }, modelName: { not: null } },
        _sum: { cost: true },
        _count: true,
        orderBy: { _sum: { cost: "desc" } },
        take: 10,
      }),

      // Success vs failure rate
      prisma.usageLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: true,
      }),

      // Total stats
      prisma.usageLog.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { cost: true },
        _count: true,
      }),

      // Recent usage logs
      prisma.usageLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          action: true,
          section: true,
          modelName: true,
          cost: true,
          status: true,
        },
      }),
    ]);

    return NextResponse.json({
      period: { days, since: since.toISOString() },
      summary: {
        totalSpend: totalStats._sum.cost || 0,
        totalGenerations: totalStats._count,
        avgCostPerGeneration:
          totalStats._count > 0
            ? (totalStats._sum.cost || 0) / totalStats._count
            : 0,
      },
      dailySpend: dailySpend.map((d) => ({
        date: d.date,
        spend: Number(d.total),
        count: Number(d.count),
      })),
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count,
        spend: a._sum.cost || 0,
      })),
      byModel: byModel.map((m) => ({
        model: m.modelName || "Unknown",
        count: m._count,
        spend: m._sum.cost || 0,
      })),
      successRate: {
        success: successRate.find((s) => s.status === "success")?._count || 0,
        failed: successRate.find((s) => s.status === "failed")?._count || 0,
      },
      recentLogs,
    });
  } catch (err) {
    return safeError(err, "Analytics error");
  }
}
