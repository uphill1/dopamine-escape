import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { GoalSelect } from "./goal-select";
import { ReplanView, type PlanDay } from "./replan-view";
import { cn } from "@/lib/utils";

export default async function ReplanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, target_date")
    .order("created_at", { ascending: true });

  const goalList = goals ?? [];
  const requestedGoalId = typeof params.goal === "string" ? params.goal : undefined;
  const defaultGoal =
    goalList.find((g) => g.id === requestedGoalId) ??
    goalList.find((g) => g.title.includes("토익")) ??
    goalList[0];

  if (!defaultGoal) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        아직 등록된 목표가 없습니다. 시드 데이터를 먼저 적용해주세요.
      </div>
    );
  }

  const { data: planDays } = await supabase
    .from("plan_days")
    .select("id, date, planned_minutes, status, replanned_count")
    .eq("goal_id", defaultGoal.id)
    .order("date", { ascending: true });

  const rows = planDays ?? [];
  // API와 동일한 규칙: status가 'pending'인 가장 이른 날짜 = "오늘"
  const todayIndex = rows.findIndex((d) => d.status === "pending");
  const historyRows: PlanDay[] =
    todayIndex === -1 ? rows.slice(-14) : rows.slice(0, todayIndex).slice(-14);

  let missedStreakDays = 0;
  for (let i = historyRows.length - 1; i >= 0; i--) {
    if (historyRows[i].status === "missed") missedStreakDays++;
    else break;
  }

  const currentReplannedCount =
    todayIndex !== -1
      ? rows[todayIndex].replanned_count
      : (historyRows.at(-1)?.replanned_count ?? 0);

  const today = todayIndex !== -1 ? rows[todayIndex].date : null;
  const remainingDaysToTarget = today
    ? Math.round(
        (new Date(`${defaultGoal.target_date}T00:00:00Z`).getTime() -
          new Date(`${today}T00:00:00Z`).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">재계획</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            밀린 계획을 남은 기간에 맞춰 다시 짜드려요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <ArrowLeft />
            대시보드
          </Link>
          <GoalSelect
            goals={goalList.map((g) => ({ id: g.id, title: g.title }))}
            selectedGoalId={defaultGoal.id}
          />
        </div>
      </div>

      <ReplanView
        goal={{ id: defaultGoal.id, title: defaultGoal.title, targetDate: defaultGoal.target_date }}
        history={historyRows}
        missedStreakDays={missedStreakDays}
        currentReplannedCount={currentReplannedCount}
        remainingDaysToTarget={remainingDaysToTarget}
      />
    </div>
  );
}
