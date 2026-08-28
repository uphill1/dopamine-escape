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
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { NudgeHourPoint } from "@/lib/dashboard/aggregate";

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
  payload?: { payload: NudgeHourPoint }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-muted-foreground">
        발송 <span className="font-medium text-foreground">{point.sentCount}건</span> · 응답{" "}
        <span className="font-medium text-foreground">{point.respondedCount}건</span>
      </p>
      <p className="text-muted-foreground">
        응답률 <span className="font-medium" style={{ color: "var(--chart-1)" }}>{point.responseRate}%</span>
      </p>
    </div>
  );
}

export function NudgeResponseChart({
  points,
  averageResponseRate,
}: {
  points: NudgeHourPoint[];
  averageResponseRate: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={points} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
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
            value: "발송",
            position: "insideTopLeft",
            fill: "var(--chart-2)",
            fontSize: 11,
            offset: 10,
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          unit="%"
          tick={{ fill: "var(--chart-1)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={44}
          label={{
            value: "응답률",
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

        <ReferenceLine
          yAxisId="right"
          y={averageResponseRate}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: `평균 ${averageResponseRate}%`,
            position: "insideTopLeft",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />

        <Bar yAxisId="left" dataKey="sentCount" name="발송 건수" fill="var(--chart-2)" barSize={24} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          dataKey="responseRate"
          name="응답률"
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
