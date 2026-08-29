import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Vercel 기본 함수 타임아웃보다 LLM 호출이 길어질 수 있어 배포 환경 빈 응답을 막기 위한 설정.
export const runtime = "nodejs";
export const maxDuration = 60;

// ritual/replan 페이지와 동일한 규칙: 별도 goalId 없이 토익 목표를 기본값으로 사용.
async function fetchTodayTask() {
  const supabase = await createClient();

  const { data: goals } = await supabase
    .from("goals")
    .select("id, title")
    .order("created_at", { ascending: true });

  const goalList = goals ?? [];
  const defaultGoal = goalList.find((g) => g.title.includes("토익")) ?? goalList[0];

  if (!defaultGoal) return null;

  const { data: planDays } = await supabase
    .from("plan_days")
    .select("id, date, status")
    .eq("goal_id", defaultGoal.id)
    .order("date", { ascending: true });

  const todayPlanDay = (planDays ?? []).find((d) => d.status === "pending");
  if (!todayPlanDay) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, est_minutes")
    .eq("plan_day_id", todayPlanDay.id)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(1);

  if (!tasks || tasks.length === 0) return null;

  return { goalTitle: defaultGoal.title, title: tasks[0].title, estMinutes: tasks[0].est_minutes };
}

const SYSTEM_PROMPT = `너는 대학생 학습 앱의 푸시 알림 문구를 쓰는 카피라이터야.
목표는 미루고 있는 사용자가 "지금 당장" 시작하게 만드는 것 — 시작 마찰을 최대한 낮춰야 해.

규칙:
1. 반드시 한국어, 2문장 이내로만 작성해.
2. 부담을 주지 마. "3분만", "딱 한 문제만" 처럼 지금 당장 해볼 만한 아주 작은 행동을 제시해.
3. 죄책감을 자극하거나 다그치는 톤 금지 ("왜 안 하셨나요", "이러다 늦어요" 같은 표현 쓰지 마).
4. 이모지, 따옴표, 해시태그 없이 순수 텍스트로만 답해.
5. 주어진 태스크 제목을 자연스럽게 녹여서 구체적으로 써.`;

// 빈 화면 금지 — 오늘 태스크를 못 찾아도 그럴듯한 더미로 대체해 알림 문구 생성은 계속 진행
const FALLBACK_TASK = { goalTitle: "토익", title: "토익 파트5 5문항", estMinutes: 15 };

export async function POST() {
  const task = (await fetchTodayTask()) ?? FALLBACK_TASK;

  try {
    const result = await callLLM({
      purpose: "NUDGE",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `목표: ${task.goalTitle}\n오늘 할 일: ${task.title} (예상 ${task.estMinutes}분)`,
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      message: result.content.trim(),
      taskTitle: task.title,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "알림 문구 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
