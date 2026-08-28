import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MODEL_RATIONALE } from "@/lib/llm/models";
import {
  buildSummary,
  buildReplanEffectSeries,
  buildNudgeHourSeries,
  buildPurposeStats,
  buildTokenSavings,
  formatMonthDay,
} from "@/lib/dashboard/aggregate";
import { ReplanEffectChart } from "./replan-effect-chart";
import { NudgeResponseChart } from "./nudge-response-chart";
import { LlmRoutingChart } from "./llm-routing-chart";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: goals },
    { data: planDays },
    { data: sessions },
    { data: nudges },
    { data: modelCalls },
  ] = await Promise.all([
    supabase.from("goals").select("id, title").order("created_at", { ascending: true }),
    supabase.from("plan_days").select("goal_id, date, status, replanned_count"),
    supabase.from("sessions").select("focus_minutes"),
    supabase.from("nudges").select("sent_at, responded_at"),
    supabase
      .from("model_calls")
      .select("purpose, model_name, input_tokens, output_tokens, latency_ms"),
  ]);

  const goalList = goals ?? [];
  const planDayList = planDays ?? [];
  const sessionList = sessions ?? [];
  const nudgeList = nudges ?? [];
  const modelCallList = modelCalls ?? [];

  const summary = buildSummary({
    planDays: planDayList,
    sessions: sessionList,
    nudges: nudgeList,
    modelCalls: modelCallList,
  });
  const effect = buildReplanEffectSeries(goalList, planDayList);
  const nudgeHours = buildNudgeHourSeries(nudgeList);
  const purposeStats = buildPurposeStats(modelCallList, MODEL_RATIONALE);
  const tokenSavings = buildTokenSavings(purposeStats);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">대시보드</h1>
          <p className="text-sm text-muted-foreground">
            학습 루프가 실제로 도는지, 데이터로 보여드려요.
          </p>
        </div>
        {/* Base UI Button은 render prop으로 링크를 감싸면 안 됨(네이티브 버튼 시맨틱 경고) —
            buttonVariants를 Link에 직접 입혀서 버튼처럼 보이게만 스타일링한다. */}
        <Link href="/replan" className={cn(buttonVariants({ variant: "secondary" }))}>
          재계획 페이지로 이동
          <ArrowRight />
        </Link>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>총 학습 세션 · 집중 시간</CardDescription>
            <CardTitle className="font-heading text-2xl">
              {summary.totalFocusMinutes.toLocaleString()}분
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            세션 {summary.totalSessions}회
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>알림 응답률</CardDescription>
            <CardTitle className="font-heading text-2xl">
              {(summary.nudgeResponseRate * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.respondedNudges} / {summary.totalNudges}건 응답
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>재계획 횟수</CardDescription>
            <CardTitle className="font-heading text-2xl">{summary.maxReplannedCount}회</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">최대 재조정 횟수</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>총 LLM 호출 수</CardDescription>
            <CardTitle className="font-heading text-2xl">
              {summary.totalModelCalls.toLocaleString()}회
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">4개 용도 · 4개 벤더 라우팅</CardContent>
        </Card>
      </div>

      {/* 차트1: 재계획 효과 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>재계획 효과 — 계획 이행률 추이</span>
            {effect.inProgressDate && (
              <span className="text-xs font-normal text-muted-foreground">
                {formatMonthDay(effect.inProgressDate)} 진행 중
              </span>
            )}
          </CardTitle>
          <CardDescription>
            3일 이동평균 기준 · 슬럼프(3일 연속 실패) 이후 재계획을 거치면 이행률이 다시
            올라오는지 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReplanEffectChart data={effect} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 차트2: 시간대별 알림 응답률 */}
        <Card>
          <CardHeader>
            <CardTitle>시간대별 알림 응답률</CardTitle>
            <CardDescription>
              오전/밤 시간대가 오후보다 응답률이 높습니다 — 알림 타이밍 개인화의 근거입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NudgeResponseChart points={nudgeHours.points} averageResponseRate={nudgeHours.averageResponseRate} />
          </CardContent>
        </Card>

        {/* 차트3: 멀티 LLM 라우팅 */}
        <Card>
          <CardHeader>
            <CardTitle>멀티 LLM 라우팅 — 용도별 비용 구조</CardTitle>
            <CardDescription>
              호출이 가장 잦은 nudge가 토큰은 가장 적게 씁니다 — 용도별 벤더 라우팅의 근거입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {tokenSavings && (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                전량 {tokenSavings.modelName} 사용 시 대비 약 {tokenSavings.savingsPercent}% 토큰
                절감
              </p>
            )}
            <LlmRoutingChart stats={purposeStats} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {purposeStats.map((s) => (
                <div key={s.purpose} className="rounded-lg bg-muted/50 p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{s.purposeLabel}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                      {s.modelName}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{s.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
