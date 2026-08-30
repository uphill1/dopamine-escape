import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODEL_RATIONALE } from "@/lib/llm/models";
import { buildNudgeHourSeries, buildPurposeStats, buildTokenSavings } from "@/lib/dashboard/aggregate";
import { NudgeResponseChart } from "@/app/dashboard/nudge-response-chart";
import { LlmRoutingChart } from "@/app/dashboard/llm-routing-chart";

export default async function SystemPage() {
  const supabase = await createClient();

  const [{ data: nudges }, { data: modelCalls }] = await Promise.all([
    supabase.from("nudges").select("sent_at, responded_at"),
    supabase
      .from("model_calls")
      .select("purpose, model_name, input_tokens, output_tokens, latency_ms"),
  ]);

  const nudgeList = nudges ?? [];
  const modelCallList = modelCalls ?? [];

  const nudgeHours = buildNudgeHourSeries(nudgeList);
  const purposeStats = buildPurposeStats(modelCallList, MODEL_RATIONALE);
  const tokenSavings = buildTokenSavings(purposeStats);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-6 sm:p-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">시스템 지표</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          멀티 LLM 라우팅과 알림 타이밍이 실제로 어떻게 동작하는지
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* /dashboard에서 그대로 옮겨온 카드 — 개발자·심사자용 지표라 학생 사용자 화면과 분리 */}
        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-lg">시간대별 알림 응답률</CardTitle>
            <CardDescription>
              오전/밤 시간대가 오후보다 응답률이 높습니다 — 알림 타이밍 개인화의 근거입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NudgeResponseChart points={nudgeHours.points} averageResponseRate={nudgeHours.averageResponseRate} />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-lg">멀티 LLM 라우팅 — 용도별 비용 구조</CardTitle>
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
