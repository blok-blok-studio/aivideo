"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  period: { days: number; since: string };
  summary: {
    totalSpend: number;
    totalGenerations: number;
    avgCostPerGeneration: number;
  };
  dailySpend: { date: string; spend: number; count: number }[];
  byAction: { action: string; count: number; spend: number }[];
  byModel: { model: string; count: number; spend: number }[];
  successRate: { success: number; failed: number };
  recentLogs: {
    id: string;
    createdAt: string;
    action: string;
    section: string;
    modelName: string | null;
    cost: number;
    status: string;
  }[];
}

const COLORS = ["#FF6B35", "#4ADE80", "#3B82F6", "#A855F7", "#F59E0B", "#EC4899"];

const ACTION_LABELS: Record<string, string> = {
  generation: "Video Generation",
  voiceover: "Voiceover",
  clone: "Voice Clone",
  match: "Voice Match",
  caption: "Auto Caption",
  script: "AI Script",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg/80 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-input border border-border-subtle px-3 py-2 text-xs text-text-secondary hover:border-border-hover hover:text-text-primary"
            >
              &larr; Studio
            </Link>
            <h1 className="font-display text-lg font-bold text-text-primary md:text-xl">
              Analytics
            </h1>
          </div>
          <div className="flex gap-1 rounded-card bg-bg-surface p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-input px-3 py-1.5 text-xs font-medium transition-all ${
                  days === d
                    ? "bg-bg-input text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <p className="text-sm">No analytics data available yet.</p>
            <p className="mt-1 text-xs">Generate some content to see usage data here.</p>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                label="Total Spend"
                value={`$${data.summary.totalSpend.toFixed(2)}`}
                subtext={`Last ${days} days`}
              />
              <SummaryCard
                label="Total Generations"
                value={data.summary.totalGenerations.toLocaleString()}
                subtext={`${(data.summary.totalGenerations / days).toFixed(1)}/day avg`}
              />
              <SummaryCard
                label="Avg Cost"
                value={`$${data.summary.avgCostPerGeneration.toFixed(3)}`}
                subtext="Per generation"
              />
            </div>

            {/* Spend Over Time Chart */}
            <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
              <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                SPEND OVER TIME
              </h3>
              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailySpend}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      stroke="#444"
                      fontSize={10}
                      tickFormatter={(d) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    />
                    <YAxis
                      stroke="#444"
                      fontSize={10}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Spend"]}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleDateString("en", {
                          month: "long",
                          day: "numeric",
                        })
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#FF6B35"
                      strokeWidth={2}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Two Column: By Action + By Model */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* By Action */}
              <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
                <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  BY ACTION TYPE
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byAction} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" stroke="#444" fontSize={10} />
                      <YAxis
                        type="category"
                        dataKey="action"
                        stroke="#444"
                        fontSize={10}
                        width={90}
                        tickFormatter={(a) => ACTION_LABELS[a] || a}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="#FF6B35" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Success / Failure */}
              <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
                <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  SUCCESS RATE
                </h3>
                <div className="flex items-center gap-6">
                  <div className="h-48 w-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Success", value: data.successRate.success },
                            { name: "Failed", value: data.successRate.failed },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          <Cell fill="#4ADE80" />
                          <Cell fill="#EF4444" />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-status-complete" />
                      <span className="text-sm text-text-primary">
                        {data.successRate.success} Success
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-status-failed" />
                      <span className="text-sm text-text-primary">
                        {data.successRate.failed} Failed
                      </span>
                    </div>
                    {data.successRate.success + data.successRate.failed > 0 && (
                      <p className="font-mono text-xs text-text-muted">
                        {(
                          (data.successRate.success /
                            (data.successRate.success + data.successRate.failed)) *
                          100
                        ).toFixed(1)}
                        % success rate
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Models */}
            {data.byModel.length > 0 && (
              <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
                <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  TOP MODELS
                </h3>
                <div className="space-y-3">
                  {data.byModel.map((model, i) => {
                    const maxCount = data.byModel[0]?.count || 1;
                    return (
                      <div key={model.model} className="flex items-center gap-3">
                        <span className="w-4 font-mono text-[10px] text-text-muted">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm text-text-primary">
                              {model.model}
                            </span>
                            <span className="font-mono text-xs text-text-muted">
                              {model.count} runs · ${model.spend.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(model.count / maxCount) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Activity Log */}
            <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
              <h3 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                RECENT ACTIVITY
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="pb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        TIME
                      </th>
                      <th className="pb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        ACTION
                      </th>
                      <th className="hidden pb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted sm:table-cell">
                        MODEL
                      </th>
                      <th className="pb-2 text-right font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        COST
                      </th>
                      <th className="pb-2 text-right font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLogs.map((log) => (
                      <tr key={log.id} className="border-b border-border-subtle/50">
                        <td className="py-2 font-mono text-[10px] text-text-muted">
                          {new Date(log.createdAt).toLocaleString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 text-xs text-text-primary">
                          {ACTION_LABELS[log.action] || log.action}
                        </td>
                        <td className="hidden py-2 text-xs text-text-secondary sm:table-cell">
                          {log.modelName || "—"}
                        </td>
                        <td className="py-2 text-right font-mono text-xs text-text-primary">
                          ${log.cost.toFixed(3)}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${
                              log.status === "success"
                                ? "bg-status-complete/20 text-status-complete"
                                : "bg-status-failed/20 text-status-failed"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-panel border border-border-subtle bg-bg-surface/50 p-4 md:p-6">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold text-text-primary md:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-text-secondary">{subtext}</p>
    </div>
  );
}
