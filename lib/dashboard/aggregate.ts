// 대시보드용 순수 집계 함수 모음. Supabase에서 받은 원본 row를 받아
// 요약 카드 수치 / 차트 시리즈로 가공한다. DB 접근이나 recharts 관련 코드는 없음
// (recharts는 client component에서만 import 되어야 하므로 분리해둔다).

export type PlanDayRow = {
  goal_id: string;
  date: string;
  status: "pending" | "done" | "missed";
  replanned_count: number;
};

export type GoalRow = { id: string; title: string };

export type SessionRow = { focus_minutes: number | null };

export type NudgeRow = { sent_at: string; responded_at: string | null };

export type ModelCallRow = {
  purpose: "plan" | "decompose" | "nudge" | "program_match";
  model_name: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
};

export function formatMonthDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// ============================================================
// 요약 카드 4개
// ============================================================
export function buildSummary({
  planDays,
  sessions,
  nudges,
  modelCalls,
}: {
  planDays: PlanDayRow[];
  sessions: SessionRow[];
  nudges: NudgeRow[];
  modelCalls: ModelCallRow[];
}) {
  const totalSessions = sessions.length;
  const totalFocusMinutes = sessions.reduce((sum, s) => sum + (s.focus_minutes ?? 0), 0);

  const totalNudges = nudges.length;
  const respondedNudges = nudges.filter((n) => n.responded_at !== null).length;
  const nudgeResponseRate = totalNudges === 0 ? 0 : respondedNudges / totalNudges;

  const maxReplannedCount = planDays.reduce((max, d) => Math.max(max, d.replanned_count), 0);

  const totalModelCalls = modelCalls.length;

  return {
    totalSessions,
    totalFocusMinutes,
    nudgeResponseRate,
    respondedNudges,
    totalNudges,
    maxReplannedCount,
    totalModelCalls,
  };
}

// ============================================================
// 차트1: 재계획 효과
// ============================================================
export type ReplanEffectPoint = { date: string } & Record<string, number | null | string>;

// 이동평균 값(숫자)과 그날의 원본 status(문자열)를 한 point 안에 같이 담기 위한 키 규칙.
// 툴팁에서 "이동평균 %"와 "그날 실제 상태"를 함께 보여줄 때 쓴다.
export function statusKey(goalId: string) {
  return `${goalId}__status`;
}

export type ReplanEffectResult = {
  series: ReplanEffectPoint[];
  goals: { id: string; title: string }[];
  // replanned_count가 전날 대비 오른 날짜 (여러 목표가 같은 날 재계획됐으면 1개로 합침)
  replanEventDates: string[];
  // 3일 연속 missed 구간들 (여러 목표 것을 모두 모음, 겹쳐도 무방)
  slumpBands: { startDate: string; endDate: string }[];
  // 아직 진행 중인("pending") 가장 이른 날짜 — 있으면 "오늘" 캡션에 사용
  inProgressDate: string | null;
};

export function buildReplanEffectSeries(
  goals: GoalRow[],
  planDays: PlanDayRow[],
): ReplanEffectResult {
  const perGoal = goals.map((goal) => {
    const rows = planDays
      .filter((d) => d.goal_id === goal.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const todayIndex = rows.findIndex((d) => d.status === "pending");
    const history = (todayIndex === -1 ? rows : rows.slice(0, todayIndex)).slice(-14);
    const inProgressDate = todayIndex === -1 ? null : rows[todayIndex].date;
    return { goal, rows, history, inProgressDate };
  });

  const allDates = Array.from(
    new Set(perGoal.flatMap(({ history }) => history.map((d) => d.date))),
  ).sort((a, b) => a.localeCompare(b));

  const series: ReplanEffectPoint[] = allDates.map((date) => {
    const point: ReplanEffectPoint = { date };
    for (const { goal, history } of perGoal) {
      const index = history.findIndex((d) => d.date === date);
      if (index === -1) {
        point[goal.id] = null;
        point[statusKey(goal.id)] = null;
        continue;
      }
      // 3일 이동평균: 해당 날짜와 그 전 최대 2일(총 최대 3일)의 done 비율.
      // 시작 구간(1~2일차)은 그만큼의 창으로 계산 — 표준 trailing moving average.
      const window = history.slice(Math.max(0, index - 2), index + 1);
      const doneCount = window.filter((d) => d.status === "done").length;
      point[goal.id] = Math.round((doneCount / window.length) * 100);
      point[statusKey(goal.id)] = history[index].status;
    }
    return point;
  });

  const replanEventDates = Array.from(
    new Set(
      perGoal.flatMap(({ history }) =>
        history
          .filter((d, i) => i > 0 && d.replanned_count > history[i - 1].replanned_count)
          .map((d) => d.date),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const slumpBands = perGoal.flatMap(({ history }) => findMissedRuns(history, 3));

  const inProgressDate =
    perGoal
      .map((g) => g.inProgressDate)
      .filter((d): d is string => d !== null)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    series,
    goals: goals.map((g) => ({ id: g.id, title: g.title })),
    replanEventDates,
    slumpBands,
    inProgressDate,
  };
}

function findMissedRuns(rows: PlanDayRow[], minLength: number) {
  const runs: { startDate: string; endDate: string }[] = [];
  let runStart: number | null = null;
  rows.forEach((d, i) => {
    if (d.status === "missed") {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      if (i - runStart >= minLength) {
        runs.push({ startDate: rows[runStart].date, endDate: rows[i - 1].date });
      }
      runStart = null;
    }
  });
  if (runStart !== null && rows.length - runStart >= minLength) {
    runs.push({ startDate: rows[runStart].date, endDate: rows[rows.length - 1].date });
  }
  return runs;
}

// ============================================================
// 차트2: 시간대별 알림 응답률
// ============================================================
export type NudgeHourPoint = {
  hour: number;
  label: string;
  sentCount: number;
  respondedCount: number;
  responseRate: number; // 0~100
};

export function buildNudgeHourSeries(nudges: NudgeRow[]) {
  const byHour = new Map<number, { sent: number; responded: number }>();
  for (const n of nudges) {
    const hour = kstHour(n.sent_at);
    const bucket = byHour.get(hour) ?? { sent: 0, responded: 0 };
    bucket.sent += 1;
    if (n.responded_at !== null) bucket.responded += 1;
    byHour.set(hour, bucket);
  }

  const points: NudgeHourPoint[] = Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, { sent, responded }]) => ({
      hour,
      label: `${hour}시`,
      sentCount: sent,
      respondedCount: responded,
      responseRate: sent === 0 ? 0 : Math.round((responded / sent) * 1000) / 10,
    }));

  const totalSent = nudges.length;
  const totalResponded = nudges.filter((n) => n.responded_at !== null).length;
  const averageResponseRate =
    totalSent === 0 ? 0 : Math.round((totalResponded / totalSent) * 1000) / 10;

  return { points, averageResponseRate };
}

function kstHour(iso: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  // Intl은 자정을 "24"로 줄 때가 있어 24 -> 0으로 보정
  return Number(formatted) % 24;
}

// ============================================================
// 차트3: 멀티 LLM 라우팅
// ============================================================
export type PurposeStat = {
  purpose: ModelCallRow["purpose"];
  purposeLabel: string;
  modelName: string;
  rationale: string;
  callCount: number;
  totalTokens: number;
  avgTokens: number;
  avgLatencyMs: number;
};

const PURPOSE_LABEL: Record<ModelCallRow["purpose"], string> = {
  plan: "계획 수립",
  decompose: "태스크 분해",
  nudge: "알림 문구",
  program_match: "비교과 매칭",
};

const PURPOSE_RATIONALE_KEY: Record<ModelCallRow["purpose"], "PLAN" | "DECOMPOSE" | "NUDGE" | "PROGRAM_MATCH"> = {
  plan: "PLAN",
  decompose: "DECOMPOSE",
  nudge: "NUDGE",
  program_match: "PROGRAM_MATCH",
};

const PURPOSE_ORDER: ModelCallRow["purpose"][] = ["plan", "decompose", "nudge", "program_match"];

export function buildPurposeStats(
  modelCalls: ModelCallRow[],
  rationale: Record<"PLAN" | "DECOMPOSE" | "NUDGE" | "PROGRAM_MATCH", string>,
): PurposeStat[] {
  return PURPOSE_ORDER.filter((purpose) => modelCalls.some((c) => c.purpose === purpose)).map(
    (purpose) => {
      const rows = modelCalls.filter((c) => c.purpose === purpose);
      const totalTokens = rows.reduce(
        (sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
        0,
      );
      const totalLatency = rows.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0);
      return {
        purpose,
        purposeLabel: PURPOSE_LABEL[purpose],
        modelName: rows[0]?.model_name ?? "-",
        rationale: rationale[PURPOSE_RATIONALE_KEY[purpose]],
        callCount: rows.length,
        totalTokens,
        avgTokens: rows.length === 0 ? 0 : Math.round(totalTokens / rows.length),
        avgLatencyMs: rows.length === 0 ? 0 : Math.round(totalLatency / rows.length),
      };
    },
  );
}
