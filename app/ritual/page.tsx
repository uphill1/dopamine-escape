import { createClient } from "@/lib/supabase/server";
import { RitualView } from "./ritual-view";

export default async function RitualPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const fast = params.fast === "1";

  // replan 페이지와 동일한 규칙: ?goal= 없으면 토익 목표를 기본값으로 사용
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title")
    .order("created_at", { ascending: true });

  const goalList = goals ?? [];
  const requestedGoalId = typeof params.goal === "string" ? params.goal : undefined;
  const defaultGoal =
    goalList.find((g) => g.id === requestedGoalId) ??
    goalList.find((g) => g.title.includes("토익")) ??
    goalList[0];

  let todayTask: { title: string; estMinutes: number } | null = null;

  if (defaultGoal) {
    // replan 페이지와 동일한 규칙: status가 'pending'인 가장 이른 날짜 = "오늘"
    const { data: planDays } = await supabase
      .from("plan_days")
      .select("id, date, status")
      .eq("goal_id", defaultGoal.id)
      .order("date", { ascending: true });

    const todayPlanDay = (planDays ?? []).find((d) => d.status === "pending");

    if (todayPlanDay) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, est_minutes")
        .eq("plan_day_id", todayPlanDay.id)
        .eq("status", "pending")
        .order("id", { ascending: true })
        .limit(1);

      if (tasks && tasks.length > 0) {
        todayTask = { title: tasks[0].title, estMinutes: tasks[0].est_minutes };
      }
    }
  }

  // 빈 화면 금지 — 오늘 태스크를 못 찾으면 그럴듯한 더미로 대체
  const task = todayTask ?? { title: "토익 파트5 5문항", estMinutes: 15 };

  // 3분 디톡스 완료 후 CTA도 같은 목표 맥락을 유지하도록 ?goal 값을 실어 보낸다
  const ctaHref = defaultGoal ? `/dashboard?goal=${defaultGoal.id}` : "/dashboard";

  return <RitualView task={task} fast={fast} ctaHref={ctaHref} />;
}
