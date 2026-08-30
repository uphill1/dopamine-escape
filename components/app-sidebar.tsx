"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  title: string;
  target_date: string;
};

// /plan이 쓰는 것과 동일한 계산식(서버 KST 기준 today 대비 target_date 차이).
function ddayLabel(targetDate: string, today: string) {
  const remaining = Math.round(
    (new Date(`${targetDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (remaining > 0) return `D-${remaining}`;
  if (remaining === 0) return "D-day";
  return `D+${Math.abs(remaining)}`;
}

export function AppSidebar({ goals, today }: { goals: Goal[]; today: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentGoalId = pathname === "/plan" ? searchParams.get("goalId") : null;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[200px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 p-3 md:flex">
      <Link
        href="/onboarding"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mb-2 justify-start gap-1.5")}
      >
        <Plus />
        새 목표
      </Link>

      {goals.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">아직 목표가 없어요</p>
      ) : (
        goals.map((goal) => {
          const active = goal.id === currentGoalId;
          return (
            <Link
              key={goal.id}
              href={`/plan?goalId=${goal.id}`}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="truncate font-medium">{goal.title}</span>
              <span className={cn("text-xs", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {ddayLabel(goal.target_date, today)}
              </span>
            </Link>
          );
        })
      )}
    </aside>
  );
}
