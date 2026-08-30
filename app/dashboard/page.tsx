import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildSummary,
  buildComebackStats,
  buildCumulativeStudyStats,
  buildReplanEffectSeries,
  formatMonthDay,
} from "@/lib/dashboard/aggregate";
import { ReplanEffectChart } from "./replan-effect-chart";

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
  const comeback = buildComebackStats(planDayList);
  const cumulative = buildCumulativeStudyStats(sessionList);

  const comebackHeadline =
    comeback.slumpCount === 0 ? "아직 없어요" : `${comeback.comebackCount}번`;
  const comebackDetail =
    comeback.slumpCount === 0
      ? "밀린 구간이 없어요 — 지금처럼만 쭉 가요"
      : comeback.comebackCount === comeback.slumpCount
        ? `${comeback.slumpCount}번 밀렸지만 ${comeback.slumpCount}번 다 돌아왔어요`
        : `${comeback.slumpCount}번 밀린 것 중 ${comeback.comebackCount}번 돌아왔어요`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">대시보드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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

      {/* 요약 카드 6개 — 회복 서사·누적 시간(동기부여) + 기존 4개 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-primary [--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription className="text-primary-foreground/70">회복 서사</CardDescription>
            <CardTitle className="font-heading text-4xl text-primary-foreground">
              {comebackHeadline}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-xs text-primary-foreground/80">{comebackDetail}</p>
            {/* 마스코트 차차 — 환영, 카드 높이의 상당 부분을 차지하되 텍스트와 겹치지 않게 flex로 배치 */}
            <Image
              src="/mascot/chacha-welcome.png"
              alt="환영하는 차차"
              width={357}
              height={420}
              className="h-24 w-auto shrink-0"
            />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription>누적 학습 시간</CardDescription>
            <CardTitle className="font-heading text-3xl">
              {cumulative.totalHours.toLocaleString()}시간
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {cumulative.totalMinutes === 0
              ? "첫 세션을 시작하면 여기 쌓여요"
              : "밀려도 줄지 않고 계속 쌓인 시간이에요"}
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription>총 학습 세션 · 집중 시간</CardDescription>
            <CardTitle className="font-heading text-3xl">
              {summary.totalFocusMinutes.toLocaleString()}분
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            세션 {summary.totalSessions}회
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription>알림 응답률</CardDescription>
            <CardTitle className="font-heading text-3xl">
              {(summary.nudgeResponseRate * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary.respondedNudges} / {summary.totalNudges}건 응답
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription>재계획 횟수</CardDescription>
            <CardTitle className="font-heading text-3xl">{summary.maxReplannedCount}회</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">최대 재조정 횟수</CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(5)]">
          <CardHeader>
            <CardDescription>총 LLM 호출 수</CardDescription>
            <CardTitle className="font-heading text-3xl">
              {summary.totalModelCalls.toLocaleString()}회
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">4개 용도 · 4개 벤더 라우팅</CardContent>
        </Card>
      </div>

      {/* 차트1: 재계획 효과 */}
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
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
    </div>
  );
}
