"use client";

import {
  Bar,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PurposeStat } from "@/lib/dashboard/aggregate";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: PurposeStat }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const s = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="mb-1 font-medium">
        {label} · {s.modelName}
      </p>
      <p className="text-muted-foreground">
        호출 <span className="font-medium text-foreground">{s.callCount}회</span> · 평균 토큰{" "}
        <span className="font-medium" style={{ color: "var(--chart-1)" }}>{s.avgTokens.toLocaleString()}</span>
      </p>
      <p className="text-muted-foreground">
        총 토큰 {s.totalTokens.toLocaleString()} · 평균 latency {s.avgLatencyMs}ms
      </p>
    </div>
  );
}

export function LlmRoutingChart({ stats }: { stats: PurposeStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={stats} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="purposeLabel"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "var(--chart-2)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={32}
          label={{
            value: "호출 수",
            position: "insideTopLeft",
            fill: "var(--chart-2)",
            fontSize: 11,
            offset: 10,
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: "var(--chart-1)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={48}
          label={{
            value: "평균 토큰",
            position: "insideTopRight",
            fill: "var(--chart-1)",
            fontSize: 11,
            offset: 10,
          }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
        />

        <Bar yAxisId="left" dataKey="callCount" name="호출 수" fill="var(--chart-2)" barSize={24} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          dataKey="avgTokens"
          name="평균 토큰"
          type="monotone"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
