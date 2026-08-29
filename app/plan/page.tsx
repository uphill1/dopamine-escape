import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlanView, type DayPlan } from "./plan-view";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const goalId = typeof params.goalId === "string" ? params.goalId : undefined;

  if (!goalId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        goalId가 없습니다. 온보딩에서 목표를 먼저 만들어주세요.
      </div>
    );
  }

  const supabase = await createClient();

  const { data: goal } = await supabase
    .from("goals")
    .select("id, title, target_date")
    .eq("id", goalId)
    .maybeSingle();

  if (!goal) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        목표를 찾을 수 없습니다.
      </div>
    );
  }

  const { data: planDays } = await supabase
    .from("plan_days")
    .select("id, date, planned_minutes")
    .eq("goal_id", goalId)
    .order("date", { ascending: true });

  const dayRows = planDays ?? [];
  const dayIds = dayRows.map((d) => d.id);

  const { data: tasks } = dayIds.length
    ? await supabase.from("tasks").select("plan_day_id, title, est_minutes").in("plan_day_id", dayIds)
    : { data: [] };

  const tasksByDay = new Map<string, { title: string; est_minutes: number }[]>();
  for (const t of tasks ?? []) {
    const list = tasksByDay.get(t.plan_day_id) ?? [];
    list.push({ title: t.title, est_minutes: t.est_minutes });
    tasksByDay.set(t.plan_day_id, list);
  }

  const days: DayPlan[] = dayRows.map((d) => ({
    date: d.date,
    plannedMinutes: d.planned_minutes,
    tasks: (tasksByDay.get(d.id) ?? []).map((t) => ({ title: t.title, estMinutes: t.est_minutes })),
  }));

  // D-day는 클라이언트 기기 시계에 맡기지 않고 서버(KST 기준)에서 계산해 PlanView에 내려준다.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const remainingDaysToTarget = Math.round(
    (new Date(`${goal.target_date}T00:00:00Z`).getTime() -
      new Date(`${today}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {goal.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">목표일: {goal.target_date}</p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft />
          대시보드
        </Link>
      </div>
      <PlanView goalId={goal.id} days={days} remainingDaysToTarget={remainingDaysToTarget} />
    </div>
  );
}
