import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Vercel 기본 함수 타임아웃(10초)보다 claude-opus-5 호출(20초 안팎)이 길어서
// 배포 환경에서만 빈 응답/타임아웃이 나는 것을 막기 위한 설정.
export const runtime = "nodejs";
export const maxDuration = 60;

// 데모용 고정 시드 유저. supabase/seed.sql의 v_user_id와 동일한 값.
const SEED_USER_ID = "11111111-1111-1111-1111-111111111111";

// 최초 계획도 재계획(app/api/replan/route.ts)과 동일하게 "한 번에 최대 14일"만 다룬다.
// 목표까지 남은 기간이 14일보다 짧으면 그만큼만, 길면 앞 14일만 만들고 나머지는
// 이후 재계획에서 다룬다 — 프롬프트로 모델에 위임(스키마는 1~14 범위만 강제).
const PLAN_WINDOW_DAYS = 14;
const MAX_DAILY_MINUTES = 180;

// 첫날 태스크만 gpt-5.5로 마이크로 분해할 때 쓰는 스키마. minItems/maxItems는 게이트웨이의
// strict json_schema가 지원하지 않아 400이 나므로 절대 넣지 않는다.
const DECOMPOSE_SCHEMA = {
  name: "decompose_result",
  schema: {
    type: "object",
    properties: {
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
    required: ["tasks"],
    additionalProperties: false,
  },
} as const;

const PLAN_SCHEMA = {
  name: "plan_result",
  schema: {
    type: "object",
    properties: {
      goal: {
        type: "object",
        properties: {
          title: { type: "string" },
          target_date: { type: "string" },
          category: { type: "string", enum: ["exam", "cert", "language"] },
        },
        required: ["title", "target_date", "category"],
        additionalProperties: false,
      },
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
    required: ["goal", "summary_comment", "days"],
    additionalProperties: false,
  },
} as const;

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export async function POST(request: Request) {
  const { rawInput } = (await request.json()) as { rawInput?: string };
  if (!rawInput || !rawInput.trim()) {
    return NextResponse.json({ ok: false, error: "목표를 입력해주세요." }, { status: 400 });
  }

  const today = todayInSeoul();

  const systemPrompt = `너는 대학생의 학습 목표를 분석해서 실행 가능한 일일 계획을 만드는 코치야.

사용자가 자연어로 말한 목표에서 다음을 파싱해:
- title: 목표를 한 문장으로 요약
- target_date: 목표 달성 기한 (YYYY-MM-DD). 사용자가 명시하지 않으면 목표 성격에 맞게
  합리적으로 추정해 (오늘보다 반드시 미래여야 해).
- category: "exam"(시험), "cert"(자격증), "language"(어학) 중 가장 가까운 것 하나.

오늘은 ${today}야. 오늘부터 target_date까지 남은 일수를 계산해서, 그 일수와
${PLAN_WINDOW_DAYS} 중 작은 값만큼만 일일 계획(days)을 만들어.
- 남은 기간이 ${PLAN_WINDOW_DAYS}일보다 길면 오늘부터 ${PLAN_WINDOW_DAYS}일치만 만들고,
  그 이후는 나중에 재계획에서 다룬다고 생각해 — 지금 억지로 다 채우려 하지 마.
- 남은 기간이 ${PLAN_WINDOW_DAYS}일보다 짧으면 딱 남은 일수만큼만 만들어.
- 각 날짜의 planned_minutes는 0~${MAX_DAILY_MINUTES} 사이 현실적인 값으로.
- 각 날짜의 tasks는 1~2개, 제목만 봐도 뭘 하는지 알 수 있게 구체적으로.
- summary_comment는 사용자를 응원하는 담담하고 다정한 한국어 한 줄로.`;

  const result = await callLLM({
    purpose: "PLAN",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawInput },
    ],
    schema: PLAN_SCHEMA,
    maxTokens: 16000,
  });

  const parsed = result.parsed as {
    goal: { title: string; target_date: string; category: "exam" | "cert" | "language" };
    summary_comment: string;
    days: {
      date: string;
      planned_minutes: number;
      tasks: { title: string; est_minutes: number }[];
    }[];
  };

  if (!parsed?.days || parsed.days.length === 0) {
    return NextResponse.json({ ok: false, error: "계획 생성에 실패했습니다." }, { status: 500 });
  }

  // 첫날(가장 이른 날짜)의 태스크만 gpt-5.5로 마이크로 분해해서 "지금 바로 시작할 수 있는"
  // 크기로 쪼갠다. 14일 전체를 분해하면 지연이 폭증하므로 반드시 1일치만.
  // 실패해도 계획 생성 전체가 실패하면 안 되므로 실패 시 opus가 만든 원래 태스크를 그대로 쓴다.
  const firstDay = [...parsed.days].sort((a, b) => a.date.localeCompare(b.date))[0];

  if (firstDay) {
    try {
      const decomposeSystemPrompt = `너는 오늘 계획의 태스크를 "지금 바로 시작할 수 있는" 크기로 쪼개는 코치야.

아래 오늘 계획(planned_minutes, tasks)을 받아서 2~4개의 마이크로 태스크로 다시 나눠.
- 각 태스크의 est_minutes는 5~20 사이.
- est_minutes 합계는 planned_minutes를 넘지 않아야 해.
- 첫 번째 태스크는 가장 가볍고 시작하기 쉬운 것으로 둬 — 시작 마찰을 낮추는 게 목적이야.
- 제목만 봐도 뭘 하는지 알 수 있게 구체적으로 적어.`;

      const decomposeResult = await callLLM({
        purpose: "DECOMPOSE",
        messages: [
          { role: "system", content: decomposeSystemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              planned_minutes: firstDay.planned_minutes,
              tasks: firstDay.tasks,
            }),
          },
        ],
        schema: DECOMPOSE_SCHEMA,
        // 태스크 2~4개짜리 짧은 출력이라 기본값(16000)은 과함. 다만 게이트웨이 추론 모델은
        // max_tokens가 너무 낮으면 빈 응답을 내는 사례가 있어 2000으로만 낮춘다.
        maxTokens: 2000,
      });

      const decomposeParsed = decomposeResult.parsed as {
        tasks: { title: string; est_minutes: number }[];
      } | null;

      if (decomposeParsed?.tasks && decomposeParsed.tasks.length > 0) {
        // parsed.days의 원소와 같은 참조라 여기서 바꾸면 아래 tasksByDate 구성에도 그대로 반영된다.
        firstDay.tasks = decomposeParsed.tasks;
      }
    } catch (err) {
      console.error("[api/plan] DECOMPOSE 실패, opus 원본 태스크로 진행", err);
    }
  }

  const supabase = createAdminClient();

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({
      user_id: SEED_USER_ID,
      title: parsed.goal.title,
      target_date: parsed.goal.target_date,
      category: parsed.goal.category,
    })
    .select("id")
    .single();

  if (goalError || !goal) {
    return NextResponse.json({ ok: false, error: "목표 저장에 실패했습니다." }, { status: 500 });
  }

  const planDaysToInsert = parsed.days.map((d) => ({
    goal_id: goal.id,
    date: d.date,
    planned_minutes: Math.max(0, Math.min(MAX_DAILY_MINUTES, d.planned_minutes)),
    status: "pending" as const,
    replanned_count: 0,
  }));

  const { data: insertedDays, error: planDaysError } = await supabase
    .from("plan_days")
    .insert(planDaysToInsert)
    .select("id, date, planned_minutes")
    .order("date", { ascending: true });

  if (planDaysError || !insertedDays) {
    return NextResponse.json({ ok: false, error: "일정 저장에 실패했습니다." }, { status: 500 });
  }

  const tasksByDate = new Map(parsed.days.map((d) => [d.date, d.tasks]));
  const tasksToInsert = insertedDays.flatMap((row) =>
    (tasksByDate.get(row.date) ?? []).map((t) => ({
      plan_day_id: row.id,
      title: t.title,
      est_minutes: t.est_minutes,
      status: "pending" as const,
    })),
  );

  if (tasksToInsert.length > 0) {
    await supabase.from("tasks").insert(tasksToInsert);
  }

  return NextResponse.json({
    ok: true,
    goalId: goal.id,
    summaryComment: parsed.summary_comment,
    days: insertedDays.map((row) => ({
      date: row.date,
      plannedMinutes: row.planned_minutes,
      tasks: (tasksByDate.get(row.date) ?? []).map((t) => ({
        title: t.title,
        estMinutes: t.est_minutes,
      })),
    })),
  });
}
