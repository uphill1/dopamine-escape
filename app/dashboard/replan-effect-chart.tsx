"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { formatMonthDay, type ReplanEffectResult } from "@/lib/dashboard/aggregate";

// 목표가 늘어나도 깨지지 않게 순환시키되, 첫 번째(스토리의 주인공, 보통 슬럼프가 있는 목표)는
// 항상 초록 주색으로 강조하고 나머지는 회색 계열로 보조한다.
const LINE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)"];

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
  goals,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number | null }[];
  label?: string;
  goals: { id: string; title: string }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="mb-1 font-medium">{formatMonthDay(label ?? "")}</p>
      {payload.map((p, i) => {
        const goal = goals.find((g) => g.id === p.dataKey);
        if (!goal || p.value === null) return null;
        return (
          <p key={p.dataKey} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
            />
            {goal.title}: <span className="font-medium text-foreground">{p.value === 100 ? "완료" : "실패"}</span>
          </p>
        );
      })}
    </div>
  );
}

export function ReplanEffectChart({ data }: { data: ReplanEffectResult }) {
  const { series, goals, replanEventDates, slumpBands } = data;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={series} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatMonthDay}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          unit="%"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip goals={goals} />} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">
              {goals.find((g) => g.id === value)?.title ?? value}
            </span>
          )}
        />

        {slumpBands.map((band, i) => (
          <ReferenceArea
            key={`slump-${i}`}
            x1={band.startDate}
            x2={band.endDate}
            fill="var(--destructive)"
            fillOpacity={0.08}
            stroke="none"
            label={
              i === 0
                ? { value: "슬럼프", position: "insideTop", fill: "var(--destructive)", fontSize: 11 }
                : undefined
            }
          />
        ))}

        {replanEventDates.map((date) => (
          <ReferenceLine
            key={date}
            x={date}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: "재계획", position: "top", fill: "var(--foreground)", fontSize: 11 }}
          />
        ))}

        {goals.map((goal, i) => (
          <Line
            key={goal.id}
            dataKey={goal.id}
            name={goal.id}
            type="monotone"
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: LINE_COLORS[i % LINE_COLORS.length], stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
