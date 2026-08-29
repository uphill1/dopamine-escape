"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODELS } from "@/lib/llm/models";
import { cn } from "@/lib/utils";

export type PlanDay = {
  id: string;
  date: string;
  planned_minutes: number;
  status: "pending" | "done" | "missed";
  replanned_count: number;
};

type DayPlan = {
  date: string;
  plannedMinutes: number;
  tasks: { title: string; estMinutes: number }[];
};

type ReplanResult = {
  ok: true;
  missedStreakDays: number;
  remainingDaysToTarget: number;
  replanWindowDays: number;
  replannedCount: number;
  model: string;
  latencyMs: number;
  comment: string;
  before: DayPlan[];
  after: DayPlan[];
};

// 실제로 걸리는 시간(20초 안팎)보다 체감 시간을 줄이려고 로딩 중 문구를 순차 전환한다.
// 재계획 자체는 "향후 14일"만 대상으로 한다 (그 이후는 기존 계획 유지).
const REPLAN_WINDOW_DAYS = 14;
const LOADING_STAGES = [
  "밀린 구간을 분석하는 중",
  `${MODELS.PLAN}가 남은 기간을 재배분하는 중`,
  "일일 부담을 조정하는 중",
];
const LOADING_STAGE_INTERVAL_MS = 3500;

const STATUS_LABEL: Record<PlanDay["status"], string> = {
  done: "완료",
  missed: "실패",
  pending: "예정",
};

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// 연속 missed 구간(길이 2 이상)의 시작/끝 인덱스를 찾아서 시각적으로 묶어줄 때 쓴다.
function findMissedRuns(days: PlanDay[]) {
  const runs: { start: number; end: number }[] = [];
  let runStart: number | null = null;
  days.forEach((d, i) => {
    if (d.status === "missed") {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      if (i - runStart >= 2) runs.push({ start: runStart, end: i - 1 });
      runStart = null;
    }
  });
  if (runStart !== null && days.length - runStart >= 2) {
    runs.push({ start: runStart, end: days.length - 1 });
  }
  return runs;
}

export function ReplanView({
  goal,
  history,
  missedStreakDays,
  currentReplannedCount,
  remainingDaysToTarget,
}: {
  goal: { id: string; title: string; targetDate: string };
  history: PlanDay[];
  missedStreakDays: number;
  currentReplannedCount: number;
  remainingDaysToTarget: number | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<ReplanResult | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);

  useEffect(() => {
    if (status !== "loading") return;
    setLoadingStage(0);
    const id = setInterval(() => {
      setLoadingStage((prev) => Math.min(prev + 1, LOADING_STAGES.length - 1));
    }, LOADING_STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status]);

  const missedRuns = findMissedRuns(history);
  const showBanner = missedStreakDays >= 3 && status !== "done";

  async function handleReplan() {
    setStatus("loading");
    try {
      const res = await fetch("/api/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "재계획에 실패했습니다.");
      }
      setResult(data as ReplanResult);
      setStatus("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "재계획에 실패했습니다.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 지난 14일 타임라인 */}
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>{goal.title}</span>
            <span className="text-xs font-normal text-muted-foreground">
              최근 {history.length}일
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5">
            {history.map((d, i) => {
              const inSlump = missedRuns.some((r) => i >= r.start && i <= r.end);
              return (
                <div key={d.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    title={`${formatDate(d.date)} · ${STATUS_LABEL[d.status]}`}
                    className={cn(
                      "h-10 w-full rounded-md transition-all",
                      d.status === "done" && "bg-emerald-500",
                      d.status === "missed" && "bg-destructive",
                      d.status === "pending" && "bg-muted",
                      inSlump && "ring-2 ring-offset-2 ring-offset-background ring-destructive animate-pulse",
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground">{formatDate(d.date)}</span>
                </div>
              );
            })}
          </div>
          {missedRuns.length > 0 && (
            <p className="mt-2 text-xs text-destructive">
              빨간 테두리 구간 = 연속 실패 슬럼프
            </p>
          )}
        </CardContent>
      </Card>

      {/* 배너 / 로딩 / 완료 상태 */}
      <AnimatePresence mode="wait">
        {showBanner && status === "idle" && (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-destructive/30 bg-destructive/5 [--card-spacing:--spacing(5)]">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <p className="text-sm font-medium">
                  {missedStreakDays}일 밀렸습니다. 앞으로 {REPLAN_WINDOW_DAYS}일 계획을 다시
                  짤까요?
                  {remainingDaysToTarget !== null && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      (목표까지 남은 {remainingDaysToTarget}일 중)
                    </span>
                  )}
                </p>
                <Button onClick={handleReplan}>다시 짜기</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card>
              <CardContent className="flex items-center gap-3 pt-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={loadingStage}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {LOADING_STAGES[loadingStage]}...
                  </motion.span>
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {status === "done" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-4"
          >
            <Card className="border-emerald-500/30 bg-emerald-500/5 [--card-spacing:--spacing(5)]">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-500" />
                  <p className="text-sm font-medium">{result.comment}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {result.replannedCount}번째 재조정
                </span>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              {result.model} · {result.latencyMs}ms · 목표까지 남은{" "}
              {result.remainingDaysToTarget}일 중 앞으로 {result.replanWindowDays}일 재배분
            </p>

            <motion.div
              className="flex flex-col gap-2"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.05 } },
              }}
            >
              {result.after.map((day, i) => {
                const beforeDay = result.before[i];
                const changed = beforeDay && beforeDay.plannedMinutes !== day.plannedMinutes;
                return (
                  <motion.div
                    key={day.date}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <Card size="sm" className={cn(changed && "ring-1 ring-primary/40")}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
                        <span className="w-12 shrink-0 font-medium">{formatDate(day.date)}</span>
                        <span className="flex items-center gap-2">
                          {changed ? (
                            <>
                              <span className="text-[10px] text-muted-foreground/50 line-through">
                                {beforeDay.plannedMinutes}분
                              </span>
                              <span className="text-2xl leading-none font-bold tabular-nums text-primary">
                                {day.plannedMinutes}분
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{day.plannedMinutes}분</span>
                          )}
                        </span>
                        <span className="flex-1 basis-full text-xs text-muted-foreground sm:basis-auto">
                          {day.tasks.map((t) => t.title).join(" · ")}
                        </span>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showBanner && status === "idle" && (
        <p className="text-sm text-muted-foreground">
          이번 목표는 {currentReplannedCount}번 재조정된 상태로, 현재까지는 순항 중이에요.
        </p>
      )}
    </div>
  );
}
