import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { MODELS } from "@/lib/llm/models";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Vercel 기본 함수 타임아웃(10초)보다 claude-opus-5 호출(20초 안팎)이 길어서
// 배포 환경에서만 빈 응답/타임아웃이 나는 것을 막기 위한 설정.
export const runtime = "nodejs";
export const maxDuration = 60;

// 실제 벽시계 날짜 대신 데이터 기반으로 "오늘"을 정의한다: 해당 목표의 plan_days 중
// status가 아직 'pending'인 가장 이른 날짜 = 아직 확정되지 않은 첫 날 = "오늘".
// 데모를 며칠 늦게 돌려도(예: 실제로는 8/30에 시연) 시드가 고정한 스토리가 그대로 재현된다.
type PlanDayRow = {
  id: string;
  date: string;
  planned_minutes: number;
  status: "pending" | "done" | "missed";
  replanned_count: number;
};

type TaskRow = {
  id: string;
  plan_day_id: string;
  title: string;
  est_minutes: number;
};

type DayPlan = {
  date: string;
  plannedMinutes: number;
  tasks: { title: string; estMinutes: number }[];
};

// 재계획은 남은 기간 전체(최대 45일)가 아니라 "향후 14일"만 대상으로 한다.
// 그 이후 날짜는 기존 계획을 그대로 유지 — 범위를 좁혀야 claude-opus-5 응답이 데모에 쓸 만한
// 속도로 나온다 (45일 전체를 다시 설계하게 하면 출력 토큰이 커져서 지연시간이 늘어남).
const REPLAN_WINDOW_DAYS = 14;

const REPLAN_SCHEMA = {
  name: "replan_result",
  schema: {
    type: "object",
    properties: {
      summary_comment: { type: "string" },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            planned_minutes: { type: "integer" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  est_minutes: { type: "integer" },
                },
                required: ["title", "est_minutes"],
                additionalProperties: false,
              },
            },
          },
          required: ["date", "planned_minutes", "tasks"],
          additionalProperties: false,
        },
      },
    },
    required: ["summary_comment", "days"],
    additionalProperties: false,
  },
} as const;

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export async function POST(request: Request) {
  const { goalId } = (await request.json()) as { goalId?: string };
  if (!goalId) {
    return NextResponse.json({ ok: false, error: "goalId가 필요합니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, title, target_date")
    .eq("id", goalId)
    .maybeSingle();

  if (goalError || !goal) {
    return NextResponse.json({ ok: false, error: "목표를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: planDays, error: planDaysError } = await supabase
    .from("plan_days")
    .select("id, date, planned_minutes, status, replanned_count")
    .eq("goal_id", goalId)
    .order("date", { ascending: true })
    .returns<PlanDayRow[]>();

  if (planDaysError || !planDays || planDays.length === 0) {
    return NextResponse.json({ ok: false, error: "plan_days 데이터가 없습니다." }, { status: 404 });
  }

  const todayIndex = planDays.findIndex((d) => d.status === "pending");
  if (todayIndex === -1) {
    return NextResponse.json(
      { ok: false, error: "재계획할 미래 일정이 없습니다 (모두 완료/실패 처리됨)." },
      { status: 400 },
    );
  }
  const today = planDays[todayIndex].date;

  const history = planDays.slice(0, todayIndex).slice(-14);
  let missedStreakDays = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === "missed") missedStreakDays++;
    else break;
  }

  const allFutureRows = planDays
    .slice(todayIndex)
    .filter((d) => d.status === "pending");

  if (allFutureRows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "재계획할 남은 일정이 없습니다." },
      { status: 400 },
    );
  }

  // 향후 REPLAN_WINDOW_DAYS(14일)만 재계획 대상. 그 뒤는 손대지 않는다.
  const futureRows = allFutureRows.slice(0, REPLAN_WINDOW_DAYS);

  const futureIds = futureRows.map((d) => d.id);
  const { data: futureTasks } = await supabase
    .from("tasks")
    .select("id, plan_day_id, title, est_minutes")
    .in("plan_day_id", futureIds)
    .returns<TaskRow[]>();

  const tasksByDay = new Map<string, TaskRow[]>();
  for (const t of futureTasks ?? []) {
    const list = tasksByDay.get(t.plan_day_id) ?? [];
    list.push(t);
    tasksByDay.set(t.plan_day_id, list);
  }

  const before: DayPlan[] = futureRows.map((d) => ({
    date: d.date,
    plannedMinutes: d.planned_minutes,
    tasks: (tasksByDay.get(d.id) ?? []).map((t) => ({
      title: t.title,
      estMinutes: t.est_minutes,
    })),
  }));

  const remainingDaysToTarget = daysBetween(today, goal.target_date);
  const missedDates = history.slice(-missedStreakDays).map((d) => d.date);

  const systemPrompt = `너는 대학생의 학습 계획을 재조정하는 코치야. 목표는 "게으른 완벽주의자"가
계획이 며칠 밀렸다는 이유로 전체를 포기하지 않게 만드는 것.

규칙:
1. 밀린 분량을 남은 날에 그냥 균등 분배하지 마. 갑자기 하루 학습량이 2배가 되면 또 실패해.
2. 우선순위가 낮다고 판단되는 항목은 과감히 줄이거나 빼도 돼. 모든 걸 다 욱여넣지 마.
3. 하루 학습 시간(planned_minutes)은 원래 값 대비 최대 20%까지만 늘려. 그 이상은 절대 안 돼.
   오히려 줄이는 것도 괜찮아.
4. 절대 사용자를 탓하는 톤을 쓰지 마 ("왜 안 하셨나요" 금지). summary_comment는 "괜찮습니다,
   이렇게 조정했어요" 같은 담담하고 다정한 한국어 한 줄로 작성해.
5. 입력으로 주어진 각 날짜(date)에 대해 정확히 하나씩 응답해. 날짜를 빼먹거나 새로 만들지 마.
6. 각 날짜의 tasks는 1~2개, est_minutes 합이 그날 planned_minutes와 크게 어긋나지 않게.
7. 재계획 대상은 current_plan_to_revise에 있는 ${futureRows.length}일뿐이야. remaining_days_to_target은
   목표까지 남은 전체 기간을 참고하라고 주는 값이고, 그 전체를 다시 설계하라는 뜻이 아니야.
   이 ${futureRows.length}일 이후 남은 기간은 기존 계획을 그대로 유지하니 신경 쓰지 마.
   딱 주어진 날짜에만 집중해서 빠르고 간결하게 답해.`;

  const userPayload = {
    goal: { title: goal.title, target_date: goal.target_date },
    today,
    remaining_days_to_target: remainingDaysToTarget,
    replan_window_days: futureRows.length,
    missed_streak: { days: missedStreakDays, dates: missedDates },
    current_plan_to_revise: before,
  };

  const llmStarted = Date.now();
  const result = await callLLM({
    purpose: "PLAN",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
    schema: REPLAN_SCHEMA,
    // 14일치 출력이면 2천 토큰 안팎이면 충분 (측정치 기준). 기본 16000 그대로 두면
    // 모델이 여유를 갖고 더 길게 늘어질 여지가 생겨 지연시간만 늘어난다.
    maxTokens: 6000,
  });
  const latencyMs = Date.now() - llmStarted;

  const parsed = result.parsed as {
    summary_comment: string;
    days: { date: string; planned_minutes: number; tasks: { title: string; est_minutes: number }[] }[];
  };

  const byDate = new Map(parsed.days.map((d) => [d.date, d]));
  const rowById = new Map(futureRows.map((d) => [d.id, d]));

  const after: DayPlan[] = [];
  const updates: Promise<unknown>[] = [];

  for (const row of futureRows) {
    const llmDay = byDate.get(row.date);
    if (!llmDay) {
      // 모델이 이 날짜를 빼먹은 경우: 안전하게 원래 값 유지 (데모가 끊기지 않도록)
      after.push({
        date: row.date,
        plannedMinutes: row.planned_minutes,
        tasks: (tasksByDay.get(row.id) ?? []).map((t) => ({
          title: t.title,
          estMinutes: t.est_minutes,
        })),
      });
      continue;
    }

    const cap = Math.floor(row.planned_minutes * 1.2);
    const finalMinutes = Math.max(0, Math.min(llmDay.planned_minutes, cap));

    after.push({
      date: row.date,
      plannedMinutes: finalMinutes,
      tasks: llmDay.tasks.map((t) => ({ title: t.title, estMinutes: t.est_minutes })),
    });

    updates.push(
      (async () => {
        await supabase
          .from("plan_days")
          .update({
            planned_minutes: finalMinutes,
            replanned_count: row.replanned_count + 1,
          })
          .eq("id", row.id);
      })(),
    );
    updates.push(
      (async () => {
        await supabase.from("tasks").delete().eq("plan_day_id", row.id);
        await supabase.from("tasks").insert(
          llmDay.tasks.map((t) => ({
            plan_day_id: row.id,
            title: t.title,
            est_minutes: t.est_minutes,
            status: "pending" as const,
          })),
        );
      })(),
    );
  }

  await Promise.all(updates);

  const replannedCount = (rowById.get(futureRows[0].id)?.replanned_count ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    goal: { id: goal.id, title: goal.title, targetDate: goal.target_date },
    today,
    missedStreakDays,
    missedDates,
    remainingDaysToTarget,
    replanWindowDays: futureRows.length,
    replannedCount,
    model: result.model ?? MODELS.PLAN,
    latencyMs,
    comment: parsed.summary_comment,
    before,
    after,
  });
}
